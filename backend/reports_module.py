"""
Al-Arraab Reports Module — Advanced Reports, Statements and Cashbox.
Registered via register(api, db, require_shop_user).
"""
from fastapi import HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal
import uuid


def _sid(user):
    return user["shop_id"]


def _utc():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.isoformat()


def _new_id():
    return str(uuid.uuid4())


class PartyPaymentIn(BaseModel):
    amount: float
    method: Literal["cash", "card", "bank"] = "cash"
    notes: Optional[str] = ""
    date: Optional[str] = None


def register(api, db, require_shop_user):
    sid = _sid

    # ============ Customer / Supplier Payments & Statements ============
    @api.post("/customers/{cid}/payment")
    async def collect_from_customer(cid: str, data: PartyPaymentIn, user=Depends(require_shop_user)):
        cust = await db.customers.find_one({"id": cid, "shop_id": sid(user)})
        if not cust:
            raise HTTPException(404, "العميل غير موجود")
        amt = float(data.amount or 0)
        if amt <= 0:
            raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")
        doc = {
            "id": _new_id(), "shop_id": sid(user),
            "party_type": "customer", "party_id": cid, "party_name": cust.get("name", ""),
            "direction": "in", "amount": amt, "method": data.method,
            "notes": data.notes or "", "user_id": user["id"],
            "date": data.date or _utc().date().isoformat(),
            "created_at": _iso(_utc()),
        }
        await db.payments.insert_one(doc)
        await db.customers.update_one(
            {"id": cid, "shop_id": sid(user)}, {"$inc": {"balance": -amt}}
        )
        doc.pop("_id", None)
        return doc

    @api.post("/suppliers/{sid_}/payment")
    async def pay_supplier(sid_: str, data: PartyPaymentIn, user=Depends(require_shop_user)):
        sup = await db.suppliers.find_one({"id": sid_, "shop_id": sid(user)})
        if not sup:
            raise HTTPException(404, "المورد غير موجود")
        amt = float(data.amount or 0)
        if amt <= 0:
            raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")
        doc = {
            "id": _new_id(), "shop_id": sid(user),
            "party_type": "supplier", "party_id": sid_, "party_name": sup.get("name", ""),
            "direction": "out", "amount": amt, "method": data.method,
            "notes": data.notes or "", "user_id": user["id"],
            "date": data.date or _utc().date().isoformat(),
            "created_at": _iso(_utc()),
        }
        await db.payments.insert_one(doc)
        await db.suppliers.update_one(
            {"id": sid_, "shop_id": sid(user)}, {"$inc": {"balance": -amt}}
        )
        doc.pop("_id", None)
        return doc

    @api.get("/customers/{cid}/statement")
    async def customer_statement(cid: str, date_from: Optional[str] = None, date_to: Optional[str] = None, user=Depends(require_shop_user)):
        cust = await db.customers.find_one({"id": cid, "shop_id": sid(user)}, {"_id": 0})
        if not cust:
            raise HTTPException(404, "العميل غير موجود")
        entries = []
        opening = float(cust.get("opening_balance", 0) or 0)
        if opening:
            entries.append({"date": (cust.get("created_at") or "")[:10], "ref": "رصيد افتتاحي",
                            "description": "رصيد افتتاحي", "debit": opening, "credit": 0})
        sales = await db.sales.find({"shop_id": sid(user), "customer_id": cid}, {"_id": 0}).to_list(5000)
        for s in sales:
            if s.get("payment_method") == "credit":
                total = float(s.get("total", 0))
                paid = float(s.get("paid", 0))
                net = total - paid
                if s.get("is_return"):
                    entries.append({"date": (s.get("created_at") or "")[:10], "ref": f"INV-{s.get('invoice_no')}",
                                    "description": f"مرتجع فاتورة #{s.get('invoice_no')}",
                                    "debit": 0, "credit": abs(net)})
                else:
                    entries.append({"date": (s.get("created_at") or "")[:10], "ref": f"INV-{s.get('invoice_no')}",
                                    "description": f"فاتورة بيع آجل #{s.get('invoice_no')}",
                                    "debit": net, "credit": 0})
        pays = await db.payments.find({"shop_id": sid(user), "party_type": "customer", "party_id": cid}, {"_id": 0}).to_list(5000)
        for p in pays:
            entries.append({"date": (p.get("date") or "")[:10], "ref": "PAY",
                            "description": f"تحصيل ({p.get('method')})",
                            "debit": 0, "credit": float(p.get("amount", 0))})
        entries.sort(key=lambda e: e["date"])
        # Compute running balance across ALL entries first
        bal = 0
        for e in entries:
            bal += e["debit"] - e["credit"]
            e["balance"] = round(bal, 2)
        # Then filter visible rows by date range (balance still reflects full history)
        if date_from:
            entries = [e for e in entries if e["date"] >= date_from]
        if date_to:
            entries = [e for e in entries if e["date"] <= date_to]
        period_debit = round(sum(e["debit"] for e in entries), 2)
        period_credit = round(sum(e["credit"] for e in entries), 2)
        return {"customer": cust, "entries": entries, "closing_balance": round(bal, 2),
                "period_debit": period_debit, "period_credit": period_credit,
                "date_from": date_from, "date_to": date_to}

    @api.get("/suppliers/{sid_}/statement")
    async def supplier_statement(sid_: str, date_from: Optional[str] = None, date_to: Optional[str] = None, user=Depends(require_shop_user)):
        sup = await db.suppliers.find_one({"id": sid_, "shop_id": sid(user)}, {"_id": 0})
        if not sup:
            raise HTTPException(404, "المورد غير موجود")
        entries = []
        opening = float(sup.get("opening_balance", 0) or 0)
        if opening:
            entries.append({"date": (sup.get("created_at") or "")[:10], "ref": "رصيد افتتاحي",
                            "description": "رصيد افتتاحي", "debit": 0, "credit": opening})
        purs = await db.purchases.find({"shop_id": sid(user), "supplier_id": sid_}, {"_id": 0}).to_list(5000)
        for p in purs:
            total = float(p.get("total", 0))
            paid = float(p.get("paid", 0))
            net = total - paid
            if p.get("is_return"):
                entries.append({"date": (p.get("created_at") or "")[:10], "ref": f"PO-{p.get('invoice_no')}",
                                "description": f"مرتجع مشتريات #{p.get('invoice_no')}",
                                "debit": abs(net), "credit": 0})
            else:
                entries.append({"date": (p.get("created_at") or "")[:10], "ref": f"PO-{p.get('invoice_no')}",
                                "description": f"فاتورة مشتريات #{p.get('invoice_no')}",
                                "debit": 0, "credit": net})
        pays = await db.payments.find({"shop_id": sid(user), "party_type": "supplier", "party_id": sid_}, {"_id": 0}).to_list(5000)
        for p in pays:
            entries.append({"date": (p.get("date") or "")[:10], "ref": "PAY",
                            "description": f"تسديد ({p.get('method')})",
                            "debit": float(p.get("amount", 0)), "credit": 0})
        entries.sort(key=lambda e: e["date"])
        bal = 0
        for e in entries:
            bal += e["credit"] - e["debit"]
            e["balance"] = round(bal, 2)
        if date_from:
            entries = [e for e in entries if e["date"] >= date_from]
        if date_to:
            entries = [e for e in entries if e["date"] <= date_to]
        period_debit = round(sum(e["debit"] for e in entries), 2)
        period_credit = round(sum(e["credit"] for e in entries), 2)
        return {"supplier": sup, "entries": entries, "closing_balance": round(bal, 2),
                "period_debit": period_debit, "period_credit": period_credit,
                "date_from": date_from, "date_to": date_to}

    # ============ Product Movement (Kardex) & Dead Stock ============
    @api.get("/products/{pid}/movements")
    async def product_movements(pid: str, user=Depends(require_shop_user)):
        prod = await db.products.find_one({"id": pid, "shop_id": sid(user)}, {"_id": 0})
        if not prod:
            raise HTTPException(404, "الصنف غير موجود")
        moves = []
        purs = await db.purchases.find({"shop_id": sid(user), "items.product_id": pid}, {"_id": 0}).to_list(5000)
        for p in purs:
            for it in p.get("items", []):
                if it.get("product_id") == pid:
                    qty = float(it.get("qty", 0))
                    if p.get("is_return"):
                        moves.append({"date": (p.get("created_at") or "")[:16].replace("T", " "),
                                      "ref": f"PO-{p.get('invoice_no')}",
                                      "type": "مرتجع مشتريات", "in": 0, "out": qty,
                                      "price": float(it.get("cost") or it.get("price", 0)),
                                      "party": p.get("supplier_name") or "—"})
                    else:
                        moves.append({"date": (p.get("created_at") or "")[:16].replace("T", " "),
                                      "ref": f"PO-{p.get('invoice_no')}",
                                      "type": "شراء", "in": qty, "out": 0,
                                      "price": float(it.get("cost") or it.get("price", 0)),
                                      "party": p.get("supplier_name") or "—"})
        sls = await db.sales.find({"shop_id": sid(user), "items.product_id": pid}, {"_id": 0}).to_list(5000)
        for s in sls:
            for it in s.get("items", []):
                if it.get("product_id") == pid:
                    qty = float(it.get("qty", 0))
                    if s.get("is_return"):
                        moves.append({"date": (s.get("created_at") or "")[:16].replace("T", " "),
                                      "ref": f"INV-{s.get('invoice_no')}",
                                      "type": "مرتجع مبيعات", "in": qty, "out": 0,
                                      "price": float(it.get("price", 0)),
                                      "party": s.get("customer_name") or "—"})
                    else:
                        moves.append({"date": (s.get("created_at") or "")[:16].replace("T", " "),
                                      "ref": f"INV-{s.get('invoice_no')}",
                                      "type": "بيع", "in": 0, "out": qty,
                                      "price": float(it.get("price", 0)),
                                      "party": s.get("customer_name") or "—"})
        tfs = await db.transfers.find({"shop_id": sid(user), "items.product_id": pid}, {"_id": 0}).to_list(5000)
        for t in tfs:
            for it in t.get("items", []):
                if it.get("product_id") == pid:
                    qty = float(it.get("qty", 0))
                    moves.append({"date": (t.get("created_at") or "")[:16].replace("T", " "),
                                  "ref": f"TRN-{t.get('transfer_no', '')}",
                                  "type": "تحويل", "in": 0, "out": qty, "price": 0,
                                  "party": "تحويل بين المخازن"})
        adjs = await db.inventory_adjustments.find({"shop_id": sid(user), "items.product_id": pid}, {"_id": 0}).to_list(5000)
        for a in adjs:
            for it in a.get("items", []):
                if it.get("product_id") == pid:
                    delta = float(it.get("delta", 0))
                    moves.append({"date": (a.get("created_at") or "")[:16].replace("T", " "),
                                  "ref": f"ADJ-{a.get('adj_no', '')}",
                                  "type": "تسوية",
                                  "in": delta if delta > 0 else 0,
                                  "out": -delta if delta < 0 else 0,
                                  "price": 0, "party": a.get("reason") or "تسوية"})
        moves.sort(key=lambda m: m["date"])
        bal = 0
        for m in moves:
            bal += m["in"] - m["out"]
            m["balance"] = round(bal, 2)
        return {"product": prod, "movements": moves, "closing": round(bal, 2)}

    @api.get("/inventory/dead-stock")
    async def dead_stock(days: int = 60, user=Depends(require_shop_user)):
        cutoff = (_utc() - timedelta(days=days)).isoformat()
        active_pipeline = [
            {"$match": {"shop_id": sid(user), "created_at": {"$gte": cutoff}, "is_return": {"$ne": True}}},
            {"$unwind": "$items"},
            {"$group": {"_id": "$items.product_id"}}
        ]
        active = set()
        async for r in db.sales.aggregate(active_pipeline):
            active.add(r["_id"])
        products = await db.products.find({"shop_id": sid(user), "is_active": True}, {"_id": 0}).to_list(10000)
        dead = []
        for p in products:
            if p["id"] not in active and float(p.get("stock", 0)) > 0:
                dead.append({
                    "id": p["id"], "name": p["name"], "barcode": p.get("barcode", ""),
                    "stock": float(p.get("stock", 0)),
                    "cost_price": float(p.get("cost_price", 0)),
                    "value": round(float(p.get("stock", 0)) * float(p.get("cost_price", 0)), 2),
                    "last_update": (p.get("created_at") or "")[:10],
                })
        dead.sort(key=lambda x: -x["value"])
        total_value = round(sum(d["value"] for d in dead), 2)
        return {"days": days, "count": len(dead), "total_value": total_value, "items": dead}

    # ============ Cashbox ============
    async def _cashbox_calc(user):
        pipeline_sales = [
            {"$match": {"shop_id": sid(user), "payment_method": {"$in": ["cash", "card"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]
        sr = await db.sales.aggregate(pipeline_sales).to_list(1)
        cash_sales = sr[0]["total"] if sr else 0
        er = await db.expenses.aggregate([{"$match": {"shop_id": sid(user)}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        expenses = er[0]["total"] if er else 0
        pr = await db.purchases.aggregate([
            {"$match": {"shop_id": sid(user), "is_return": {"$ne": True}}},
            {"$group": {"_id": None, "total": {"$sum": "$paid"}}}
        ]).to_list(1)
        pur_paid = pr[0]["total"] if pr else 0
        cust_in = await db.payments.aggregate([
            {"$match": {"shop_id": sid(user), "direction": "in", "method": {"$ne": "bank"}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        sup_out = await db.payments.aggregate([
            {"$match": {"shop_id": sid(user), "direction": "out", "method": {"$ne": "bank"}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        cash_balance = round(cash_sales + (cust_in[0]["total"] if cust_in else 0) - expenses - pur_paid - (sup_out[0]["total"] if sup_out else 0), 2)
        bank_in = await db.payments.aggregate([
            {"$match": {"shop_id": sid(user), "direction": "in", "method": "bank"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        bank_out = await db.payments.aggregate([
            {"$match": {"shop_id": sid(user), "direction": "out", "method": "bank"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        bank_balance = round((bank_in[0]["total"] if bank_in else 0) - (bank_out[0]["total"] if bank_out else 0), 2)
        return {"cash": cash_balance, "bank": bank_balance, "total": round(cash_balance + bank_balance, 2)}

    @api.get("/cashbox/balance")
    async def cashbox_balance(user=Depends(require_shop_user)):
        return await _cashbox_calc(user)

    @api.get("/cashbox/movements")
    async def cashbox_movements(days: int = 30, user=Depends(require_shop_user)):
        cutoff = (_utc() - timedelta(days=days)).isoformat()
        rows = []
        sls = await db.sales.find({"shop_id": sid(user), "created_at": {"$gte": cutoff}, "payment_method": {"$in": ["cash", "card"]}}, {"_id": 0}).to_list(5000)
        for s in sls:
            rows.append({"date": (s.get("created_at") or "")[:16].replace("T", " "),
                         "type": "فاتورة بيع" if not s.get("is_return") else "مرتجع بيع",
                         "ref": f"INV-{s.get('invoice_no')}", "party": s.get("customer_name") or "—",
                         "in": s.get("total", 0) if not s.get("is_return") else 0,
                         "out": abs(s.get("total", 0)) if s.get("is_return") else 0,
                         "method": s.get("payment_method", "cash")})
        ex = await db.expenses.find({"shop_id": sid(user), "created_at": {"$gte": cutoff}}, {"_id": 0}).to_list(5000)
        for e in ex:
            rows.append({"date": (e.get("created_at") or "")[:16].replace("T", " "),
                         "type": "مصروف", "ref": (e.get("id") or "")[:8],
                         "party": e.get("category", ""),
                         "in": 0, "out": e.get("amount", 0), "method": "cash"})
        purs = await db.purchases.find({"shop_id": sid(user), "created_at": {"$gte": cutoff}, "paid": {"$gt": 0}}, {"_id": 0}).to_list(5000)
        for p in purs:
            rows.append({"date": (p.get("created_at") or "")[:16].replace("T", " "),
                         "type": "دفع مشتريات", "ref": f"PO-{p.get('invoice_no')}",
                         "party": p.get("supplier_name") or "—",
                         "in": 0, "out": p.get("paid", 0), "method": "cash"})
        pays = await db.payments.find({"shop_id": sid(user), "created_at": {"$gte": cutoff}}, {"_id": 0}).to_list(5000)
        for p in pays:
            is_in = p.get("direction") == "in"
            rows.append({"date": (p.get("date") or "")[:10],
                         "type": "تحصيل" if is_in else "تسديد",
                         "ref": "PAY", "party": p.get("party_name", ""),
                         "in": p.get("amount", 0) if is_in else 0,
                         "out": p.get("amount", 0) if not is_in else 0,
                         "method": p.get("method", "cash")})
        rows.sort(key=lambda r: r["date"], reverse=True)
        total_in = round(sum(r["in"] for r in rows), 2)
        total_out = round(sum(r["out"] for r in rows), 2)
        return {"days": days, "total_in": total_in, "total_out": total_out,
                "net": round(total_in - total_out, 2), "rows": rows}

    # ============ Advanced Reports ============
    @api.get("/reports/daily-sales")
    async def daily_sales(days: int = 30, user=Depends(require_shop_user)):
        cutoff = (_utc() - timedelta(days=days)).isoformat()
        pipe = [
            {"$match": {"shop_id": sid(user), "created_at": {"$gte": cutoff}}},
            {"$group": {"_id": {"$substr": ["$created_at", 0, 10]},
                        "count": {"$sum": 1},
                        "total": {"$sum": "$total"},
                        "profit": {"$sum": "$profit"},
                        "cost": {"$sum": "$cost_total"}}},
            {"$sort": {"_id": -1}}
        ]
        rows = []
        async for r in db.sales.aggregate(pipe):
            rows.append({"date": r["_id"], "count": r["count"],
                         "total": round(r["total"], 2),
                         "cost": round(r["cost"], 2),
                         "profit": round(r["profit"], 2)})
        return {"days": days, "rows": rows}

    @api.get("/reports/purchases-summary")
    async def purchases_summary(days: int = 30, user=Depends(require_shop_user)):
        cutoff = (_utc() - timedelta(days=days)).isoformat()
        pipe = [
            {"$match": {"shop_id": sid(user), "created_at": {"$gte": cutoff}}},
            {"$group": {"_id": "$supplier_name", "count": {"$sum": 1}, "total": {"$sum": "$total"}}},
            {"$sort": {"total": -1}}
        ]
        rows = []
        async for r in db.purchases.aggregate(pipe):
            rows.append({"supplier": r["_id"] or "بدون مورد", "count": r["count"], "total": round(r["total"], 2)})
        total_all = round(sum(r["total"] for r in rows), 2)
        return {"days": days, "total": total_all, "rows": rows}

    @api.get("/reports/top-products")
    async def top_products(days: int = 30, limit: int = 20, user=Depends(require_shop_user)):
        cutoff = (_utc() - timedelta(days=days)).isoformat()
        pipe = [
            {"$match": {"shop_id": sid(user), "created_at": {"$gte": cutoff}, "is_return": {"$ne": True}}},
            {"$unwind": "$items"},
            {"$group": {"_id": {"id": "$items.product_id", "name": "$items.name"},
                        "qty": {"$sum": "$items.qty"},
                        "revenue": {"$sum": {"$multiply": ["$items.qty", "$items.price"]}},
                        "count": {"$sum": 1}}},
            {"$sort": {"qty": -1}},
            {"$limit": limit}
        ]
        rows = []
        async for r in db.sales.aggregate(pipe):
            rows.append({"product_id": r["_id"].get("id"), "name": r["_id"].get("name"),
                         "qty": round(r["qty"], 2), "revenue": round(r["revenue"], 2),
                         "times": r["count"]})
        return {"days": days, "rows": rows}

    @api.get("/reports/sales-by-cashier")
    async def sales_by_cashier(days: int = 30, user=Depends(require_shop_user)):
        cutoff = (_utc() - timedelta(days=days)).isoformat()
        pipe = [
            {"$match": {"shop_id": sid(user), "created_at": {"$gte": cutoff}}},
            {"$group": {"_id": {"id": "$cashier_id", "name": "$cashier_name"},
                        "count": {"$sum": 1},
                        "total": {"$sum": "$total"},
                        "profit": {"$sum": "$profit"}}},
            {"$sort": {"total": -1}}
        ]
        rows = []
        async for r in db.sales.aggregate(pipe):
            rows.append({"cashier": r["_id"].get("name") or "—",
                         "count": r["count"],
                         "total": round(r["total"], 2),
                         "profit": round(r["profit"], 2)})
        return {"days": days, "rows": rows}

    @api.get("/reports/sales-by-category")
    async def sales_by_category(days: int = 30, user=Depends(require_shop_user)):
        cutoff = (_utc() - timedelta(days=days)).isoformat()
        prods = await db.products.find({"shop_id": sid(user)}, {"_id": 0, "id": 1, "category_id": 1}).to_list(10000)
        prod_cat = {p["id"]: p.get("category_id") for p in prods}
        cats = await db.categories.find({"shop_id": sid(user)}, {"_id": 0}).to_list(1000)
        cat_name = {c["id"]: c["name"] for c in cats}
        totals = {}
        sls = await db.sales.find({"shop_id": sid(user), "created_at": {"$gte": cutoff}, "is_return": {"$ne": True}}, {"_id": 0}).to_list(10000)
        for s in sls:
            for it in s.get("items", []):
                cid = prod_cat.get(it.get("product_id"))
                key = cat_name.get(cid, "بدون فئة") if cid else "بدون فئة"
                row = totals.setdefault(key, {"category": key, "qty": 0, "revenue": 0})
                row["qty"] += float(it.get("qty", 0))
                row["revenue"] += float(it.get("qty", 0)) * float(it.get("price", 0))
        rows = sorted(totals.values(), key=lambda r: -r["revenue"])
        return {"days": days, "rows": [{"category": r["category"], "qty": round(r["qty"], 2), "revenue": round(r["revenue"], 2)} for r in rows]}

    @api.get("/reports/balance-sheet")
    async def balance_sheet(user=Depends(require_shop_user)):
        shop = sid(user)
        prods = await db.products.find({"shop_id": shop}, {"_id": 0, "stock": 1, "cost_price": 1}).to_list(10000)
        inv_value = round(sum(float(p.get("stock", 0)) * float(p.get("cost_price", 0)) for p in prods), 2)
        cb = await _cashbox_calc(user)
        custs = await db.customers.find({"shop_id": shop}, {"_id": 0, "balance": 1}).to_list(5000)
        receivable = round(sum(float(c.get("balance", 0)) for c in custs if float(c.get("balance", 0)) > 0), 2)
        fa = await db.fixed_assets.find({"shop_id": shop}, {"_id": 0, "current_value": 1}).to_list(1000)
        fixed_assets = round(sum(float(a.get("current_value", 0)) for a in fa), 2)
        sups = await db.suppliers.find({"shop_id": shop}, {"_id": 0, "balance": 1}).to_list(5000)
        payable = round(sum(float(s.get("balance", 0)) for s in sups if float(s.get("balance", 0)) > 0), 2)
        total_assets = round(inv_value + cb["cash"] + cb["bank"] + receivable + fixed_assets, 2)
        total_liab = payable
        equity = round(total_assets - total_liab, 2)
        return {
            "assets": {"cash": cb["cash"], "bank": cb["bank"], "inventory": inv_value,
                       "receivable": receivable, "fixed_assets": fixed_assets, "total": total_assets},
            "liabilities": {"payable": payable, "total": total_liab},
            "equity": {"net_worth": equity}
        }

    # ============ Daily Collections & Payments Report ============
    @api.get("/reports/daily-collections")
    async def daily_collections(date: Optional[str] = None, user=Depends(require_shop_user)):
        """تقرير القبض/الدفع اليومي - All in/out cash movements for a specific day."""
        day = date or _utc().date().isoformat()
        day_start = f"{day}T00:00:00"
        day_end = f"{day}T23:59:59.999"
        shop = sid(user)

        rows_in = []    # collections
        rows_out = []   # payments

        # 1) Cash/Card sales (receipts)
        sls = await db.sales.find({
            "shop_id": shop,
            "payment_method": {"$in": ["cash", "card"]},
            "created_at": {"$gte": day_start, "$lte": day_end},
        }, {"_id": 0}).to_list(5000)
        for s in sls:
            amt = float(s.get("total", 0) or 0)
            is_ret = s.get("is_return")
            if is_ret:
                rows_out.append({
                    "time": (s.get("created_at") or "")[11:16],
                    "type": "مرتجع بيع",
                    "ref": f"INV-{s.get('invoice_no')}",
                    "party": s.get("customer_name") or "عميل نقدي",
                    "method": s.get("payment_method", "cash"),
                    "amount": round(abs(amt), 2),
                    "notes": "",
                })
            else:
                rows_in.append({
                    "time": (s.get("created_at") or "")[11:16],
                    "type": "فاتورة بيع",
                    "ref": f"INV-{s.get('invoice_no')}",
                    "party": s.get("customer_name") or "عميل نقدي",
                    "method": s.get("payment_method", "cash"),
                    "amount": round(amt, 2),
                    "notes": s.get("cashier_name") or "",
                })

        # 2) Customer / Supplier payments
        pays = await db.payments.find({
            "shop_id": shop,
            "date": day,
        }, {"_id": 0}).to_list(5000)
        for p in pays:
            is_in = p.get("direction") == "in"
            row = {
                "time": (p.get("created_at") or "")[11:16],
                "type": "تحصيل من عميل" if is_in else "تسديد لمورد",
                "ref": "PAY",
                "party": p.get("party_name") or "—",
                "method": p.get("method", "cash"),
                "amount": round(float(p.get("amount", 0) or 0), 2),
                "notes": p.get("notes") or "",
            }
            (rows_in if is_in else rows_out).append(row)

        # 3) Expenses (payments out)
        ex = await db.expenses.find({
            "shop_id": shop,
            "created_at": {"$gte": day_start, "$lte": day_end},
        }, {"_id": 0}).to_list(5000)
        for e in ex:
            rows_out.append({
                "time": (e.get("created_at") or "")[11:16],
                "type": "مصروف",
                "ref": (e.get("id") or "")[:8].upper(),
                "party": e.get("category") or "—",
                "method": "cash",
                "amount": round(float(e.get("amount", 0) or 0), 2),
                "notes": e.get("notes") or "",
            })

        # 4) Purchases paid cash (payments out)
        purs = await db.purchases.find({
            "shop_id": shop,
            "paid": {"$gt": 0},
            "created_at": {"$gte": day_start, "$lte": day_end},
        }, {"_id": 0}).to_list(5000)
        for p in purs:
            rows_out.append({
                "time": (p.get("created_at") or "")[11:16],
                "type": "دفع فاتورة مشتريات",
                "ref": f"PO-{p.get('invoice_no')}",
                "party": p.get("supplier_name") or "—",
                "method": "cash",
                "amount": round(float(p.get("paid", 0) or 0), 2),
                "notes": "",
            })

        rows_in.sort(key=lambda r: r["time"])
        rows_out.sort(key=lambda r: r["time"])

        total_in = round(sum(r["amount"] for r in rows_in), 2)
        total_out = round(sum(r["amount"] for r in rows_out), 2)

        # Group totals by method
        def _by_method(rows):
            m = {}
            for r in rows:
                k = r.get("method", "cash")
                m[k] = round(m.get(k, 0) + r["amount"], 2)
            return m

        return {
            "date": day,
            "total_in": total_in,
            "total_out": total_out,
            "net": round(total_in - total_out, 2),
            "count_in": len(rows_in),
            "count_out": len(rows_out),
            "by_method_in": _by_method(rows_in),
            "by_method_out": _by_method(rows_out),
            "rows_in": rows_in,
            "rows_out": rows_out,
        }

