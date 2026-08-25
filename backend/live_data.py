"""
Al-Arraab Excel Live Link Module
Read-only CSV endpoints that Excel Power Query can consume with a shop-scoped
data token. Refreshing Excel pulls the latest data with no export step needed.
"""
from fastapi import HTTPException, Depends, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
import uuid
import csv
import io
import secrets


def _sid(u): return u["shop_id"]
def _new_id(): return str(uuid.uuid4())
def _now_iso(): return datetime.now(timezone.utc).isoformat()


ENTITIES = {
    "sales": {"collection": "sales", "sort": "created_at"},
    "purchases": {"collection": "purchases", "sort": "created_at"},
    "products": {"collection": "products", "sort": "name"},
    "customers": {"collection": "customers", "sort": "name"},
    "suppliers": {"collection": "suppliers", "sort": "name"},
    "expenses": {"collection": "expenses", "sort": "created_at"},
    "journal": {"collection": "journal_entries", "sort": "date"},
    "vouchers": {"collection": "vouchers", "sort": "created_at"},
    "accounts": {"collection": "accounts", "sort": "code"},
    "checks": {"collection": "checks", "sort": "due_date"},
    "fixed_assets": {"collection": "fixed_assets", "sort": "purchase_date"},
    "inventory_adjustments": {"collection": "inventory_adjustments", "sort": "created_at"},
    "installments": {"collection": "installment_plans", "sort": "created_at"},
    "orders": {"collection": "orders", "sort": "created_at"},
}


ENTITY_LABELS_AR = {
    "sales": "المبيعات",
    "purchases": "المشتريات",
    "products": "الأصناف",
    "customers": "العملاء",
    "suppliers": "الموردين",
    "expenses": "المصاريف",
    "journal": "اليومية العامة",
    "vouchers": "السندات",
    "accounts": "الحسابات",
    "checks": "الشيكات",
    "fixed_assets": "الأصول الثابتة",
    "inventory_adjustments": "ضبط المخازن",
    "installments": "التقسيط",
    "orders": "الطلبيات",
}


def _flatten(doc: dict, prefix: str = "") -> dict:
    """Flatten nested dicts and stringify lists for CSV output."""
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            for k2, v2 in _flatten(v, prefix=f"{key}.").items():
                out[k2] = v2
        elif isinstance(v, list):
            out[key] = str(len(v)) if v and isinstance(v[0], dict) else ", ".join(str(x) for x in v)
        elif isinstance(v, (datetime,)):
            out[key] = v.isoformat()
        else:
            out[key] = v
    return out


def _rows_to_csv(rows: list) -> str:
    """Return CSV text with UTF-8 BOM so Excel opens it in Arabic correctly."""
    if not rows:
        return "\ufeffNo Data\n"
    flat = [_flatten(r) for r in rows]
    # union of keys, ordered by first-seen
    all_keys = []
    seen = set()
    for r in flat:
        for k in r.keys():
            if k not in seen:
                seen.add(k)
                all_keys.append(k)
    buf = io.StringIO()
    buf.write("\ufeff")  # BOM for Excel Arabic
    writer = csv.DictWriter(buf, fieldnames=all_keys, extrasaction="ignore")
    writer.writeheader()
    for r in flat:
        writer.writerow(r)
    return buf.getvalue()


class LiveTokenOut(BaseModel):
    token: str
    created_at: str


def register(api, db, require_shop_user):
    """Register live-data (Excel Power Query) routes."""

    # ---------- Token management (authed) ----------
    @api.get("/live-data/token")
    async def get_token(user=Depends(require_shop_user)):
        shop = await db.shops.find_one({"id": _sid(user)}, {"_id": 0})
        return {
            "token": (shop or {}).get("live_data_token"),
            "generated_at": (shop or {}).get("live_data_token_at"),
        }

    @api.post("/live-data/token/rotate")
    async def rotate_token(user=Depends(require_shop_user)):
        tok = "lda_" + secrets.token_urlsafe(32)
        await db.shops.update_one(
            {"id": _sid(user)},
            {"$set": {"live_data_token": tok, "live_data_token_at": _now_iso()}},
        )
        return {"token": tok, "generated_at": _now_iso()}

    @api.delete("/live-data/token")
    async def revoke_token(user=Depends(require_shop_user)):
        await db.shops.update_one(
            {"id": _sid(user)},
            {"$unset": {"live_data_token": "", "live_data_token_at": ""}},
        )
        return {"ok": True}

    @api.get("/live-data/entities")
    async def list_entities(user=Depends(require_shop_user)):
        return [{"key": k, "label": ENTITY_LABELS_AR.get(k, k)} for k in ENTITIES.keys()]

    # ---------- Public CSV endpoints (token-only, no cookie/JWT) ----------
    async def _authorize_by_token(token: str):
        shop = await db.shops.find_one({"live_data_token": token}, {"_id": 0})
        if not shop:
            raise HTTPException(401, "Invalid or revoked live-data token")
        if not shop.get("is_active", True):
            raise HTTPException(403, "Shop suspended")
        return shop

    @api.get("/live/{entity}.csv", response_class=PlainTextResponse)
    async def live_csv(entity: str, token: str = Query(...), limit: int = 50000):
        if entity not in ENTITIES:
            raise HTTPException(404, "Unknown entity")
        shop = await _authorize_by_token(token)
        conf = ENTITIES[entity]
        coll = getattr(db, conf["collection"])
        rows = await coll.find({"shop_id": shop["id"]}, {"_id": 0}).sort(conf["sort"], -1).to_list(limit)
        return PlainTextResponse(
            content=_rows_to_csv(rows),
            media_type="text/csv; charset=utf-8",
            headers={"Cache-Control": "no-store"},
        )

    @api.get("/live/{entity}.json")
    async def live_json(entity: str, token: str = Query(...), limit: int = 50000):
        if entity not in ENTITIES:
            raise HTTPException(404, "Unknown entity")
        shop = await _authorize_by_token(token)
        conf = ENTITIES[entity]
        coll = getattr(db, conf["collection"])
        rows = await coll.find({"shop_id": shop["id"]}, {"_id": 0}).sort(conf["sort"], -1).to_list(limit)
        return rows

    return api
