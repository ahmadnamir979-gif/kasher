"""
Promotions & Loyalty & Audit Log module for Al-Arraab Supermarket.
Registered via register(api, db, require_shop_user).
"""
from fastapi import HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal
import uuid


def _sid(u):
    return u["shop_id"]


def _utc():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.isoformat()


def _new_id():
    return str(uuid.uuid4())


# ============ Promotions ============
class PromotionIn(BaseModel):
    name: str
    kind: Literal["bogo", "percent", "fixed", "bundle"] = "percent"
    # bogo: buy X get Y free; percent: % off; fixed: amount off; bundle: N for Z
    product_id: Optional[str] = None  # for product-targeted promos
    category_id: Optional[str] = None  # for category promos
    buy_qty: int = 1
    get_qty: int = 0  # for bogo
    bundle_qty: int = 0  # for bundle
    bundle_price: float = 0
    percent_off: float = 0
    amount_off: float = 0
    min_total: float = 0
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    time_from: Optional[str] = None  # "18:00"
    time_to: Optional[str] = None    # "22:00"
    days_of_week: Optional[List[int]] = None  # 0=Sunday
    is_active: bool = True


# ============ Loyalty ============
class LoyaltySettingsIn(BaseModel):
    enabled: bool = True
    points_per_currency: float = 1.0  # points earned per 1 currency unit
    redeem_rate: float = 10.0  # points per 1 currency unit of discount
    min_redeem_points: int = 100
    silver_threshold: int = 500
    gold_threshold: int = 2000
    vip_threshold: int = 5000


class PointsAdjustIn(BaseModel):
    customer_id: str
    delta: int  # positive earn / negative redeem
    reason: Optional[str] = ""


def register(api, db, require_shop_user):
    sid = _sid

    # ================= Promotions CRUD =================
    @api.get("/promotions")
    async def list_promotions(active_only: bool = False, user=Depends(require_shop_user)):
        q = {"shop_id": sid(user)}
        if active_only:
            q["is_active"] = True
        return await db.promotions.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

    @api.post("/promotions")
    async def create_promotion(data: PromotionIn, user=Depends(require_shop_user)):
        doc = {"id": _new_id(), "shop_id": sid(user), **data.model_dump(),
               "created_by": user["id"], "created_at": _iso(_utc())}
        await db.promotions.insert_one(doc)
        doc.pop("_id", None)
        # Log action
        await _audit(db, user, "promotion_create", f"عرض جديد: {data.name}", doc["id"])
        return doc

    @api.patch("/promotions/{pid}")
    async def update_promotion(pid: str, data: PromotionIn, user=Depends(require_shop_user)):
        r = await db.promotions.update_one(
            {"id": pid, "shop_id": sid(user)}, {"$set": data.model_dump()}
        )
        if not r.matched_count:
            raise HTTPException(404, "العرض غير موجود")
        await _audit(db, user, "promotion_update", f"تعديل عرض: {data.name}", pid)
        return {"ok": True}

    @api.delete("/promotions/{pid}")
    async def delete_promotion(pid: str, user=Depends(require_shop_user)):
        p = await db.promotions.find_one({"id": pid, "shop_id": sid(user)})
        await db.promotions.delete_one({"id": pid, "shop_id": sid(user)})
        await _audit(db, user, "promotion_delete", f"حذف عرض: {(p or {}).get('name', '')}", pid)
        return {"ok": True}

    @api.post("/promotions/apply")
    async def apply_promotions(cart: dict, user=Depends(require_shop_user)):
        """Takes {items: [{product_id, qty, price, category_id}], subtotal} and returns applied promos & discount."""
        items = cart.get("items", [])
        subtotal = float(cart.get("subtotal", 0))
        now = _utc()
        promos = await db.promotions.find(
            {"shop_id": sid(user), "is_active": True}, {"_id": 0}
        ).to_list(500)
        applied = []
        total_discount = 0.0
        for p in promos:
            # Date range
            if p.get("starts_at") and p["starts_at"] > _iso(now):
                continue
            if p.get("ends_at") and p["ends_at"] < _iso(now):
                continue
            # Time range (local naive HH:MM)
            if p.get("time_from") and p.get("time_to"):
                hhmm = now.strftime("%H:%M")
                if not (p["time_from"] <= hhmm <= p["time_to"]):
                    continue
            # Days of week
            if p.get("days_of_week"):
                # Sun=0 ... Sat=6 (Python weekday Mon=0, convert)
                py_dow = now.weekday()  # 0=Mon
                dow = (py_dow + 1) % 7   # 0=Sunday
                if dow not in p["days_of_week"]:
                    continue
            # Min total
            if subtotal < float(p.get("min_total", 0) or 0):
                continue
            kind = p["kind"]
            if kind == "percent":
                target = [i for i in items if (p.get("product_id") in (None, i.get("product_id")))
                          and (p.get("category_id") in (None, i.get("category_id")))]
                base = sum(i["qty"] * i["price"] for i in target)
                disc = round(base * float(p["percent_off"]) / 100.0, 2)
                if disc > 0:
                    applied.append({"id": p["id"], "name": p["name"], "discount": disc})
                    total_discount += disc
            elif kind == "fixed":
                if subtotal >= float(p.get("amount_off", 0)):
                    applied.append({"id": p["id"], "name": p["name"], "discount": float(p["amount_off"])})
                    total_discount += float(p["amount_off"])
            elif kind == "bogo":
                for it in items:
                    if p.get("product_id") and it.get("product_id") != p["product_id"]:
                        continue
                    buy_q = max(1, int(p.get("buy_qty", 1)))
                    get_q = max(0, int(p.get("get_qty", 0)))
                    groups = int(it["qty"]) // (buy_q + get_q) if get_q else 0
                    if groups:
                        disc = round(groups * get_q * it["price"], 2)
                        applied.append({"id": p["id"], "name": p["name"], "discount": disc})
                        total_discount += disc
            elif kind == "bundle":
                for it in items:
                    if p.get("product_id") and it.get("product_id") != p["product_id"]:
                        continue
                    bq = max(1, int(p.get("bundle_qty", 1)))
                    bp = float(p.get("bundle_price", 0))
                    if bq > 0 and it["qty"] >= bq and bp > 0:
                        groups = int(it["qty"]) // bq
                        orig = groups * bq * it["price"]
                        new = groups * bp
                        disc = round(orig - new, 2)
                        if disc > 0:
                            applied.append({"id": p["id"], "name": p["name"], "discount": disc})
                            total_discount += disc
        return {"applied": applied, "total_discount": round(total_discount, 2)}

    # ================= Loyalty =================
    @api.get("/loyalty/settings")
    async def get_loyalty_settings(user=Depends(require_shop_user)):
        s = await db.loyalty_settings.find_one({"shop_id": sid(user)}, {"_id": 0})
        if not s:
            s = LoyaltySettingsIn().model_dump()
            s["shop_id"] = sid(user)
            await db.loyalty_settings.insert_one(dict(s))
            s.pop("_id", None)
        return s

    @api.post("/loyalty/settings")
    async def save_loyalty_settings(data: LoyaltySettingsIn, user=Depends(require_shop_user)):
        payload = data.model_dump()
        await db.loyalty_settings.update_one(
            {"shop_id": sid(user)}, {"$set": payload}, upsert=True
        )
        await _audit(db, user, "loyalty_settings", "تعديل إعدادات برنامج الولاء", None)
        return {"ok": True}

    @api.post("/loyalty/adjust")
    async def adjust_points(data: PointsAdjustIn, user=Depends(require_shop_user)):
        cust = await db.customers.find_one({"id": data.customer_id, "shop_id": sid(user)})
        if not cust:
            raise HTTPException(404, "العميل غير موجود")
        await db.customers.update_one(
            {"id": data.customer_id, "shop_id": sid(user)},
            {"$inc": {"loyalty_points": data.delta}}
        )
        doc = {"id": _new_id(), "shop_id": sid(user),
               "customer_id": data.customer_id, "delta": data.delta,
               "reason": data.reason or "", "user_id": user["id"],
               "created_at": _iso(_utc())}
        await db.loyalty_history.insert_one(doc)
        return {"ok": True}

    @api.get("/loyalty/top")
    async def top_customers(limit: int = 20, user=Depends(require_shop_user)):
        cs = await db.customers.find(
            {"shop_id": sid(user), "loyalty_points": {"$gt": 0}},
            {"_id": 0}
        ).sort("loyalty_points", -1).limit(limit).to_list(limit)
        return cs

    # ================= Audit Log =================
    @api.get("/audit-log")
    async def get_audit_log(limit: int = 200, action: Optional[str] = None, user=Depends(require_shop_user)):
        q = {"shop_id": sid(user)}
        if action:
            q["action"] = action
        rows = await db.audit_log.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return rows

    # Expose internal helper to be callable from server.py routes (price edits, etc.)
    async def write_audit(user, action: str, description: str, ref_id: Optional[str] = None, meta: Optional[dict] = None):
        await _audit(db, user, action, description, ref_id, meta)

    api.state_audit = write_audit  # type: ignore

    # ================= Enhanced Dashboard Summary =================
    @api.get("/dashboard/summary")
    async def dashboard_summary(user=Depends(require_shop_user)):
        shop = sid(user)
        today = _utc().date()
        today_s = today.isoformat()
        yest_s = (today - timedelta(days=1)).isoformat()
        month_start = today.replace(day=1).isoformat()
        prev_month_end = today.replace(day=1) - timedelta(days=1)
        prev_month_start = prev_month_end.replace(day=1).isoformat()

        async def _sum_sales(start_date, end_date=None):
            q = {"shop_id": shop, "created_at": {"$gte": start_date}}
            if end_date:
                q["created_at"]["$lt"] = end_date
            r = await db.sales.aggregate([
                {"$match": q},
                {"$group": {"_id": None, "total": {"$sum": "$total"},
                            "count": {"$sum": 1}, "profit": {"$sum": "$profit"},
                            "cost": {"$sum": "$cost_total"}}}
            ]).to_list(1)
            return r[0] if r else {"total": 0, "count": 0, "profit": 0, "cost": 0}

        today_s_iso = today_s
        yest_iso = yest_s
        today_data = await _sum_sales(today_s_iso)
        yest_data = await _sum_sales(yest_iso, today_s_iso)
        month_data = await _sum_sales(month_start)
        prev_month_data = await _sum_sales(prev_month_start, month_start)

        # Card sales today
        card_today = await db.sales.aggregate([
            {"$match": {"shop_id": shop, "created_at": {"$gte": today_s_iso},
                        "payment_method": "card"}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]).to_list(1)
        card_total = card_today[0]["total"] if card_today else 0

        # Cash sales today
        cash_today = await db.sales.aggregate([
            {"$match": {"shop_id": shop, "created_at": {"$gte": today_s_iso},
                        "payment_method": "cash"}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]).to_list(1)
        cash_total = cash_today[0]["total"] if cash_today else 0

        # Debts (sum of positive customer balances)
        custs = await db.customers.find({"shop_id": shop}, {"_id": 0, "balance": 1}).to_list(5000)
        debts = round(sum(float(c.get("balance", 0)) for c in custs if float(c.get("balance", 0)) > 0), 2)
        customers_count = len(custs)

        # Purchases today
        pur_today = await db.purchases.aggregate([
            {"$match": {"shop_id": shop, "created_at": {"$gte": today_s_iso}}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        pur_data = pur_today[0] if pur_today else {"total": 0, "count": 0}

        # Low stock count
        low_stock_count = await db.products.count_documents({
            "shop_id": shop, "is_active": True,
            "$expr": {"$lte": ["$stock", "$min_stock"]}
        })

        # Near-expiry (<=30d)
        soon = (_utc() + timedelta(days=30)).date().isoformat()
        near_expiry = await db.products.count_documents({
            "shop_id": shop, "expiry_date": {"$lte": soon, "$ne": None, "$gt": today_s}
        })

        # Top 10 products this month
        top_pipe = [
            {"$match": {"shop_id": shop, "created_at": {"$gte": month_start},
                        "is_return": {"$ne": True}}},
            {"$unwind": "$items"},
            {"$group": {"_id": {"id": "$items.product_id", "name": "$items.name"},
                        "qty": {"$sum": "$items.qty"},
                        "revenue": {"$sum": {"$multiply": ["$items.qty", "$items.price"]}}}},
            {"$sort": {"qty": -1}}, {"$limit": 10}
        ]
        top10 = []
        async for r in db.sales.aggregate(top_pipe):
            top10.append({"name": r["_id"].get("name"),
                          "qty": round(r["qty"], 2),
                          "revenue": round(r["revenue"], 2)})

        # Least active (bottom 5 products with any movement)
        bottom = sorted(top10, key=lambda r: r["qty"])[:5] if top10 else []

        # Cash in box (reuse logic)
        pipeline_cs = [
            {"$match": {"shop_id": shop, "payment_method": {"$in": ["cash", "card"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]
        sr = await db.sales.aggregate(pipeline_cs).to_list(1)
        cs_total = sr[0]["total"] if sr else 0
        er = await db.expenses.aggregate([{"$match": {"shop_id": shop}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        expenses_all = er[0]["total"] if er else 0
        pr = await db.purchases.aggregate([{"$match": {"shop_id": shop, "is_return": {"$ne": True}}}, {"$group": {"_id": None, "total": {"$sum": "$paid"}}}]).to_list(1)
        pur_paid = pr[0]["total"] if pr else 0
        cash_in_drawer = round(cs_total - expenses_all - pur_paid, 2)

        # Average invoice
        avg_inv_today = round(today_data["total"] / today_data["count"], 2) if today_data["count"] else 0

        # Daily chart (last 14 days)
        chart_pipe = [
            {"$match": {"shop_id": shop, "created_at": {"$gte": (today - timedelta(days=14)).isoformat()}}},
            {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "total": {"$sum": "$total"}}},
            {"$sort": {"_id": 1}}
        ]
        chart = []
        async for r in db.sales.aggregate(chart_pipe):
            chart.append({"date": r["_id"], "total": round(r["total"], 2)})

        # Important alerts
        alerts = []
        if low_stock_count > 0:
            alerts.append({"type": "stock", "severity": "warn", "message": f"{low_stock_count} صنف تحت الحد الأدنى"})
        if near_expiry > 0:
            alerts.append({"type": "expiry", "severity": "warn", "message": f"{near_expiry} صنف قارب على الانتهاء"})
        if debts > 0:
            alerts.append({"type": "debt", "severity": "info", "message": f"ديون عملاء: {debts:.2f}"})

        return {
            "today": {"total": round(today_data["total"], 2), "profit": round(today_data["profit"], 2),
                      "count": today_data["count"], "avg_invoice": avg_inv_today,
                      "cash": round(cash_total, 2), "card": round(card_total, 2)},
            "yesterday": {"total": round(yest_data["total"], 2), "count": yest_data["count"]},
            "month": {"total": round(month_data["total"], 2), "profit": round(month_data["profit"], 2)},
            "prev_month": {"total": round(prev_month_data["total"], 2), "profit": round(prev_month_data["profit"], 2)},
            "cash_in_drawer": cash_in_drawer,
            "debts": debts,
            "customers_count": customers_count,
            "purchases_today": {"total": round(pur_data["total"], 2), "count": pur_data["count"]},
            "low_stock_count": low_stock_count,
            "near_expiry_count": near_expiry,
            "top10": top10,
            "least_active": bottom,
            "chart_14d": chart,
            "alerts": alerts,
        }


async def _audit(db, user, action: str, description: str, ref_id=None, meta=None):
    try:
        await db.audit_log.insert_one({
            "id": _new_id(), "shop_id": user["shop_id"],
            "user_id": user["id"], "user_name": user.get("name", ""),
            "action": action, "description": description,
            "ref_id": ref_id, "meta": meta or {},
            "created_at": _iso(_utc())
        })
    except Exception:
        pass


# Public wrapper for other modules
async def log_action(db, user, action: str, description: str, ref_id=None, meta=None):
    await _audit(db, user, action, description, ref_id, meta)
