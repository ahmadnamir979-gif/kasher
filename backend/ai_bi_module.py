"""
Al-Arraab AI Assistant + BI Dashboard + Excel Templates
- AI: natural-language Arabic Q&A over the shop's data using Emergent LLM key
- Dashboard KPIs: comprehensive metrics
- Excel Templates: downloadable .xlsx with data + basic pivot
"""
from fastapi import HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.chart import BarChart, PieChart, Reference
import io
import os
import uuid
import json


def _sid(u): return u["shop_id"]
def _now(): return datetime.now(timezone.utc)
def _iso(): return _now().isoformat()


class AskIn(BaseModel):
    question: str
    session_id: Optional[str] = None


async def _gather_shop_context(db, shop_id: str):
    """Build a compact JSON snapshot of the shop's key metrics for the LLM."""
    now = _now()
    today_start = now.strftime("%Y-%m-%d") + "T00:00:00"
    month_start = now.strftime("%Y-%m") + "-01T00:00:00"
    thirty_ago = (now - timedelta(days=30)).isoformat()

    # Aggregate sales
    sales_today = await db.sales.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": today_start}, "is_return": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "profit": {"$sum": "$profit"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    sales_month = await db.sales.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": month_start}, "is_return": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "profit": {"$sum": "$profit"}, "count": {"$sum": 1}}},
    ]).to_list(1)

    # Top products (last 30 days by profit)
    top_products = await db.sales.aggregate([
        {"$match": {"shop_id": shop_id, "created_at": {"$gte": thirty_ago}, "is_return": {"$ne": True}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "qty": {"$sum": "$items.qty"}, "revenue": {"$sum": {"$multiply": ["$items.qty", "$items.price"]}}}},
        {"$sort": {"revenue": -1}},
        {"$limit": 10},
    ]).to_list(10)

    low_stock = await db.products.count_documents({"shop_id": shop_id, "$expr": {"$lte": ["$stock", "$min_stock"]}})
    total_customers = await db.customers.count_documents({"shop_id": shop_id})
    total_receivables = await db.customers.aggregate([
        {"$match": {"shop_id": shop_id}},
        {"$group": {"_id": None, "total": {"$sum": "$balance"}}},
    ]).to_list(1)
    total_payables = await db.suppliers.aggregate([
        {"$match": {"shop_id": shop_id}},
        {"$group": {"_id": None, "total": {"$sum": "$balance"}}},
    ]).to_list(1)

    return {
        "date": now.strftime("%Y-%m-%d"),
        "sales_today": sales_today[0] if sales_today else {"total": 0, "profit": 0, "count": 0},
        "sales_month": sales_month[0] if sales_month else {"total": 0, "profit": 0, "count": 0},
        "top_products_30d": [{"name": p["_id"], "qty": p["qty"], "revenue": round(p["revenue"], 2)} for p in top_products],
        "low_stock_count": low_stock,
        "total_customers": total_customers,
        "total_receivables": round((total_receivables[0]["total"] if total_receivables else 0), 2),
        "total_payables": round((total_payables[0]["total"] if total_payables else 0), 2),
    }


def register(api, db, require_shop_user):

    # ---------- AI Assistant ----------
    @api.post("/ai/ask")
    async def ai_ask(data: AskIn, user=Depends(require_shop_user)):
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
        except Exception:
            raise HTTPException(500, "AI library not available")
        key = os.environ.get("EMERGENT_LLM_KEY")
        if not key:
            raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

        context = await _gather_shop_context(db, _sid(user))
        session_id = data.session_id or str(uuid.uuid4())
        system = (
            "أنت مساعد ذكي عربي لصاحب محل تجاري. تجيب بإيجاز ودقة بناءً على بيانات المحل المزوّدة أدناه.\n"
            "- إذا كان السؤال يخص أرقاماً، اذكرها بوضوح.\n"
            "- إذا كان السؤال خارج نطاق البيانات، اطلب توضيحاً بلطف.\n"
            "- لا تخترع أرقاماً. استخدم فقط ما هو موجود في السياق.\n"
            "- ردّك يجب أن يكون بصيغة JSON بالشكل: {\"answer\": \"إجابتك بالعربي\", \"chart\": null}\n"
            "- إذا كان السؤال يستدعي عرض قائمة (مثل أفضل المنتجات)، اجعل chart بالشكل:\n"
            "  {\"type\": \"bar\", \"labels\": [...], \"values\": [...], \"title\": \"...\"}\n"
            "- بيانات المحل الحالية بصيغة JSON:\n"
            + json.dumps(context, ensure_ascii=False, default=str)
        )
        chat = LlmChat(api_key=key, session_id=session_id, system_message=system)
        chat = chat.with_model("openai", "gpt-4o-mini")
        try:
            reply = await chat.send_message(UserMessage(text=data.question))
        except Exception as e:
            raise HTTPException(502, f"AI error: {e}")
        # Try parsing JSON from reply
        text = str(reply).strip()
        if text.startswith("```"):
            text = text.strip("`").split("\n", 1)[-1]
            if text.endswith("```"):
                text = text[:-3]
        parsed = None
        try:
            parsed = json.loads(text)
        except Exception:
            parsed = {"answer": text, "chart": None}
        # Store history
        await db.ai_history.insert_one({
            "id": str(uuid.uuid4()),
            "shop_id": _sid(user),
            "user_id": user["id"],
            "session_id": session_id,
            "question": data.question,
            "answer": parsed.get("answer", ""),
            "chart": parsed.get("chart"),
            "created_at": _iso(),
        })
        return {
            "session_id": session_id,
            "answer": parsed.get("answer", text),
            "chart": parsed.get("chart"),
            "context_snapshot": context,
        }

    @api.get("/ai/history")
    async def ai_history(user=Depends(require_shop_user), limit: int = 20):
        return await db.ai_history.find({"shop_id": _sid(user)}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    # ---------- BI Dashboard KPIs ----------
    @api.get("/dashboard/kpis")
    async def dashboard_kpis(user=Depends(require_shop_user)):
        now = _now()
        today_start = now.strftime("%Y-%m-%d") + "T00:00:00"
        yesterday_start = (now - timedelta(days=1)).strftime("%Y-%m-%d") + "T00:00:00"
        week_start = (now - timedelta(days=7)).isoformat()
        month_start = now.strftime("%Y-%m") + "-01T00:00:00"

        async def agg_sales(from_ts):
            r = await db.sales.aggregate([
                {"$match": {"shop_id": _sid(user), "created_at": {"$gte": from_ts}, "is_return": {"$ne": True}}},
                {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "profit": {"$sum": "$profit"}, "count": {"$sum": 1}}},
            ]).to_list(1)
            return r[0] if r else {"revenue": 0, "profit": 0, "count": 0}

        today = await agg_sales(today_start)
        yesterday = await agg_sales(yesterday_start)
        # Truncate yesterday to just yesterday range
        yest_end = today_start
        yest = await db.sales.aggregate([
            {"$match": {"shop_id": _sid(user), "created_at": {"$gte": yesterday_start, "$lt": yest_end}, "is_return": {"$ne": True}}},
            {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "profit": {"$sum": "$profit"}}},
        ]).to_list(1)
        yest = yest[0] if yest else {"revenue": 0, "profit": 0}
        week = await agg_sales(week_start)
        month = await agg_sales(month_start)

        # Sales last 30 days by day (for sparkline)
        daily = await db.sales.aggregate([
            {"$match": {"shop_id": _sid(user), "created_at": {"$gte": (now - timedelta(days=30)).isoformat()}, "is_return": {"$ne": True}}},
            {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "revenue": {"$sum": "$total"}, "profit": {"$sum": "$profit"}}},
            {"$sort": {"_id": 1}},
        ]).to_list(35)

        # Top categories this month
        top_cats = await db.sales.aggregate([
            {"$match": {"shop_id": _sid(user), "created_at": {"$gte": month_start}, "is_return": {"$ne": True}}},
            {"$unwind": "$items"},
            {"$lookup": {"from": "products", "localField": "items.product_id", "foreignField": "id", "as": "p"}},
            {"$unwind": {"path": "$p", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {"from": "categories", "localField": "p.category_id", "foreignField": "id", "as": "c"}},
            {"$unwind": {"path": "$c", "preserveNullAndEmptyArrays": True}},
            {"$group": {"_id": {"$ifNull": ["$c.name", "غير مصنّف"]}, "revenue": {"$sum": {"$multiply": ["$items.qty", "$items.price"]}}}},
            {"$sort": {"revenue": -1}},
            {"$limit": 8},
        ]).to_list(8)

        # Stock health
        low_stock = await db.products.count_documents({"shop_id": _sid(user), "$expr": {"$lte": ["$stock", "$min_stock"]}, "min_stock": {"$gt": 0}})
        out_of_stock = await db.products.count_documents({"shop_id": _sid(user), "stock": {"$lte": 0}})
        total_products = await db.products.count_documents({"shop_id": _sid(user)})

        # Receivables & payables
        receivables = await db.customers.aggregate([
            {"$match": {"shop_id": _sid(user), "balance": {"$gt": 0}}},
            {"$group": {"_id": None, "total": {"$sum": "$balance"}, "count": {"$sum": 1}}},
        ]).to_list(1)
        payables = await db.suppliers.aggregate([
            {"$match": {"shop_id": _sid(user), "balance": {"$gt": 0}}},
            {"$group": {"_id": None, "total": {"$sum": "$balance"}, "count": {"$sum": 1}}},
        ]).to_list(1)

        # Cash position (sum of asset accounts with is_cash or is_bank)
        cash_accts = await db.accounts.aggregate([
            {"$match": {"shop_id": _sid(user), "$or": [{"is_cash": True}, {"is_bank": True}]}},
            {"$group": {"_id": None, "total": {"$sum": "$balance"}}},
        ]).to_list(1)

        # Pending checks
        pending_checks = await db.checks.count_documents({"shop_id": _sid(user), "status": "pending"})

        # VAT this month
        try:
            month_sales = await db.sales.find({"shop_id": _sid(user), "created_at": {"$gte": month_start}}, {"_id": 0}).to_list(10000)
            vat_output = 0
            for s in month_sales:
                sign = -1 if s.get("is_return") else 1
                for it in s.get("items", []):
                    sub = it.get("qty", 0) * it.get("price", 0) - it.get("discount", 0)
                    rate = it.get("tax_rate", 0) / 100.0
                    if rate > 0:
                        base = sub / (1 + rate)
                        vat_output += (sub - base) * sign
        except Exception:
            vat_output = 0

        return {
            "today": today,
            "yesterday": yest,
            "week": week,
            "month": month,
            "daily_series": [{"date": d["_id"], "revenue": round(d["revenue"], 2), "profit": round(d["profit"], 2)} for d in daily],
            "top_categories": [{"name": c["_id"], "revenue": round(c["revenue"], 2)} for c in top_cats],
            "stock": {
                "total": total_products,
                "low": low_stock,
                "out": out_of_stock,
            },
            "receivables": {"total": round((receivables[0]["total"] if receivables else 0), 2), "count": (receivables[0]["count"] if receivables else 0)},
            "payables": {"total": round((payables[0]["total"] if payables else 0), 2), "count": (payables[0]["count"] if payables else 0)},
            "cash_position": round((cash_accts[0]["total"] if cash_accts else 0), 2),
            "pending_checks": pending_checks,
            "vat_output_month": round(vat_output, 2),
        }

    # ---------- Excel Templates (Pivot-Ready) ----------
    @api.get("/live-data/template/{entity}.xlsx")
    async def template_xlsx(entity: str, user=Depends(require_shop_user)):
        # Reuse live_data ENTITIES config
        from live_data import ENTITIES, ENTITY_LABELS_AR
        if entity not in ENTITIES:
            raise HTTPException(404, "Unknown entity")
        conf = ENTITIES[entity]
        coll = getattr(db, conf["collection"])
        rows = await coll.find({"shop_id": _sid(user)}, {"_id": 0}).sort(conf["sort"], -1).to_list(20000)

        wb = Workbook()
        ws = wb.active
        ws.title = ENTITY_LABELS_AR.get(entity, entity)[:30]
        ws.sheet_view.rightToLeft = True

        if not rows:
            ws["A1"] = f"لا بيانات في {ENTITY_LABELS_AR.get(entity, entity)}"
            ws["A1"].font = Font(bold=True, size=14)
        else:
            # Flatten and gather keys
            def flat(d, pre=""):
                out = {}
                for k, v in d.items():
                    if isinstance(v, dict):
                        out.update(flat(v, f"{pre}{k}."))
                    elif isinstance(v, list):
                        out[f"{pre}{k}"] = len(v) if v and isinstance(v[0], dict) else ", ".join(str(x) for x in v)
                    else:
                        out[f"{pre}{k}"] = v
                return out
            flat_rows = [flat(r) for r in rows]
            keys = []
            seen = set()
            for r in flat_rows:
                for k in r.keys():
                    if k not in seen:
                        seen.add(k); keys.append(k)
            # Header
            for i, k in enumerate(keys, 1):
                c = ws.cell(row=1, column=i, value=k)
                c.font = Font(bold=True, color="FFFFFF")
                c.fill = PatternFill("solid", fgColor="1e293b")
                c.alignment = Alignment(horizontal="center")
            for r_idx, r in enumerate(flat_rows, 2):
                for c_idx, k in enumerate(keys, 1):
                    ws.cell(row=r_idx, column=c_idx, value=r.get(k))
            for col_letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[:min(26, len(keys))]:
                ws.column_dimensions[col_letter].width = 18

            # Add a Chart sheet if we have numeric data (sales/purchases)
            if entity in ("sales", "purchases") and len(flat_rows) > 0 and "total" in keys:
                chart_ws = wb.create_sheet("📊 رسم بياني")
                chart_ws.sheet_view.rightToLeft = True
                # Aggregate by created_at date
                agg = {}
                for r in flat_rows:
                    date = str(r.get("created_at", ""))[:10]
                    if not date:
                        continue
                    agg[date] = agg.get(date, 0) + float(r.get("total", 0) or 0)
                sorted_dates = sorted(agg.keys())
                chart_ws["A1"] = "التاريخ"; chart_ws["B1"] = "الإجمالي"
                for i, d in enumerate(sorted_dates, 2):
                    chart_ws.cell(row=i, column=1, value=d)
                    chart_ws.cell(row=i, column=2, value=agg[d])
                bar = BarChart()
                bar.title = f"{ENTITY_LABELS_AR.get(entity, entity)} حسب التاريخ"
                bar.style = 12
                data = Reference(chart_ws, min_col=2, min_row=1, max_row=len(sorted_dates) + 1)
                cats = Reference(chart_ws, min_col=1, min_row=2, max_row=len(sorted_dates) + 1)
                bar.add_data(data, titles_from_data=True)
                bar.set_categories(cats)
                chart_ws.add_chart(bar, "D2")

        buf = io.BytesIO()
        wb.save(buf); buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''Template-{entity}.xlsx"},
        )

    return api
