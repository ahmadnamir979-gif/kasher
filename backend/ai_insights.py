"""
Al-Arraab Smart Insights Module
Rule-based proactive alerts + optional LLM summarization.
Runs on-demand or via daily cron.
"""
from fastapi import HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid


def _sid(u): return u["shop_id"]
def _now(): return datetime.now(timezone.utc)
def _iso(): return _now().isoformat()
def _new_id(): return str(uuid.uuid4())


class InsightsSettingsIn(BaseModel):
    enabled: bool = True
    stock_low_threshold: int = 5  # items with stock <= X are "critical"
    sales_change_threshold: float = 20.0  # % change to trigger alert
    expense_change_threshold: float = 25.0
    cash_low_threshold: float = 500.0
    check_due_days: int = 7  # alert for checks due within N days
    owner_whatsapp: Optional[str] = ""  # E.g., +972501234567
    whatsapp_alerts_enabled: bool = False  # send critical alerts via WA link


async def _compute_insights(db, shop_id: str, settings: dict):
    """Compute rule-based insights. Returns list of alert dicts."""
    now = _now()
    alerts = []

    # --- Sales change: this 7 days vs previous 7 days ---
    week_ago = (now - timedelta(days=7)).isoformat()
    two_weeks_ago = (now - timedelta(days=14)).isoformat()
    cur = await db.sales.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": week_ago}, "is_return": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "profit": {"$sum": "$profit"}}},
    ]).to_list(1)
    prev = await db.sales.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": two_weeks_ago, "$lt": week_ago}, "is_return": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "profit": {"$sum": "$profit"}}},
    ]).to_list(1)
    cur_rev = (cur[0]["total"] if cur else 0)
    prev_rev = (prev[0]["total"] if prev else 0)
    if prev_rev > 0:
        change = ((cur_rev - prev_rev) / prev_rev) * 100
        thr = settings.get("sales_change_threshold", 20.0)
        if abs(change) >= thr:
            if change > 0:
                alerts.append({
                    "severity": "success",
                    "icon": "trending-up",
                    "title": f"مبيعاتك ارتفعت {round(change, 1)}% هالأسبوع",
                    "detail": f"من {round(prev_rev, 2)} إلى {round(cur_rev, 2)} مقارنة بالأسبوع السابق. أحسنت!",
                    "kind": "sales_up",
                })
            else:
                alerts.append({
                    "severity": "warning",
                    "icon": "trending-down",
                    "title": f"مبيعاتك انخفضت {round(abs(change), 1)}% هالأسبوع",
                    "detail": f"من {round(prev_rev, 2)} إلى {round(cur_rev, 2)}. تحقق من المخزون والعروض.",
                    "kind": "sales_down",
                })

    # --- Expenses change ---
    cur_exp = await db.expenses.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": week_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    prev_exp = await db.expenses.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": two_weeks_ago, "$lt": week_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    c = (cur_exp[0]["total"] if cur_exp else 0)
    p = (prev_exp[0]["total"] if prev_exp else 0)
    if p > 0:
        ch = ((c - p) / p) * 100
        thr = settings.get("expense_change_threshold", 25.0)
        if ch >= thr:
            alerts.append({
                "severity": "warning",
                "icon": "wallet",
                "title": f"المصاريف ارتفعت {round(ch, 1)}% هالأسبوع",
                "detail": f"من {round(p, 2)} إلى {round(c, 2)}. راجع بنود المصاريف.",
                "kind": "expenses_up",
            })

    # --- Low cash position ---
    cash_agg = await db.accounts.aggregate([
        {"$match": {"shop_id": shop_id, "$or": [{"is_cash": True}, {"is_bank": True}]}},
        {"$group": {"_id": None, "total": {"$sum": "$balance"}}},
    ]).to_list(1)
    cash = (cash_agg[0]["total"] if cash_agg else 0)
    thr = settings.get("cash_low_threshold", 500.0)
    if cash < thr:
        alerts.append({
            "severity": "danger" if cash < thr / 2 else "warning",
            "icon": "landmark",
            "title": f"السيولة منخفضة: {round(cash, 2)}",
            "detail": f"مجموع الصندوق والبنوك أقل من الحد {thr}. اجمع مستحقاتك أو أوقف صرفيات غير ضرورية.",
            "kind": "low_cash",
        })

    # --- Fast-moving items with low stock ---
    thirty_ago = (now - timedelta(days=30)).isoformat()
    fast = await db.sales.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": thirty_ago}, "is_return": {"$ne": True}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "name": {"$first": "$items.name"}, "qty": {"$sum": "$items.qty"}}},
        {"$sort": {"qty": -1}},
        {"$limit": 20},
    ]).to_list(20)
    stock_thr = settings.get("stock_low_threshold", 5)
    for f in fast[:10]:
        prod = await db.products.find_one({"id": f["_id"], "shop_id": shop_id})
        if prod and 0 < (prod.get("stock", 0) or 0) <= stock_thr:
            alerts.append({
                "severity": "warning",
                "icon": "package",
                "title": f"صنف رائج قارب على النفاد: {f['name']}",
                "detail": f"بيع {round(f['qty'], 1)} خلال آخر 30 يوم — رصيد الآن {round(prod.get('stock', 0), 1)} فقط. الأولوية للطلب.",
                "kind": "fast_low_stock",
            })
        if prod and (prod.get("stock", 0) or 0) <= 0:
            alerts.append({
                "severity": "danger",
                "icon": "alert-circle",
                "title": f"نفد المخزون من صنف رائج: {f['name']}",
                "detail": f"مبيعات آخر 30 يوم: {round(f['qty'], 1)} — الرصيد صفر. اطلبه فوراً.",
                "kind": "out_of_stock_fast",
            })

    # --- Slow-moving items (no sales last 60 days) ---
    sixty_ago = (now - timedelta(days=60)).isoformat()
    sold_ids = set()
    async for s in db.sales.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": sixty_ago}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id"}},
    ]):
        sold_ids.add(s["_id"])
    slow_count = await db.products.count_documents({
        "shop_id": shop_id,
        "id": {"$nin": list(sold_ids)},
        "stock": {"$gt": 0},
    })
    if slow_count >= 5:
        alerts.append({
            "severity": "info",
            "icon": "clock",
            "title": f"{slow_count} صنف لم يُبَع منذ 60 يوم",
            "detail": "فكّر بعرض تخفيض أو تصفية لتحرير رأس المال المُجمَّد بالمخزون.",
            "kind": "slow_moving",
        })

    # --- Upcoming check dues ---
    due_limit = (now + timedelta(days=settings.get("check_due_days", 7))).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")
    upcoming = await db.checks.count_documents({
        "shop_id": shop_id,
        "status": "pending",
        "due_date": {"$gte": today, "$lte": due_limit},
    })
    if upcoming > 0:
        alerts.append({
            "severity": "info",
            "icon": "receipt",
            "title": f"{upcoming} شيك يستحق خلال أسبوع",
            "detail": "راجع صفحة البنوك والشيكات وحدّث حالة الشيكات المصروفة.",
            "kind": "checks_due",
        })

    # --- Expiring items ---
    exp_limit = (now + timedelta(days=30)).strftime("%Y-%m-%d")
    exp_count = await db.products.count_documents({
        "shop_id": shop_id,
        "expiry_date": {"$gte": today, "$lte": exp_limit},
    })
    if exp_count > 0:
        alerts.append({
            "severity": "warning",
            "icon": "alert-triangle",
            "title": f"{exp_count} صنف يقارب انتهاء الصلاحية (30 يوم)",
            "detail": "افتح صفحة تواريخ الصلاحية وخطّط لتصفية أو خصم.",
            "kind": "expiring_soon",
        })

    # --- Overdue receivables ---
    overdue_customers = await db.customers.count_documents({
        "shop_id": shop_id,
        "balance": {"$gt": 100},
    })
    if overdue_customers >= 3:
        alerts.append({
            "severity": "info",
            "icon": "users",
            "title": f"{overdue_customers} عميل عليهم مستحقات",
            "detail": "شغّل تذكيرات الديون الأسبوعية عبر واتساب لتحصيلها.",
            "kind": "receivables_reminder",
        })

    return alerts


def register(api, db, require_shop_user):

    @api.get("/ai/insights/settings")
    async def get_settings(user=Depends(require_shop_user)):
        s = await db.ai_insights_settings.find_one({"shop_id": _sid(user)}, {"_id": 0})
        if not s:
            s = InsightsSettingsIn().model_dump()
            s["shop_id"] = _sid(user)
        return s

    @api.put("/ai/insights/settings")
    async def set_settings(data: InsightsSettingsIn, user=Depends(require_shop_user)):
        await db.ai_insights_settings.update_one(
            {"shop_id": _sid(user)},
            {"$set": {**data.model_dump(), "shop_id": _sid(user), "updated_at": _iso()}},
            upsert=True,
        )
        return {"ok": True}

    @api.get("/ai/insights")
    async def list_insights(user=Depends(require_shop_user), refresh: bool = False):
        s = await db.ai_insights_settings.find_one({"shop_id": _sid(user)}, {"_id": 0})
        settings = s or InsightsSettingsIn().model_dump()
        if not settings.get("enabled", True) and not refresh:
            return {"enabled": False, "alerts": []}

        # If refresh requested or no recent snapshot, compute
        latest = await db.ai_alerts.find_one({"shop_id": _sid(user)}, {"_id": 0}, sort=[("created_at", -1)])
        need_compute = refresh or not latest or (
            datetime.fromisoformat(latest["created_at"]).replace(tzinfo=timezone.utc)
            < _now() - timedelta(hours=6)
        )
        if need_compute:
            alerts = await _compute_insights(db, _sid(user), settings)
            snapshot = {
                "id": _new_id(),
                "shop_id": _sid(user),
                "alerts": alerts,
                "created_at": _iso(),
            }
            await db.ai_alerts.insert_one(dict(snapshot))
            # Keep only latest 20 snapshots
            old = await db.ai_alerts.find({"shop_id": _sid(user)}, {"_id": 1, "id": 1, "created_at": 1}).sort("created_at", -1).skip(20).to_list(1000)
            if old:
                await db.ai_alerts.delete_many({"id": {"$in": [o["id"] for o in old]}})
            return {"enabled": True, "alerts": alerts, "computed_at": snapshot["created_at"], "fresh": True}
        return {
            "enabled": True,
            "alerts": latest.get("alerts", []),
            "computed_at": latest.get("created_at"),
            "fresh": False,
        }

    # Cron endpoint — runs for all shops daily
    @api.get("/cron/ai-insights")
    async def cron_run_insights(secret: str = ""):
        import os
        cron_secret = os.environ.get("CRON_SECRET", "")
        if cron_secret and secret != cron_secret:
            raise HTTPException(401, "Invalid cron secret")
        shops = await db.shops.find({"is_active": True}, {"id": 1}).to_list(10000)
        computed = 0
        for shop in shops:
            s = await db.ai_insights_settings.find_one({"shop_id": shop["id"]}, {"_id": 0})
            settings = s or InsightsSettingsIn().model_dump()
            if not settings.get("enabled", True):
                continue
            alerts = await _compute_insights(db, shop["id"], settings)
            await db.ai_alerts.insert_one({
                "id": _new_id(),
                "shop_id": shop["id"],
                "alerts": alerts,
                "created_at": _iso(),
            })
            computed += 1
        return {"ok": True, "shops_computed": computed}

    @api.get("/ai/insights/whatsapp-link")
    async def whatsapp_link(user=Depends(require_shop_user)):
        """Return a wa.me link pre-filled with the current critical alerts."""
        from urllib.parse import quote
        s = await db.ai_insights_settings.find_one({"shop_id": _sid(user)}, {"_id": 0}) or {}
        phone = (s.get("owner_whatsapp") or "").strip().replace("+", "").replace(" ", "").replace("-", "")
        if not phone:
            raise HTTPException(400, "لم يتم إضافة رقم واتساب صاحب المحل")
        latest = await db.ai_alerts.find_one({"shop_id": _sid(user)}, {"_id": 0}, sort=[("created_at", -1)])
        alerts = (latest or {}).get("alerts", [])
        # Include only warning/danger
        critical = [a for a in alerts if a.get("severity") in ("warning", "danger")]
        shop = await db.shops.find_one({"id": _sid(user)}, {"_id": 0}) or {}
        header = f"🔔 تنبيهات {shop.get('name', 'محلك')} — {_now().strftime('%Y-%m-%d %H:%M')}"
        if not critical:
            body = "لا تنبيهات حرجة حالياً — الوضع تحت السيطرة ✓"
        else:
            emoji_map = {"danger": "🔴", "warning": "🟡"}
            lines = [f"{emoji_map.get(a['severity'], '•')} {a['title']}\n   {a['detail']}" for a in critical[:12]]
            body = "\n\n".join(lines)
        msg = f"{header}\n\n{body}"
        return {
            "phone": phone,
            "url": f"https://wa.me/{phone}?text={quote(msg)}",
            "alerts_count": len(critical),
            "message_preview": msg,
        }

    return api
