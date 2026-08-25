"""
Al-Arraab Inventory Extras Module
- Product auto-numbering rules
- Bulk price adjustments (raise/lower prices by % or fixed amount)
- Inventory adjustment documents (damage, loss, count correction, expiry write-off)
- Product alternatives (substitutes)
"""
from fastapi import HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List, Literal
import uuid


def _sid(u): return u["shop_id"]
def _new_id(): return str(uuid.uuid4())
def _now_iso(): return datetime.now(timezone.utc).isoformat()


class NumberingRuleIn(BaseModel):
    prefix: str = ""  # e.g., "SKU-", or "" for pure number
    next_number: int = 1
    pad_width: int = 5  # zero-padding, e.g., 00001
    enabled: bool = True


class BulkPriceIn(BaseModel):
    scope: Literal["all", "category", "specific"] = "all"
    category_id: Optional[str] = None
    product_ids: Optional[List[str]] = None
    field: Literal["sale_price", "cost_price"] = "sale_price"
    operation: Literal["percent_up", "percent_down", "amount_up", "amount_down", "set"]
    value: float
    round_to: Optional[float] = None  # e.g., 0.5, 1, 5 — round to nearest


class InvAdjItem(BaseModel):
    product_id: str
    name: str
    delta: float  # positive for increase, negative for decrease
    notes: Optional[str] = ""


class InventoryAdjustmentIn(BaseModel):
    kind: Literal["damage", "loss", "count", "expiry_writeoff", "correction", "opening"]
    warehouse_id: Optional[str] = None
    items: List[InvAdjItem]
    reason: str = ""
    notes: Optional[str] = ""


class AlternativeIn(BaseModel):
    product_id: str
    alt_product_id: str
    notes: Optional[str] = ""


KIND_LABELS = {
    "damage": "تلف",
    "loss": "فقد",
    "count": "جرد",
    "expiry_writeoff": "شطب لانتهاء الصلاحية",
    "correction": "تعديل",
    "opening": "جرد أول المدة",
}


def register(api, db, require_shop_user):
    """Register all inventory extras routes."""

    # ---------- Product Numbering Rule ----------
    @api.get("/inventory/numbering-rule")
    async def get_rule(user=Depends(require_shop_user)):
        rule = await db.numbering_rules.find_one({"shop_id": _sid(user)}, {"_id": 0})
        if not rule:
            rule = {
                "id": _new_id(), "shop_id": _sid(user),
                "prefix": "", "next_number": 1, "pad_width": 5, "enabled": False,
                "created_at": _now_iso(),
            }
            await db.numbering_rules.insert_one(dict(rule))
        return rule

    @api.put("/inventory/numbering-rule")
    async def set_rule(data: NumberingRuleIn, user=Depends(require_shop_user)):
        payload = data.model_dump()
        await db.numbering_rules.update_one(
            {"shop_id": _sid(user)},
            {"$set": {**payload, "shop_id": _sid(user), "updated_at": _now_iso()}},
            upsert=True,
        )
        return {"ok": True}

    @api.get("/inventory/numbering-rule/next")
    async def preview_next(user=Depends(require_shop_user)):
        rule = await db.numbering_rules.find_one({"shop_id": _sid(user)}, {"_id": 0})
        if not rule or not rule.get("enabled"):
            return {"enabled": False}
        code = f"{rule.get('prefix', '')}{str(rule['next_number']).zfill(rule.get('pad_width', 5))}"
        return {"enabled": True, "code": code, "rule": rule}

    async def _consume_next_number(shop_id: str):
        """Called externally when a product is created without a barcode."""
        rule = await db.numbering_rules.find_one({"shop_id": shop_id}, {"_id": 0})
        if not rule or not rule.get("enabled"):
            return None
        code = f"{rule.get('prefix', '')}{str(rule['next_number']).zfill(rule.get('pad_width', 5))}"
        await db.numbering_rules.update_one(
            {"shop_id": shop_id},
            {"$inc": {"next_number": 1}},
        )
        return code

    # Expose helper on api object so server.py can use it
    api._consume_numbering = _consume_next_number  # type: ignore

    # ---------- Bulk Price Adjustment ----------
    @api.post("/inventory/bulk-price")
    async def bulk_price(data: BulkPriceIn, user=Depends(require_shop_user)):
        q = {"shop_id": _sid(user)}
        if data.scope == "category" and data.category_id:
            q["category_id"] = data.category_id
        elif data.scope == "specific" and data.product_ids:
            q["id"] = {"$in": data.product_ids}
        products = await db.products.find(q, {"_id": 0}).to_list(50000)
        updated = 0
        preview_first = None
        for p in products:
            old_val = float(p.get(data.field, 0) or 0)
            new_val = old_val
            if data.operation == "percent_up":
                new_val = old_val * (1 + data.value / 100)
            elif data.operation == "percent_down":
                new_val = old_val * (1 - data.value / 100)
            elif data.operation == "amount_up":
                new_val = old_val + data.value
            elif data.operation == "amount_down":
                new_val = max(0, old_val - data.value)
            elif data.operation == "set":
                new_val = data.value
            if data.round_to and data.round_to > 0:
                new_val = round(new_val / data.round_to) * data.round_to
            new_val = round(new_val, 2)
            if new_val != old_val:
                await db.products.update_one({"id": p["id"]}, {"$set": {data.field: new_val}})
                updated += 1
                if preview_first is None:
                    preview_first = {"name": p["name"], "old": old_val, "new": new_val}
        return {"ok": True, "products_scanned": len(products), "products_updated": updated, "sample": preview_first}

    # ---------- Inventory Adjustments ----------
    @api.get("/inventory/adjustments")
    async def list_adjustments(user=Depends(require_shop_user), limit: int = 500):
        rows = await db.inventory_adjustments.find({"shop_id": _sid(user)}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        for r in rows:
            r["kind_label"] = KIND_LABELS.get(r.get("kind", ""), r.get("kind", ""))
        return rows

    @api.post("/inventory/adjustments")
    async def create_adjustment(data: InventoryAdjustmentIn, user=Depends(require_shop_user)):
        last = await db.inventory_adjustments.find({"shop_id": _sid(user)}).sort("number", -1).limit(1).to_list(1)
        number = (last[0]["number"] + 1) if last else 1
        doc = {
            "id": _new_id(),
            "shop_id": _sid(user),
            "number": number,
            "kind": data.kind,
            "warehouse_id": data.warehouse_id,
            "reason": data.reason,
            "notes": data.notes,
            "items": [it.model_dump() for it in data.items],
            "created_by": user["id"],
            "created_at": _now_iso(),
        }
        # Apply stock deltas
        total_cost_impact = 0.0
        for it in data.items:
            prod = await db.products.find_one({"id": it.product_id, "shop_id": _sid(user)})
            if not prod:
                continue
            cost = prod.get("cost_price", 0) or 0
            total_cost_impact += it.delta * cost
            update = {"$inc": {"stock": it.delta}}
            if data.kind == "opening":
                # For opening balance, set stock absolutely
                update = {"$set": {"stock": it.delta}}
                total_cost_impact = 0  # opening doesn't hit expense
            await db.products.update_one({"id": it.product_id, "shop_id": _sid(user)}, update)
        doc["cost_impact"] = round(total_cost_impact, 2)
        await db.inventory_adjustments.insert_one(dict(doc))
        # Auto-post JE for damage / loss / expiry_writeoff (expense)
        try:
            if data.kind in ("damage", "loss", "expiry_writeoff") and total_cost_impact < 0:
                # accounting_module helpers are on api object via monkey-patch? No — import instead
                from accounting_module import ensure_default_coa, post_journal, get_system_account
                await ensure_default_coa(db, _sid(user))
                inv_acc = await get_system_account(db, _sid(user), "is_inventory")
                # Get or create loss expense account
                loss_acc = await db.accounts.find_one({"shop_id": _sid(user), "code": "5204"})
                if not loss_acc:
                    parent5 = await db.accounts.find_one({"shop_id": _sid(user), "code": "5"})
                    loss_acc = {
                        "id": _new_id(), "shop_id": _sid(user), "code": "5204",
                        "name": "خسائر مخزون (تلف/فقد/انتهاء)",
                        "type": "expense", "parent_id": parent5["id"] if parent5 else None,
                        "is_group": False, "is_system": True, "balance": 0,
                        "created_at": _now_iso(),
                    }
                    await db.accounts.insert_one(dict(loss_acc))
                loss_amt = abs(total_cost_impact)
                await post_journal(db, _sid(user), user["id"], {
                    "date": _now_iso()[:10],
                    "description": f"{KIND_LABELS.get(data.kind)} - سند #{number}",
                    "lines": [
                        {"account_id": loss_acc["id"], "account_name": loss_acc["name"], "debit": loss_amt, "credit": 0},
                        {"account_id": inv_acc["id"], "account_name": inv_acc["name"], "debit": 0, "credit": loss_amt},
                    ],
                    "reference": f"ADJ-{number}",
                    "source": "inventory_adjustment",
                    "source_id": doc["id"],
                })
        except Exception:
            pass
        doc.pop("_id", None)
        return doc

    @api.delete("/inventory/adjustments/{aid}")
    async def delete_adjustment(aid: str, user=Depends(require_shop_user)):
        adj = await db.inventory_adjustments.find_one({"id": aid, "shop_id": _sid(user)})
        if not adj:
            raise HTTPException(404, "المستند غير موجود")
        # Reverse stock deltas
        for it in adj.get("items", []):
            if adj.get("kind") == "opening":
                continue  # can't easily reverse opening
            await db.products.update_one(
                {"id": it["product_id"], "shop_id": _sid(user)},
                {"$inc": {"stock": -it["delta"]}},
            )
        await db.inventory_adjustments.delete_one({"id": aid})
        return {"ok": True}

    # ---------- Product Alternatives ----------
    @api.get("/products/{pid}/alternatives")
    async def list_alternatives(pid: str, user=Depends(require_shop_user)):
        links = await db.product_alternatives.find({"shop_id": _sid(user), "product_id": pid}, {"_id": 0}).to_list(50)
        # enrich with product details
        for ln in links:
            alt = await db.products.find_one({"id": ln["alt_product_id"], "shop_id": _sid(user)}, {"_id": 0})
            ln["alternative"] = alt
        return links

    @api.post("/products/{pid}/alternatives")
    async def add_alternative(pid: str, data: AlternativeIn, user=Depends(require_shop_user)):
        if pid == data.alt_product_id:
            raise HTTPException(400, "لا يمكن ربط الصنف بنفسه")
        # Verify both products exist
        p1 = await db.products.find_one({"id": pid, "shop_id": _sid(user)})
        p2 = await db.products.find_one({"id": data.alt_product_id, "shop_id": _sid(user)})
        if not p1 or not p2:
            raise HTTPException(404, "الصنف غير موجود")
        # Bidirectional link
        for a, b in [(pid, data.alt_product_id), (data.alt_product_id, pid)]:
            await db.product_alternatives.update_one(
                {"shop_id": _sid(user), "product_id": a, "alt_product_id": b},
                {"$set": {
                    "id": _new_id(), "shop_id": _sid(user),
                    "product_id": a, "alt_product_id": b,
                    "notes": data.notes,
                    "created_at": _now_iso(),
                }},
                upsert=True,
            )
        return {"ok": True}

    @api.delete("/products/{pid}/alternatives/{alt_id}")
    async def remove_alternative(pid: str, alt_id: str, user=Depends(require_shop_user)):
        await db.product_alternatives.delete_many({
            "shop_id": _sid(user),
            "$or": [
                {"product_id": pid, "alt_product_id": alt_id},
                {"product_id": alt_id, "alt_product_id": pid},
            ],
        })
        return {"ok": True}

    return api
