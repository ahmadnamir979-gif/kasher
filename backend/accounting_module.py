"""
Al-Arraab Accounting Module (P0 + P1 features)
Registers routes on the shared /api router without touching server.py internals.

P0: Chart of Accounts, Journal Entries, Vouchers, Banks & Checks, VAT,
    Financial Reports (Trial Balance / P&L / Balance Sheet), Closed Periods.
P1: Cost Centers, Currencies, Installments, Purchase/Sales Orders,
    Pricing Tiers, Expiry alerts, Manufacturing formulas.
"""

from fastapi import HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import io
import uuid


def _sid(user):
    return user["shop_id"]


def _new_id():
    return str(uuid.uuid4())


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Default Chart of Accounts (Arabic accounting standard) ----------
DEFAULT_COA = [
    # Assets - الأصول
    {"code": "1", "name": "الأصول", "type": "asset", "parent_code": None, "is_group": True},
    {"code": "11", "name": "الأصول المتداولة", "type": "asset", "parent_code": "1", "is_group": True},
    {"code": "1101", "name": "الصندوق", "type": "asset", "parent_code": "11", "is_cash": True},
    {"code": "1102", "name": "البنوك", "type": "asset", "parent_code": "11", "is_group": True},
    {"code": "1103", "name": "العملاء (الذمم المدينة)", "type": "asset", "parent_code": "11", "is_receivable": True},
    {"code": "1104", "name": "المخزون", "type": "asset", "parent_code": "11", "is_inventory": True},
    {"code": "1105", "name": "شيكات برسم التحصيل", "type": "asset", "parent_code": "11"},
    {"code": "12", "name": "الأصول الثابتة", "type": "asset", "parent_code": "1", "is_group": True},
    {"code": "1201", "name": "أثاث ومعدات", "type": "asset", "parent_code": "12"},
    # Liabilities - الخصوم
    {"code": "2", "name": "الخصوم", "type": "liability", "parent_code": None, "is_group": True},
    {"code": "21", "name": "الخصوم المتداولة", "type": "liability", "parent_code": "2", "is_group": True},
    {"code": "2101", "name": "الموردون (الذمم الدائنة)", "type": "liability", "parent_code": "21", "is_payable": True},
    {"code": "2102", "name": "ضريبة القيمة المضافة مستحقة الدفع", "type": "liability", "parent_code": "21", "is_vat_payable": True},
    {"code": "2103", "name": "شيكات برسم الدفع", "type": "liability", "parent_code": "21"},
    # Equity - حقوق الملكية
    {"code": "3", "name": "حقوق الملكية", "type": "equity", "parent_code": None, "is_group": True},
    {"code": "3101", "name": "رأس المال", "type": "equity", "parent_code": "3"},
    {"code": "3102", "name": "الأرباح المحتجزة", "type": "equity", "parent_code": "3", "is_retained": True},
    # Revenue - الإيرادات
    {"code": "4", "name": "الإيرادات", "type": "revenue", "parent_code": None, "is_group": True},
    {"code": "4101", "name": "إيرادات المبيعات", "type": "revenue", "parent_code": "4", "is_sales_revenue": True},
    {"code": "4102", "name": "مردودات المبيعات", "type": "revenue", "parent_code": "4", "is_sales_returns": True},
    # Expenses - المصروفات
    {"code": "5", "name": "المصروفات", "type": "expense", "parent_code": None, "is_group": True},
    {"code": "5101", "name": "تكلفة البضاعة المباعة", "type": "expense", "parent_code": "5", "is_cogs": True},
    {"code": "5201", "name": "مصاريف تشغيلية", "type": "expense", "parent_code": "5", "is_operating": True},
    {"code": "5202", "name": "مصاريف رواتب", "type": "expense", "parent_code": "5"},
    {"code": "5203", "name": "مصاريف إيجار", "type": "expense", "parent_code": "5"},
]


async def ensure_default_coa(db, shop_id: str):
    """Ensure the shop has a default chart of accounts. Called on first access."""
    existing = await db.accounts.count_documents({"shop_id": shop_id})
    if existing > 0:
        return
    # Build code -> id map after insertion
    id_by_code = {}
    to_insert = []
    for a in DEFAULT_COA:
        acc_id = _new_id()
        id_by_code[a["code"]] = acc_id
        to_insert.append({
            "id": acc_id,
            "shop_id": shop_id,
            "code": a["code"],
            "name": a["name"],
            "type": a["type"],
            "parent_id": None,  # fill in next pass
            "parent_code": a.get("parent_code"),
            "is_group": a.get("is_group", False),
            "is_system": True,
            **{k: v for k, v in a.items() if k.startswith("is_") and k not in ("is_group",)},
            "balance": 0.0,
            "created_at": _now_iso(),
        })
    # resolve parent_id
    for d in to_insert:
        pc = d.get("parent_code")
        if pc:
            d["parent_id"] = id_by_code.get(pc)
    await db.accounts.insert_many(to_insert)


# ---------- Models ----------
class AccountIn(BaseModel):
    code: str
    name: str
    type: Literal["asset", "liability", "equity", "revenue", "expense"]
    parent_id: Optional[str] = None
    is_group: bool = False


class JELine(BaseModel):
    account_id: str
    account_name: Optional[str] = ""
    debit: float = 0.0
    credit: float = 0.0
    cost_center_id: Optional[str] = None
    notes: Optional[str] = ""


class JournalEntryIn(BaseModel):
    date: str  # YYYY-MM-DD
    description: str
    lines: List[JELine]
    reference: Optional[str] = ""
    source: Optional[str] = "manual"  # manual, sale, purchase, voucher, check
    source_id: Optional[str] = None


class VoucherIn(BaseModel):
    type: Literal["receipt", "payment", "journal"]
    date: str
    amount: float
    party_type: Optional[Literal["customer", "supplier", "employee", "other"]] = "other"
    party_id: Optional[str] = None
    party_name: Optional[str] = ""
    account_id: str  # cash / bank account for receipt/payment
    counter_account_id: Optional[str] = None  # for journal type
    method: Optional[Literal["cash", "bank", "check"]] = "cash"
    reference: Optional[str] = ""
    description: Optional[str] = ""
    check_number: Optional[str] = ""
    check_date: Optional[str] = None
    bank_name: Optional[str] = ""


class BankIn(BaseModel):
    name: str
    account_number: Optional[str] = ""
    iban: Optional[str] = ""
    currency: str = "ILS"
    opening_balance: float = 0.0


class CheckIn(BaseModel):
    kind: Literal["received", "issued"]
    check_number: str
    date: str  # issue date
    due_date: str
    amount: float
    party_name: str
    party_id: Optional[str] = None
    bank_name: Optional[str] = ""
    bank_id: Optional[str] = None
    notes: Optional[str] = ""


class CheckStatusIn(BaseModel):
    status: Literal["pending", "deposited", "cashed", "returned", "cleared"]
    notes: Optional[str] = ""


class ClosedPeriodIn(BaseModel):
    end_date: str  # YYYY-MM-DD, everything <= this date is locked
    notes: Optional[str] = ""


class CostCenterIn(BaseModel):
    name: str
    code: Optional[str] = ""
    notes: Optional[str] = ""


class CurrencyIn(BaseModel):
    code: str  # e.g., USD, EUR, JOD
    name: str  # e.g., "دولار أمريكي"
    symbol: Optional[str] = ""
    rate: float  # units of base per 1 foreign


class OrderItem(BaseModel):
    product_id: str
    name: str
    qty: float
    price: float


class OrderIn(BaseModel):
    kind: Literal["sales_order", "purchase_order"]
    party_id: Optional[str] = None
    party_name: str
    date: str
    items: List[OrderItem]
    notes: Optional[str] = ""


class InstallmentIn(BaseModel):
    customer_id: str
    customer_name: str
    total_amount: float
    down_payment: float = 0.0
    installments_count: int
    first_due_date: str
    frequency: Literal["monthly", "weekly"] = "monthly"
    notes: Optional[str] = ""
    sale_id: Optional[str] = None


class PricingTierIn(BaseModel):
    name: str  # e.g., "جملة", "تجزئة", "VIP"
    discount_percent: float = 0.0


class ProductPriceIn(BaseModel):
    product_id: str
    tier_id: str
    price: float


class ManufacturingFormulaIn(BaseModel):
    product_id: str  # finished product
    product_name: str
    output_qty: float = 1.0
    materials: List[dict]  # [{product_id, name, qty}]
    labor_cost: float = 0.0
    overhead_cost: float = 0.0


class ProduceIn(BaseModel):
    formula_id: str
    batches: float = 1.0
    notes: Optional[str] = ""


class FixedAssetIn(BaseModel):
    name: str
    category: Literal["equipment", "vehicle", "building", "furniture", "other"] = "equipment"
    purchase_date: str  # YYYY-MM-DD
    purchase_cost: float
    useful_life_years: float
    salvage_value: float = 0.0
    depreciation_method: Literal["straight_line"] = "straight_line"
    payment_account_id: Optional[str] = None  # cash or bank account
    notes: Optional[str] = ""


class DepreciateIn(BaseModel):
    as_of: str  # YYYY-MM-DD — accumulate depreciation up to this date


# ---------- Helpers ----------
async def check_period_locked(db, shop_id: str, date_str: str):
    """Raise 403 if date is in a closed period."""
    latest = await db.closed_periods.find_one(
        {"shop_id": shop_id}, sort=[("end_date", -1)]
    )
    if latest and date_str <= latest["end_date"]:
        raise HTTPException(403, f"الفترة مغلقة حتى {latest['end_date']} — لا يمكن التعديل")


async def apply_je_to_balances(db, shop_id: str, lines: List[dict], reverse: bool = False):
    """Update account balances based on JE lines. Debit increases asset/expense, decreases others."""
    for ln in lines:
        acc = await db.accounts.find_one({"id": ln["account_id"], "shop_id": shop_id})
        if not acc:
            continue
        sign = -1 if reverse else 1
        delta = 0.0
        if acc["type"] in ("asset", "expense"):
            delta = (ln.get("debit", 0) - ln.get("credit", 0)) * sign
        else:  # liability, equity, revenue
            delta = (ln.get("credit", 0) - ln.get("debit", 0)) * sign
        await db.accounts.update_one(
            {"id": ln["account_id"]},
            {"$inc": {"balance": delta}}
        )


async def get_system_account(db, shop_id: str, flag: str):
    """Return the first account for the shop that has flag=True."""
    await ensure_default_coa(db, shop_id)
    acc = await db.accounts.find_one({"shop_id": shop_id, flag: True}, {"_id": 0})
    return acc


async def post_journal(db, shop_id: str, user_id: str, entry: dict):
    """Create a journal entry doc and apply balances. entry.lines must sum to zero (debit == credit)."""
    await check_period_locked(db, shop_id, entry["date"])
    total_dr = sum(l.get("debit", 0) for l in entry["lines"])
    total_cr = sum(l.get("credit", 0) for l in entry["lines"])
    if round(total_dr - total_cr, 2) != 0:
        raise HTTPException(400, f"القيد غير متوازن: مدين {total_dr} ≠ دائن {total_cr}")
    # Assign entry number
    last = await db.journal_entries.find({"shop_id": shop_id}).sort("number", -1).limit(1).to_list(1)
    number = (last[0]["number"] + 1) if last else 1
    doc = {
        "id": _new_id(),
        "shop_id": shop_id,
        "number": number,
        "date": entry["date"],
        "description": entry["description"],
        "reference": entry.get("reference", ""),
        "source": entry.get("source", "manual"),
        "source_id": entry.get("source_id"),
        "lines": entry["lines"],
        "total_debit": total_dr,
        "total_credit": total_cr,
        "created_by": user_id,
        "created_at": _now_iso(),
    }
    await db.journal_entries.insert_one(doc)
    await apply_je_to_balances(db, shop_id, entry["lines"])
    return doc


async def ensure_fixed_asset_accounts(db, shop_id: str):
    """Ensure the shop has accounts for gross fixed assets, accumulated depreciation, and expense."""
    await ensure_default_coa(db, shop_id)
    existing = await db.accounts.find_one({"shop_id": shop_id, "is_accumulated_dep": True})
    if existing:
        return
    # 1202 Accumulated Depreciation (contra-asset, credit balance)
    parent12 = await db.accounts.find_one({"shop_id": shop_id, "code": "12"})
    await db.accounts.insert_one({
        "id": _new_id(),
        "shop_id": shop_id,
        "code": "1202",
        "name": "مجمع الإهلاك",
        "type": "asset",
        "parent_id": parent12["id"] if parent12 else None,
        "is_group": False,
        "is_system": True,
        "is_accumulated_dep": True,
        "balance": 0.0,
        "created_at": _now_iso(),
    })
    # 5301 Depreciation Expense
    parent5 = await db.accounts.find_one({"shop_id": shop_id, "code": "5"})
    await db.accounts.insert_one({
        "id": _new_id(),
        "shop_id": shop_id,
        "code": "5301",
        "name": "مصروف الإهلاك",
        "type": "expense",
        "parent_id": parent5["id"] if parent5 else None,
        "is_group": False,
        "is_system": True,
        "is_depreciation_expense": True,
        "balance": 0.0,
        "created_at": _now_iso(),
    })


def _months_between(d1_str: str, d2_str: str) -> float:
    d1 = datetime.strptime(d1_str, "%Y-%m-%d")
    d2 = datetime.strptime(d2_str, "%Y-%m-%d")
    delta = (d2.year - d1.year) * 12 + (d2.month - d1.month)
    return max(0.0, delta + max(0.0, (d2.day - d1.day) / 30.0))


def _compute_depreciation(asset: dict, as_of: str) -> dict:
    months_elapsed = _months_between(asset["purchase_date"], as_of)
    total_months = asset["useful_life_years"] * 12
    if total_months <= 0:
        return {"months_elapsed": 0, "total_depreciable": 0, "monthly": 0, "accumulated": 0, "net_book_value": asset["purchase_cost"]}
    depreciable_base = asset["purchase_cost"] - asset["salvage_value"]
    monthly = depreciable_base / total_months
    accumulated = min(monthly * months_elapsed, depreciable_base)
    net = asset["purchase_cost"] - accumulated
    return {
        "months_elapsed": round(months_elapsed, 2),
        "total_months": total_months,
        "monthly": round(monthly, 2),
        "accumulated": round(accumulated, 2),
        "net_book_value": round(net, 2),
    }



def register(api, db, require_shop_user):
    """Register all accounting routes on the given api router."""

    # ---------- Chart of Accounts ----------
    @api.get("/accounting/accounts")
    async def list_accounts(user=Depends(require_shop_user)):
        await ensure_default_coa(db, _sid(user))
        rows = await db.accounts.find({"shop_id": _sid(user)}, {"_id": 0}).sort("code", 1).to_list(2000)
        return rows

    @api.post("/accounting/accounts")
    async def create_account(data: AccountIn, user=Depends(require_shop_user)):
        await ensure_default_coa(db, _sid(user))
        exists = await db.accounts.find_one({"shop_id": _sid(user), "code": data.code})
        if exists:
            raise HTTPException(400, "رقم الحساب موجود مسبقاً")
        doc = {
            "id": _new_id(),
            "shop_id": _sid(user),
            "code": data.code,
            "name": data.name,
            "type": data.type,
            "parent_id": data.parent_id,
            "is_group": data.is_group,
            "is_system": False,
            "balance": 0.0,
            "created_at": _now_iso(),
        }
        await db.accounts.insert_one(doc)
        return {**doc, "_id": None}

    @api.patch("/accounting/accounts/{aid}")
    async def update_account(aid: str, data: AccountIn, user=Depends(require_shop_user)):
        acc = await db.accounts.find_one({"id": aid, "shop_id": _sid(user)})
        if not acc:
            raise HTTPException(404, "الحساب غير موجود")
        if acc.get("is_system"):
            # only allow name change on system accounts
            await db.accounts.update_one({"id": aid}, {"$set": {"name": data.name}})
        else:
            await db.accounts.update_one({"id": aid}, {"$set": data.model_dump()})
        return {"ok": True}

    @api.delete("/accounting/accounts/{aid}")
    async def delete_account(aid: str, user=Depends(require_shop_user)):
        acc = await db.accounts.find_one({"id": aid, "shop_id": _sid(user)})
        if not acc:
            raise HTTPException(404, "الحساب غير موجود")
        if acc.get("is_system"):
            raise HTTPException(400, "لا يمكن حذف حساب نظامي")
        # ensure no journal lines reference it
        used = await db.journal_entries.count_documents({"shop_id": _sid(user), "lines.account_id": aid})
        if used > 0:
            raise HTTPException(400, "لا يمكن الحذف: يوجد قيود مرتبطة")
        await db.accounts.delete_one({"id": aid})
        return {"ok": True}

    # ---------- Journal Entries ----------
    @api.get("/accounting/journal")
    async def list_journal(
        user=Depends(require_shop_user),
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        account_id: Optional[str] = None,
        limit: int = 500,
    ):
        q = {"shop_id": _sid(user)}
        if date_from or date_to:
            q["date"] = {}
            if date_from:
                q["date"]["$gte"] = date_from
            if date_to:
                q["date"]["$lte"] = date_to
        if account_id:
            q["lines.account_id"] = account_id
        rows = await db.journal_entries.find(q, {"_id": 0}).sort("number", -1).limit(limit).to_list(limit)
        return rows

    @api.post("/accounting/journal")
    async def create_journal(data: JournalEntryIn, user=Depends(require_shop_user)):
        await ensure_default_coa(db, _sid(user))
        entry = data.model_dump()
        # enrich lines with account names
        for ln in entry["lines"]:
            if not ln.get("account_name"):
                acc = await db.accounts.find_one({"id": ln["account_id"], "shop_id": _sid(user)})
                if acc:
                    ln["account_name"] = acc["name"]
        doc = await post_journal(db, _sid(user), user["id"], entry)
        return {**doc, "_id": None}

    @api.delete("/accounting/journal/{jid}")
    async def delete_journal(jid: str, user=Depends(require_shop_user)):
        je = await db.journal_entries.find_one({"id": jid, "shop_id": _sid(user)})
        if not je:
            raise HTTPException(404, "القيد غير موجود")
        await check_period_locked(db, _sid(user), je["date"])
        if je.get("source") not in ("manual", "voucher"):
            raise HTTPException(400, "لا يمكن حذف قيد تلقائي - احذف مصدره أولاً")
        await apply_je_to_balances(db, _sid(user), je["lines"], reverse=True)
        await db.journal_entries.delete_one({"id": jid})
        return {"ok": True}

    # ---------- Vouchers ----------
    @api.get("/accounting/vouchers")
    async def list_vouchers(
        user=Depends(require_shop_user),
        kind: Optional[str] = None,
        limit: int = 500,
    ):
        q = {"shop_id": _sid(user)}
        if kind:
            q["type"] = kind
        return await db.vouchers.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    @api.post("/accounting/vouchers")
    async def create_voucher(data: VoucherIn, user=Depends(require_shop_user)):
        await ensure_default_coa(db, _sid(user))
        await check_period_locked(db, _sid(user), data.date)
        vid = _new_id()

        # Build JE based on voucher type
        cash_bank_acc = await db.accounts.find_one({"id": data.account_id, "shop_id": _sid(user)})
        if not cash_bank_acc:
            raise HTTPException(400, "الحساب المالي غير موجود")

        lines = []
        # Determine counter account
        counter_acc = None
        if data.counter_account_id:
            counter_acc = await db.accounts.find_one({"id": data.counter_account_id, "shop_id": _sid(user)})
        else:
            # auto pick: customer -> receivable, supplier -> payable
            if data.party_type == "customer":
                counter_acc = await get_system_account(db, _sid(user), "is_receivable")
            elif data.party_type == "supplier":
                counter_acc = await get_system_account(db, _sid(user), "is_payable")

        if not counter_acc:
            raise HTTPException(400, "يرجى تحديد الحساب المقابل")

        # Number
        last = await db.vouchers.find({"shop_id": _sid(user), "type": data.type}).sort("number", -1).limit(1).to_list(1)
        number = (last[0]["number"] + 1) if last else 1

        if data.type == "receipt":
            # Debit cash/bank, Credit party (receivable/other)
            lines = [
                {"account_id": cash_bank_acc["id"], "account_name": cash_bank_acc["name"], "debit": data.amount, "credit": 0},
                {"account_id": counter_acc["id"], "account_name": counter_acc["name"], "debit": 0, "credit": data.amount},
            ]
            desc = f"سند قبض #{number} من {data.party_name}"
        elif data.type == "payment":
            # Debit party (payable/other), Credit cash/bank
            lines = [
                {"account_id": counter_acc["id"], "account_name": counter_acc["name"], "debit": data.amount, "credit": 0},
                {"account_id": cash_bank_acc["id"], "account_name": cash_bank_acc["name"], "debit": 0, "credit": data.amount},
            ]
            desc = f"سند صرف #{number} إلى {data.party_name}"
        else:  # journal voucher
            lines = [
                {"account_id": cash_bank_acc["id"], "account_name": cash_bank_acc["name"], "debit": data.amount, "credit": 0},
                {"account_id": counter_acc["id"], "account_name": counter_acc["name"], "debit": 0, "credit": data.amount},
            ]
            desc = f"سند قيد #{number} - {data.description or ''}"

        je = await post_journal(db, _sid(user), user["id"], {
            "date": data.date,
            "description": desc,
            "lines": lines,
            "reference": f"VCH-{data.type}-{number}",
            "source": "voucher",
            "source_id": vid,
        })

        doc = {
            "id": vid,
            "shop_id": _sid(user),
            "number": number,
            "type": data.type,
            "date": data.date,
            "amount": data.amount,
            "party_type": data.party_type,
            "party_id": data.party_id,
            "party_name": data.party_name,
            "account_id": data.account_id,
            "account_name": cash_bank_acc["name"],
            "counter_account_id": counter_acc["id"],
            "counter_account_name": counter_acc["name"],
            "method": data.method,
            "reference": data.reference or f"VCH-{number}",
            "description": data.description or desc,
            "check_number": data.check_number,
            "check_date": data.check_date,
            "bank_name": data.bank_name,
            "journal_entry_id": je["id"],
            "created_by": user["id"],
            "created_at": _now_iso(),
        }
        await db.vouchers.insert_one(doc)

        # If paid by check, also create a check record
        if data.method == "check" and data.check_number:
            check_doc = {
                "id": _new_id(),
                "shop_id": _sid(user),
                "kind": "received" if data.type == "receipt" else "issued",
                "check_number": data.check_number,
                "date": data.date,
                "due_date": data.check_date or data.date,
                "amount": data.amount,
                "party_name": data.party_name,
                "party_id": data.party_id,
                "bank_name": data.bank_name,
                "status": "pending",
                "voucher_id": vid,
                "created_at": _now_iso(),
            }
            await db.checks.insert_one(check_doc)

        # Update party balance (customer / supplier)
        if data.party_type == "customer" and data.party_id:
            delta = -data.amount if data.type == "receipt" else data.amount
            await db.customers.update_one({"id": data.party_id, "shop_id": _sid(user)}, {"$inc": {"balance": delta}})
        elif data.party_type == "supplier" and data.party_id:
            delta = -data.amount if data.type == "payment" else data.amount
            await db.suppliers.update_one({"id": data.party_id, "shop_id": _sid(user)}, {"$inc": {"balance": delta}})

        return {**doc, "_id": None}

    @api.delete("/accounting/vouchers/{vid}")
    async def delete_voucher(vid: str, user=Depends(require_shop_user)):
        v = await db.vouchers.find_one({"id": vid, "shop_id": _sid(user)})
        if not v:
            raise HTTPException(404, "السند غير موجود")
        await check_period_locked(db, _sid(user), v["date"])
        # Reverse the JE
        je = await db.journal_entries.find_one({"id": v["journal_entry_id"]})
        if je:
            await apply_je_to_balances(db, _sid(user), je["lines"], reverse=True)
            await db.journal_entries.delete_one({"id": v["journal_entry_id"]})
        # Reverse party balance
        if v.get("party_type") == "customer" and v.get("party_id"):
            delta = v["amount"] if v["type"] == "receipt" else -v["amount"]
            await db.customers.update_one({"id": v["party_id"], "shop_id": _sid(user)}, {"$inc": {"balance": delta}})
        elif v.get("party_type") == "supplier" and v.get("party_id"):
            delta = v["amount"] if v["type"] == "payment" else -v["amount"]
            await db.suppliers.update_one({"id": v["party_id"], "shop_id": _sid(user)}, {"$inc": {"balance": delta}})
        # Delete related check
        await db.checks.delete_many({"voucher_id": vid})
        await db.vouchers.delete_one({"id": vid})
        return {"ok": True}

    # ---------- Banks & Checks ----------
    @api.get("/banks")
    async def list_banks(user=Depends(require_shop_user)):
        return await db.banks.find({"shop_id": _sid(user)}, {"_id": 0}).sort("name", 1).to_list(200)

    @api.post("/banks")
    async def create_bank(data: BankIn, user=Depends(require_shop_user)):
        await ensure_default_coa(db, _sid(user))
        # Create account under parent 1102 (Banks)
        parent = await db.accounts.find_one({"shop_id": _sid(user), "code": "1102"})
        last = await db.accounts.find({"shop_id": _sid(user), "code": {"$regex": "^1102"}}).sort("code", -1).limit(1).to_list(1)
        next_code = "110201"
        if last and last[0]["code"] != "1102":
            try:
                next_code = str(int(last[0]["code"]) + 1)
            except Exception:
                next_code = f"1102{len(last)+1:02d}"
        acc_id = _new_id()
        await db.accounts.insert_one({
            "id": acc_id,
            "shop_id": _sid(user),
            "code": next_code,
            "name": f"بنك - {data.name}",
            "type": "asset",
            "parent_id": parent["id"] if parent else None,
            "is_system": True,
            "is_bank": True,
            "balance": data.opening_balance,
            "created_at": _now_iso(),
        })
        doc = {
            "id": _new_id(),
            "shop_id": _sid(user),
            "name": data.name,
            "account_number": data.account_number,
            "iban": data.iban,
            "currency": data.currency,
            "opening_balance": data.opening_balance,
            "account_id": acc_id,
            "created_at": _now_iso(),
        }
        await db.banks.insert_one(doc)
        return {**doc, "_id": None}

    @api.delete("/banks/{bid}")
    async def delete_bank(bid: str, user=Depends(require_shop_user)):
        b = await db.banks.find_one({"id": bid, "shop_id": _sid(user)})
        if not b:
            raise HTTPException(404, "البنك غير موجود")
        used = await db.vouchers.count_documents({"shop_id": _sid(user), "account_id": b.get("account_id")})
        if used > 0:
            raise HTTPException(400, "لا يمكن الحذف: يوجد حركات مالية")
        await db.accounts.delete_one({"id": b.get("account_id")})
        await db.banks.delete_one({"id": bid})
        return {"ok": True}

    @api.get("/checks")
    async def list_checks(
        user=Depends(require_shop_user),
        kind: Optional[str] = None,
        status: Optional[str] = None,
    ):
        q = {"shop_id": _sid(user)}
        if kind:
            q["kind"] = kind
        if status:
            q["status"] = status
        return await db.checks.find(q, {"_id": 0}).sort("due_date", 1).to_list(1000)

    @api.post("/checks")
    async def create_check(data: CheckIn, user=Depends(require_shop_user)):
        doc = {
            "id": _new_id(),
            "shop_id": _sid(user),
            **data.model_dump(),
            "status": "pending",
            "created_at": _now_iso(),
        }
        await db.checks.insert_one(doc)
        return {**doc, "_id": None}

    @api.patch("/checks/{cid}/status")
    async def update_check_status(cid: str, data: CheckStatusIn, user=Depends(require_shop_user)):
        c = await db.checks.find_one({"id": cid, "shop_id": _sid(user)})
        if not c:
            raise HTTPException(404, "الشيك غير موجود")
        await db.checks.update_one(
            {"id": cid},
            {"$set": {"status": data.status, "status_notes": data.notes, "status_changed_at": _now_iso()}},
        )
        # If returned, create a reversing JE (only if there was a source voucher)
        if data.status == "returned" and c.get("voucher_id"):
            v = await db.vouchers.find_one({"id": c["voucher_id"], "shop_id": _sid(user)})
            if v:
                # Reverse original JE
                original_je = await db.journal_entries.find_one({"id": v.get("journal_entry_id")})
                if original_je:
                    # Post reverse entry
                    reverse_lines = [
                        {**ln, "debit": ln.get("credit", 0), "credit": ln.get("debit", 0)}
                        for ln in original_je["lines"]
                    ]
                    await post_journal(db, _sid(user), user["id"], {
                        "date": _now_iso()[:10],
                        "description": f"شيك مرتجع #{c['check_number']}",
                        "lines": reverse_lines,
                        "source": "check_return",
                        "source_id": cid,
                    })
        return {"ok": True}

    @api.delete("/checks/{cid}")
    async def delete_check(cid: str, user=Depends(require_shop_user)):
        c = await db.checks.find_one({"id": cid, "shop_id": _sid(user)})
        if not c:
            raise HTTPException(404, "الشيك غير موجود")
        if c.get("voucher_id"):
            raise HTTPException(400, "الشيك مرتبط بسند - احذف السند أولاً")
        await db.checks.delete_one({"id": cid})
        return {"ok": True}

    # ---------- VAT Report ----------
    @api.get("/accounting/vat-report")
    async def vat_report(
        user=Depends(require_shop_user),
        date_from: str = Query(...),
        date_to: str = Query(...),
    ):
        # Sales VAT (output tax): sum from sales in the date range
        sales = await db.sales.find({
            "shop_id": _sid(user),
            "created_at": {"$gte": f"{date_from}T00:00:00", "$lte": f"{date_to}T23:59:59"},
        }, {"_id": 0}).to_list(10000)
        output_vat = 0.0
        sales_total_ex_vat = 0.0
        for s in sales:
            if s.get("is_return"):
                sign = -1
            else:
                sign = 1
            for it in s.get("items", []):
                subtotal = it.get("qty", 0) * it.get("price", 0) - it.get("discount", 0)
                rate = it.get("tax_rate", 0) / 100.0
                # tax is included in price for POS receipts, so extract
                base = subtotal / (1 + rate) if rate > 0 else subtotal
                tax = subtotal - base
                sales_total_ex_vat += base * sign
                output_vat += tax * sign
        # Purchase VAT (input tax)
        purchases = await db.purchases.find({
            "shop_id": _sid(user),
            "created_at": {"$gte": f"{date_from}T00:00:00", "$lte": f"{date_to}T23:59:59"},
        }, {"_id": 0}).to_list(10000)
        input_vat = 0.0
        purchases_total_ex_vat = 0.0
        for p in purchases:
            sign = -1 if p.get("is_return") else 1
            for it in p.get("items", []):
                subtotal = it.get("qty", 0) * it.get("price", 0) - it.get("discount", 0)
                rate = it.get("tax_rate", 0) / 100.0
                base = subtotal / (1 + rate) if rate > 0 else subtotal
                tax = subtotal - base
                purchases_total_ex_vat += base * sign
                input_vat += tax * sign
        payable = output_vat - input_vat
        return {
            "date_from": date_from,
            "date_to": date_to,
            "sales_total_ex_vat": round(sales_total_ex_vat, 2),
            "output_vat": round(output_vat, 2),
            "purchases_total_ex_vat": round(purchases_total_ex_vat, 2),
            "input_vat": round(input_vat, 2),
            "vat_payable": round(payable, 2),
        }

    # ---------- Financial Reports ----------
    @api.get("/accounting/trial-balance")
    async def trial_balance(user=Depends(require_shop_user), as_of: Optional[str] = None):
        await ensure_default_coa(db, _sid(user))
        accounts = await db.accounts.find({"shop_id": _sid(user)}, {"_id": 0}).sort("code", 1).to_list(2000)
        # Sum from journal entries up to as_of
        match = {"shop_id": _sid(user)}
        if as_of:
            match["date"] = {"$lte": as_of}
        rows = []
        # Aggregate debit/credit per account
        pipe = [
            {"$match": match},
            {"$unwind": "$lines"},
            {"$group": {
                "_id": "$lines.account_id",
                "debit": {"$sum": "$lines.debit"},
                "credit": {"$sum": "$lines.credit"},
            }},
        ]
        aggr = {r["_id"]: r async for r in db.journal_entries.aggregate(pipe)}
        total_dr = 0.0
        total_cr = 0.0
        for a in accounts:
            if a.get("is_group"):
                continue
            agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
            dr = agg["debit"]
            cr = agg["credit"]
            balance = dr - cr
            if a["type"] in ("asset", "expense"):
                bal_dr = max(balance, 0)
                bal_cr = max(-balance, 0)
            else:
                bal_cr = max(-balance, 0) if balance < 0 else 0
                bal_dr = max(balance, 0) if balance > 0 else 0
                # For liability/equity/revenue: credit balance is normal (positive)
                if balance <= 0:
                    bal_cr = -balance
                    bal_dr = 0
                else:
                    bal_dr = balance
                    bal_cr = 0
            total_dr += bal_dr
            total_cr += bal_cr
            rows.append({
                "account_id": a["id"],
                "code": a["code"],
                "name": a["name"],
                "type": a["type"],
                "debit": round(dr, 2),
                "credit": round(cr, 2),
                "balance_debit": round(bal_dr, 2),
                "balance_credit": round(bal_cr, 2),
            })
        return {
            "as_of": as_of or _now_iso()[:10],
            "rows": rows,
            "total_debit": round(total_dr, 2),
            "total_credit": round(total_cr, 2),
            "balanced": round(total_dr - total_cr, 2) == 0,
        }

    @api.get("/accounting/profit-loss")
    async def profit_loss(
        user=Depends(require_shop_user),
        date_from: str = Query(...),
        date_to: str = Query(...),
    ):
        await ensure_default_coa(db, _sid(user))
        accounts = await db.accounts.find(
            {"shop_id": _sid(user), "type": {"$in": ["revenue", "expense"]}, "is_group": {"$ne": True}}
        , {"_id": 0}).to_list(500)
        pipe = [
            {"$match": {"shop_id": _sid(user), "date": {"$gte": date_from, "$lte": date_to}}},
            {"$unwind": "$lines"},
            {"$group": {
                "_id": "$lines.account_id",
                "debit": {"$sum": "$lines.debit"},
                "credit": {"$sum": "$lines.credit"},
            }},
        ]
        aggr = {r["_id"]: r async for r in db.journal_entries.aggregate(pipe)}
        revenues = []
        expenses = []
        total_rev = 0.0
        total_exp = 0.0
        for a in accounts:
            agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
            if a["type"] == "revenue":
                amt = agg["credit"] - agg["debit"]
                if amt != 0:
                    revenues.append({"code": a["code"], "name": a["name"], "amount": round(amt, 2)})
                    total_rev += amt
            else:  # expense
                amt = agg["debit"] - agg["credit"]
                if amt != 0:
                    expenses.append({"code": a["code"], "name": a["name"], "amount": round(amt, 2)})
                    total_exp += amt
        return {
            "date_from": date_from,
            "date_to": date_to,
            "revenues": revenues,
            "total_revenue": round(total_rev, 2),
            "expenses": expenses,
            "total_expenses": round(total_exp, 2),
            "net_profit": round(total_rev - total_exp, 2),
        }

    @api.get("/accounting/balance-sheet")
    async def balance_sheet(user=Depends(require_shop_user), as_of: Optional[str] = None):
        await ensure_default_coa(db, _sid(user))
        accounts = await db.accounts.find(
            {"shop_id": _sid(user), "is_group": {"$ne": True}}
        , {"_id": 0}).to_list(2000)
        match = {"shop_id": _sid(user)}
        if as_of:
            match["date"] = {"$lte": as_of}
        pipe = [
            {"$match": match},
            {"$unwind": "$lines"},
            {"$group": {
                "_id": "$lines.account_id",
                "debit": {"$sum": "$lines.debit"},
                "credit": {"$sum": "$lines.credit"},
            }},
        ]
        aggr = {r["_id"]: r async for r in db.journal_entries.aggregate(pipe)}
        assets, liabilities, equity = [], [], []
        total_a = total_l = total_e = 0.0
        net_income = 0.0
        for a in accounts:
            agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
            if a["type"] == "asset":
                amt = agg["debit"] - agg["credit"]
                if amt != 0:
                    assets.append({"code": a["code"], "name": a["name"], "amount": round(amt, 2)})
                    total_a += amt
            elif a["type"] == "liability":
                amt = agg["credit"] - agg["debit"]
                if amt != 0:
                    liabilities.append({"code": a["code"], "name": a["name"], "amount": round(amt, 2)})
                    total_l += amt
            elif a["type"] == "equity":
                amt = agg["credit"] - agg["debit"]
                if amt != 0:
                    equity.append({"code": a["code"], "name": a["name"], "amount": round(amt, 2)})
                    total_e += amt
            elif a["type"] == "revenue":
                net_income += agg["credit"] - agg["debit"]
            elif a["type"] == "expense":
                net_income -= agg["debit"] - agg["credit"]
        if net_income != 0:
            equity.append({"code": "3999", "name": "صافي الربح للفترة", "amount": round(net_income, 2)})
            total_e += net_income
        return {
            "as_of": as_of or _now_iso()[:10],
            "assets": assets,
            "total_assets": round(total_a, 2),
            "liabilities": liabilities,
            "total_liabilities": round(total_l, 2),
            "equity": equity,
            "total_equity": round(total_e, 2),
            "balanced": abs(round(total_a - (total_l + total_e), 2)) < 0.01,
        }

    # ---------- Closed Periods ----------
    @api.get("/accounting/closed-periods")
    async def list_closed_periods(user=Depends(require_shop_user)):
        return await db.closed_periods.find({"shop_id": _sid(user)}, {"_id": 0}).sort("end_date", -1).to_list(100)

    @api.post("/accounting/closed-periods")
    async def close_period(data: ClosedPeriodIn, user=Depends(require_shop_user)):
        doc = {
            "id": _new_id(),
            "shop_id": _sid(user),
            "end_date": data.end_date,
            "notes": data.notes,
            "closed_by": user["id"],
            "closed_at": _now_iso(),
        }
        await db.closed_periods.insert_one(doc)
        return {**doc, "_id": None}

    @api.delete("/accounting/closed-periods/{pid}")
    async def reopen_period(pid: str, user=Depends(require_shop_user)):
        await db.closed_periods.delete_one({"id": pid, "shop_id": _sid(user)})
        return {"ok": True}

    # ---------- Cost Centers ----------
    @api.get("/cost-centers")
    async def list_cost_centers(user=Depends(require_shop_user)):
        return await db.cost_centers.find({"shop_id": _sid(user)}, {"_id": 0}).sort("name", 1).to_list(200)

    @api.post("/cost-centers")
    async def create_cost_center(data: CostCenterIn, user=Depends(require_shop_user)):
        doc = {"id": _new_id(), "shop_id": _sid(user), **data.model_dump(), "created_at": _now_iso()}
        await db.cost_centers.insert_one(doc)
        return {**doc, "_id": None}

    @api.delete("/cost-centers/{cid}")
    async def delete_cost_center(cid: str, user=Depends(require_shop_user)):
        await db.cost_centers.delete_one({"id": cid, "shop_id": _sid(user)})
        return {"ok": True}

    # ---------- Currencies ----------
    @api.get("/currencies")
    async def list_currencies(user=Depends(require_shop_user)):
        rows = await db.currencies.find({"shop_id": _sid(user)}, {"_id": 0}).sort("code", 1).to_list(50)
        if not rows:
            base = {"id": _new_id(), "shop_id": _sid(user), "code": "ILS", "name": "شيكل", "symbol": "₪", "rate": 1.0, "is_base": True, "created_at": _now_iso()}
            await db.currencies.insert_one(base)
            base.pop("_id", None)
            rows = [base]
        return rows

    @api.post("/currencies")
    async def create_currency(data: CurrencyIn, user=Depends(require_shop_user)):
        doc = {"id": _new_id(), "shop_id": _sid(user), **data.model_dump(), "is_base": False, "created_at": _now_iso()}
        await db.currencies.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @api.patch("/currencies/{cid}")
    async def update_currency(cid: str, data: CurrencyIn, user=Depends(require_shop_user)):
        await db.currencies.update_one({"id": cid, "shop_id": _sid(user)}, {"$set": data.model_dump()})
        return {"ok": True}

    @api.delete("/currencies/{cid}")
    async def delete_currency(cid: str, user=Depends(require_shop_user)):
        c = await db.currencies.find_one({"id": cid, "shop_id": _sid(user)})
        if c and c.get("is_base"):
            raise HTTPException(400, "لا يمكن حذف العملة الأساسية")
        await db.currencies.delete_one({"id": cid, "shop_id": _sid(user)})
        return {"ok": True}

    # ---------- Orders (Purchase/Sales) ----------
    @api.get("/orders")
    async def list_orders(user=Depends(require_shop_user), kind: Optional[str] = None):
        q = {"shop_id": _sid(user)}
        if kind:
            q["kind"] = kind
        return await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

    @api.post("/orders")
    async def create_order(data: OrderIn, user=Depends(require_shop_user)):
        total = sum(it.qty * it.price for it in data.items)
        last = await db.orders.find({"shop_id": _sid(user), "kind": data.kind}).sort("number", -1).limit(1).to_list(1)
        number = (last[0]["number"] + 1) if last else 1
        doc = {
            "id": _new_id(),
            "shop_id": _sid(user),
            "number": number,
            "status": "open",
            **data.model_dump(),
            "total": total,
            "created_at": _now_iso(),
        }
        await db.orders.insert_one(doc)
        return {**doc, "_id": None}

    @api.patch("/orders/{oid}/status")
    async def update_order_status(oid: str, status: str, user=Depends(require_shop_user)):
        if status not in ("open", "confirmed", "delivered", "cancelled"):
            raise HTTPException(400, "status invalid")
        await db.orders.update_one({"id": oid, "shop_id": _sid(user)}, {"$set": {"status": status}})
        return {"ok": True}

    @api.delete("/orders/{oid}")
    async def delete_order(oid: str, user=Depends(require_shop_user)):
        await db.orders.delete_one({"id": oid, "shop_id": _sid(user)})
        return {"ok": True}

    # ---------- Installments ----------
    @api.get("/installments")
    async def list_installments(user=Depends(require_shop_user)):
        return await db.installment_plans.find({"shop_id": _sid(user)}, {"_id": 0}).sort("created_at", -1).to_list(500)

    @api.post("/installments")
    async def create_installment(data: InstallmentIn, user=Depends(require_shop_user)):
        remaining = data.total_amount - data.down_payment
        per_installment = round(remaining / max(1, data.installments_count), 2)
        due_date = datetime.strptime(data.first_due_date, "%Y-%m-%d")
        step_days = 30 if data.frequency == "monthly" else 7
        schedule = []
        for i in range(data.installments_count):
            schedule.append({
                "seq": i + 1,
                "due_date": due_date.strftime("%Y-%m-%d"),
                "amount": per_installment,
                "paid": 0.0,
                "status": "pending",
            })
            due_date = due_date + timedelta(days=step_days)
        doc = {
            "id": _new_id(),
            "shop_id": _sid(user),
            "customer_id": data.customer_id,
            "customer_name": data.customer_name,
            "total_amount": data.total_amount,
            "down_payment": data.down_payment,
            "installments_count": data.installments_count,
            "frequency": data.frequency,
            "schedule": schedule,
            "notes": data.notes,
            "sale_id": data.sale_id,
            "status": "active",
            "created_at": _now_iso(),
        }
        await db.installment_plans.insert_one(doc)
        return {**doc, "_id": None}

    @api.post("/installments/{plan_id}/pay")
    async def pay_installment(
        plan_id: str,
        seq: int,
        amount: float,
        user=Depends(require_shop_user),
    ):
        plan = await db.installment_plans.find_one({"id": plan_id, "shop_id": _sid(user)})
        if not plan:
            raise HTTPException(404, "الخطة غير موجودة")
        sched = plan["schedule"]
        found = False
        for row in sched:
            if row["seq"] == seq:
                row["paid"] = (row.get("paid", 0) or 0) + amount
                row["status"] = "paid" if row["paid"] >= row["amount"] else "partial"
                found = True
                break
        if not found:
            raise HTTPException(404, "القسط غير موجود")
        await db.installment_plans.update_one({"id": plan_id}, {"$set": {"schedule": sched}})
        # Reduce customer balance
        if plan.get("customer_id"):
            await db.customers.update_one({"id": plan["customer_id"], "shop_id": _sid(user)}, {"$inc": {"balance": -amount}})
        return {"ok": True}

    @api.delete("/installments/{plan_id}")
    async def delete_installment(plan_id: str, user=Depends(require_shop_user)):
        await db.installment_plans.delete_one({"id": plan_id, "shop_id": _sid(user)})
        return {"ok": True}

    # ---------- Pricing Tiers ----------
    @api.get("/pricing-tiers")
    async def list_tiers(user=Depends(require_shop_user)):
        return await db.pricing_tiers.find({"shop_id": _sid(user)}, {"_id": 0}).sort("created_at", 1).to_list(50)

    @api.post("/pricing-tiers")
    async def create_tier(data: PricingTierIn, user=Depends(require_shop_user)):
        doc = {"id": _new_id(), "shop_id": _sid(user), **data.model_dump(), "created_at": _now_iso()}
        await db.pricing_tiers.insert_one(doc)
        return {**doc, "_id": None}

    @api.delete("/pricing-tiers/{tid}")
    async def delete_tier(tid: str, user=Depends(require_shop_user)):
        await db.pricing_tiers.delete_one({"id": tid, "shop_id": _sid(user)})
        await db.product_tier_prices.delete_many({"tier_id": tid, "shop_id": _sid(user)})
        return {"ok": True}

    @api.get("/product-tier-prices")
    async def list_tier_prices(user=Depends(require_shop_user), tier_id: Optional[str] = None):
        q = {"shop_id": _sid(user)}
        if tier_id:
            q["tier_id"] = tier_id
        return await db.product_tier_prices.find(q, {"_id": 0}).to_list(5000)

    @api.post("/product-tier-prices")
    async def set_tier_price(data: ProductPriceIn, user=Depends(require_shop_user)):
        await db.product_tier_prices.update_one(
            {"shop_id": _sid(user), "product_id": data.product_id, "tier_id": data.tier_id},
            {"$set": {**data.model_dump(), "shop_id": _sid(user)}},
            upsert=True,
        )
        return {"ok": True}

    # ---------- Expiry Alerts ----------
    @api.get("/expiry/near")
    async def near_expiry(user=Depends(require_shop_user), days: int = 30):
        limit_date = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")
        today = _now_iso()[:10]
        rows = await db.products.find(
            {"shop_id": _sid(user), "expiry_date": {"$gte": today, "$lte": limit_date}},
            {"_id": 0},
        ).sort("expiry_date", 1).to_list(1000)
        expired = await db.products.find(
            {"shop_id": _sid(user), "expiry_date": {"$lt": today, "$ne": None}},
            {"_id": 0},
        ).sort("expiry_date", 1).to_list(1000)
        return {"near_expiry": rows, "expired": expired, "days_window": days}

    # ---------- Manufacturing Formulas ----------
    @api.get("/manufacturing/formulas")
    async def list_formulas(user=Depends(require_shop_user)):
        return await db.mfg_formulas.find({"shop_id": _sid(user)}, {"_id": 0}).sort("created_at", -1).to_list(500)

    @api.post("/manufacturing/formulas")
    async def create_formula(data: ManufacturingFormulaIn, user=Depends(require_shop_user)):
        doc = {"id": _new_id(), "shop_id": _sid(user), **data.model_dump(), "created_at": _now_iso()}
        await db.mfg_formulas.insert_one(doc)
        return {**doc, "_id": None}

    @api.delete("/manufacturing/formulas/{fid}")
    async def delete_formula(fid: str, user=Depends(require_shop_user)):
        await db.mfg_formulas.delete_one({"id": fid, "shop_id": _sid(user)})
        return {"ok": True}

    @api.post("/manufacturing/produce")
    async def produce(data: ProduceIn, user=Depends(require_shop_user)):
        formula = await db.mfg_formulas.find_one({"id": data.formula_id, "shop_id": _sid(user)})
        if not formula:
            raise HTTPException(404, "الوصفة غير موجودة")
        # Consume materials
        material_cost = 0.0
        for m in formula["materials"]:
            need_qty = m["qty"] * data.batches
            prod = await db.products.find_one({"id": m["product_id"], "shop_id": _sid(user)})
            if not prod:
                continue
            if prod.get("stock", 0) < need_qty:
                raise HTTPException(400, f"مخزون {prod['name']} غير كافي")
            await db.products.update_one({"id": m["product_id"]}, {"$inc": {"stock": -need_qty}})
            material_cost += need_qty * (prod.get("cost", 0) or 0)
        # Produce output
        total_output = (formula.get("output_qty", 1) or 1) * data.batches
        total_cost = material_cost + (formula.get("labor_cost", 0) or 0) * data.batches + (formula.get("overhead_cost", 0) or 0) * data.batches
        unit_cost = total_cost / total_output if total_output > 0 else 0
        out_prod = await db.products.find_one({"id": formula["product_id"], "shop_id": _sid(user)})
        if out_prod:
            # Weighted average cost
            old_stock = out_prod.get("stock", 0) or 0
            old_cost = out_prod.get("cost", 0) or 0
            new_stock = old_stock + total_output
            new_cost = ((old_stock * old_cost) + total_cost) / new_stock if new_stock > 0 else unit_cost
            await db.products.update_one(
                {"id": formula["product_id"]},
                {"$set": {"stock": new_stock, "cost": round(new_cost, 4)}},
            )
        doc = {
            "id": _new_id(),
            "shop_id": _sid(user),
            "formula_id": data.formula_id,
            "batches": data.batches,
            "output_qty": total_output,
            "total_cost": round(total_cost, 2),
            "unit_cost": round(unit_cost, 4),
            "notes": data.notes,
            "created_by": user["id"],
            "created_at": _now_iso(),
        }
        await db.mfg_productions.insert_one(doc)
        return {**doc, "_id": None}

    @api.get("/manufacturing/productions")
    async def list_productions(user=Depends(require_shop_user)):
        return await db.mfg_productions.find({"shop_id": _sid(user)}, {"_id": 0}).sort("created_at", -1).to_list(500)

    # ---------- Ledger (General Ledger for one account) ----------
    @api.get("/accounting/ledger/{account_id}")
    async def ledger(
        account_id: str,
        user=Depends(require_shop_user),
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ):
        acc = await db.accounts.find_one({"id": account_id, "shop_id": _sid(user)}, {"_id": 0})
        if not acc:
            raise HTTPException(404, "الحساب غير موجود")
        q = {"shop_id": _sid(user), "lines.account_id": account_id}
        if date_from or date_to:
            q["date"] = {}
            if date_from:
                q["date"]["$gte"] = date_from
            if date_to:
                q["date"]["$lte"] = date_to
        entries = await db.journal_entries.find(q, {"_id": 0}).sort("date", 1).to_list(5000)
        rows = []
        running = 0.0
        for e in entries:
            for ln in e["lines"]:
                if ln["account_id"] != account_id:
                    continue
                dr = ln.get("debit", 0)
                cr = ln.get("credit", 0)
                if acc["type"] in ("asset", "expense"):
                    running += dr - cr
                else:
                    running += cr - dr
                rows.append({
                    "date": e["date"],
                    "je_number": e["number"],
                    "description": e["description"],
                    "reference": e.get("reference", ""),
                    "debit": dr,
                    "credit": cr,
                    "balance": round(running, 2),
                })
        return {"account": acc, "rows": rows, "final_balance": round(running, 2)}

    # ---------- Excel Exports ----------
    def _xlsx_response(wb: Workbook, filename: str):
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
        )

    def _header_style(cell):
        cell.font = Font(bold=True, color="FFFFFF", size=12)
        cell.fill = PatternFill("solid", fgColor="1e293b")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = Border(bottom=Side(style="thin"))

    def _cell_border(cell):
        thin = Side(border_style="thin", color="cccccc")
        cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)

    @api.get("/accounting/vat-report/export.xlsx")
    async def export_vat_xlsx(
        user=Depends(require_shop_user),
        date_from: str = Query(...),
        date_to: str = Query(...),
    ):
        # Reuse VAT logic
        sales = await db.sales.find({
            "shop_id": _sid(user),
            "created_at": {"$gte": f"{date_from}T00:00:00", "$lte": f"{date_to}T23:59:59"},
        }, {"_id": 0}).to_list(10000)
        purchases = await db.purchases.find({
            "shop_id": _sid(user),
            "created_at": {"$gte": f"{date_from}T00:00:00", "$lte": f"{date_to}T23:59:59"},
        }, {"_id": 0}).to_list(10000)
        shop = await db.shops.find_one({"id": _sid(user)}, {"_id": 0}) or {}

        def _extract(invs, sign_key="is_return"):
            base = 0.0
            tax = 0.0
            for inv in invs:
                sign = -1 if inv.get(sign_key) else 1
                for it in inv.get("items", []):
                    sub = it.get("qty", 0) * it.get("price", 0) - it.get("discount", 0)
                    rate = it.get("tax_rate", 0) / 100.0
                    b = sub / (1 + rate) if rate > 0 else sub
                    t = sub - b
                    base += b * sign
                    tax += t * sign
            return base, tax

        sales_base, output_vat = _extract(sales)
        purch_base, input_vat = _extract(purchases)
        payable = output_vat - input_vat

        wb = Workbook()
        ws = wb.active
        ws.title = "كشف الضريبة"
        ws.sheet_view.rightToLeft = True
        ws["A1"] = f"كشف ضريبة القيمة المضافة - {shop.get('name', '')}"
        ws["A1"].font = Font(bold=True, size=16)
        ws.merge_cells("A1:D1")
        ws["A2"] = f"الفترة: من {date_from} إلى {date_to}"
        ws.merge_cells("A2:D2")

        headers = ["البيان", "المبلغ قبل الضريبة", "الضريبة", "الإجمالي"]
        for i, h in enumerate(headers, 1):
            c = ws.cell(row=4, column=i, value=h)
            _header_style(c)

        rows = [
            ("إجمالي المبيعات (ضريبة مخرجات)", sales_base, output_vat, sales_base + output_vat),
            ("إجمالي المشتريات (ضريبة مدخلات)", purch_base, input_vat, purch_base + input_vat),
        ]
        for r, row in enumerate(rows, 5):
            for c, v in enumerate(row, 1):
                cell = ws.cell(row=r, column=c, value=round(v, 2) if isinstance(v, (int, float)) else v)
                _cell_border(cell)
                if c > 1:
                    cell.number_format = "#,##0.00"

        # Result row
        ws.cell(row=8, column=1, value="ضريبة القيمة المضافة المستحقة لسلطة الضرائب:").font = Font(bold=True, size=13)
        result_cell = ws.cell(row=8, column=3, value=round(payable, 2))
        result_cell.font = Font(bold=True, size=13, color="dc2626" if payable > 0 else "059669")
        result_cell.number_format = "#,##0.00"
        result_cell.fill = PatternFill("solid", fgColor="fef3c7" if payable > 0 else "d1fae5")

        for col_letter, w in [("A", 45), ("B", 22), ("C", 22), ("D", 22)]:
            ws.column_dimensions[col_letter].width = w

        filename = f"VAT-Report-{date_from}-to-{date_to}.xlsx"
        return _xlsx_response(wb, filename)

    @api.get("/accounting/trial-balance/export.xlsx")
    async def export_trial_xlsx(
        user=Depends(require_shop_user),
        as_of: Optional[str] = None,
    ):
        await ensure_default_coa(db, _sid(user))
        accounts = await db.accounts.find({"shop_id": _sid(user)}, {"_id": 0}).sort("code", 1).to_list(2000)
        shop = await db.shops.find_one({"id": _sid(user)}, {"_id": 0}) or {}
        match = {"shop_id": _sid(user)}
        if as_of:
            match["date"] = {"$lte": as_of}
        pipe = [
            {"$match": match},
            {"$unwind": "$lines"},
            {"$group": {"_id": "$lines.account_id", "debit": {"$sum": "$lines.debit"}, "credit": {"$sum": "$lines.credit"}}},
        ]
        aggr = {r["_id"]: r async for r in db.journal_entries.aggregate(pipe)}

        wb = Workbook()
        ws = wb.active
        ws.title = "ميزان المراجعة"
        ws.sheet_view.rightToLeft = True
        ws["A1"] = f"ميزان المراجعة - {shop.get('name', '')}"
        ws["A1"].font = Font(bold=True, size=16)
        ws.merge_cells("A1:F1")
        ws["A2"] = f"حتى تاريخ: {as_of or _now_iso()[:10]}"
        ws.merge_cells("A2:F2")

        headers = ["رقم الحساب", "اسم الحساب", "مجموع المدين", "مجموع الدائن", "رصيد مدين", "رصيد دائن"]
        for i, h in enumerate(headers, 1):
            _header_style(ws.cell(row=4, column=i, value=h))

        r = 5
        total_dr = total_cr = 0.0
        for a in accounts:
            if a.get("is_group"):
                continue
            agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
            dr = agg["debit"]
            cr = agg["credit"]
            balance = dr - cr
            if a["type"] in ("asset", "expense"):
                bal_dr = max(balance, 0)
                bal_cr = max(-balance, 0)
            else:
                bal_dr = balance if balance > 0 else 0
                bal_cr = -balance if balance < 0 else 0
            if dr == 0 and cr == 0:
                continue
            total_dr += bal_dr
            total_cr += bal_cr
            ws.cell(row=r, column=1, value=a["code"])
            ws.cell(row=r, column=2, value=a["name"])
            for i, v in enumerate([dr, cr, bal_dr, bal_cr], 3):
                cell = ws.cell(row=r, column=i, value=round(v, 2))
                cell.number_format = "#,##0.00"
                _cell_border(cell)
            r += 1

        # Totals
        ws.cell(row=r, column=2, value="الإجماليات").font = Font(bold=True)
        for i, v in enumerate([total_dr, total_cr], 5):
            cell = ws.cell(row=r, column=i, value=round(v, 2))
            cell.font = Font(bold=True)
            cell.number_format = "#,##0.00"
            cell.fill = PatternFill("solid", fgColor="e5e7eb")

        for col_letter, w in [("A", 14), ("B", 40), ("C", 18), ("D", 18), ("E", 18), ("F", 18)]:
            ws.column_dimensions[col_letter].width = w

        return _xlsx_response(wb, f"Trial-Balance-{as_of or _now_iso()[:10]}.xlsx")

    @api.get("/accounting/profit-loss/export.xlsx")
    async def export_pl_xlsx(
        user=Depends(require_shop_user),
        date_from: str = Query(...),
        date_to: str = Query(...),
    ):
        await ensure_default_coa(db, _sid(user))
        accounts = await db.accounts.find(
            {"shop_id": _sid(user), "type": {"$in": ["revenue", "expense"]}, "is_group": {"$ne": True}},
            {"_id": 0},
        ).to_list(500)
        shop = await db.shops.find_one({"id": _sid(user)}, {"_id": 0}) or {}
        pipe = [
            {"$match": {"shop_id": _sid(user), "date": {"$gte": date_from, "$lte": date_to}}},
            {"$unwind": "$lines"},
            {"$group": {"_id": "$lines.account_id", "debit": {"$sum": "$lines.debit"}, "credit": {"$sum": "$lines.credit"}}},
        ]
        aggr = {r["_id"]: r async for r in db.journal_entries.aggregate(pipe)}

        wb = Workbook()
        ws = wb.active
        ws.title = "الأرباح والخسائر"
        ws.sheet_view.rightToLeft = True
        ws["A1"] = f"قائمة الأرباح والخسائر - {shop.get('name', '')}"
        ws["A1"].font = Font(bold=True, size=16)
        ws.merge_cells("A1:C1")
        ws["A2"] = f"من {date_from} إلى {date_to}"
        ws.merge_cells("A2:C2")

        r = 4
        _header_style(ws.cell(row=r, column=1, value="الحساب"))
        _header_style(ws.cell(row=r, column=2, value="النوع"))
        _header_style(ws.cell(row=r, column=3, value="المبلغ"))
        r += 1

        total_rev = total_exp = 0.0
        for a in accounts:
            agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
            if a["type"] == "revenue":
                amt = agg["credit"] - agg["debit"]
                if amt != 0:
                    ws.cell(row=r, column=1, value=a["name"])
                    ws.cell(row=r, column=2, value="إيراد")
                    c = ws.cell(row=r, column=3, value=round(amt, 2))
                    c.number_format = "#,##0.00"
                    c.fill = PatternFill("solid", fgColor="d1fae5")
                    total_rev += amt
                    r += 1
        ws.cell(row=r, column=1, value="إجمالي الإيرادات").font = Font(bold=True)
        cell = ws.cell(row=r, column=3, value=round(total_rev, 2))
        cell.font = Font(bold=True)
        cell.number_format = "#,##0.00"
        cell.fill = PatternFill("solid", fgColor="a7f3d0")
        r += 2

        for a in accounts:
            agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
            if a["type"] == "expense":
                amt = agg["debit"] - agg["credit"]
                if amt != 0:
                    ws.cell(row=r, column=1, value=a["name"])
                    ws.cell(row=r, column=2, value="مصروف")
                    c = ws.cell(row=r, column=3, value=round(amt, 2))
                    c.number_format = "#,##0.00"
                    c.fill = PatternFill("solid", fgColor="fee2e2")
                    total_exp += amt
                    r += 1
        ws.cell(row=r, column=1, value="إجمالي المصروفات").font = Font(bold=True)
        cell = ws.cell(row=r, column=3, value=round(total_exp, 2))
        cell.font = Font(bold=True)
        cell.number_format = "#,##0.00"
        cell.fill = PatternFill("solid", fgColor="fca5a5")
        r += 2

        net = total_rev - total_exp
        ws.cell(row=r, column=1, value="صافي الربح" if net >= 0 else "صافي الخسارة").font = Font(bold=True, size=13)
        cell = ws.cell(row=r, column=3, value=round(abs(net), 2))
        cell.font = Font(bold=True, size=13, color="059669" if net >= 0 else "dc2626")
        cell.number_format = "#,##0.00"
        cell.fill = PatternFill("solid", fgColor="fef3c7")

        for col_letter, w in [("A", 40), ("B", 14), ("C", 20)]:
            ws.column_dimensions[col_letter].width = w

        return _xlsx_response(wb, f"P&L-{date_from}-to-{date_to}.xlsx")

    @api.get("/accounting/balance-sheet/export.xlsx")
    async def export_bs_xlsx(
        user=Depends(require_shop_user),
        as_of: Optional[str] = None,
    ):
        await ensure_default_coa(db, _sid(user))
        accounts = await db.accounts.find(
            {"shop_id": _sid(user), "is_group": {"$ne": True}}, {"_id": 0}
        ).to_list(2000)
        shop = await db.shops.find_one({"id": _sid(user)}, {"_id": 0}) or {}
        match = {"shop_id": _sid(user)}
        if as_of:
            match["date"] = {"$lte": as_of}
        pipe = [
            {"$match": match},
            {"$unwind": "$lines"},
            {"$group": {"_id": "$lines.account_id", "debit": {"$sum": "$lines.debit"}, "credit": {"$sum": "$lines.credit"}}},
        ]
        aggr = {r["_id"]: r async for r in db.journal_entries.aggregate(pipe)}

        wb = Workbook()
        ws = wb.active
        ws.title = "الميزانية العمومية"
        ws.sheet_view.rightToLeft = True
        ws["A1"] = f"الميزانية العمومية - {shop.get('name', '')}"
        ws["A1"].font = Font(bold=True, size=16)
        ws.merge_cells("A1:B1")
        ws["A2"] = f"حتى تاريخ: {as_of or _now_iso()[:10]}"
        ws.merge_cells("A2:B2")

        r = 4
        ws.cell(row=r, column=1, value="الأصول").font = Font(bold=True, size=14, color="FFFFFF")
        ws.cell(row=r, column=1).fill = PatternFill("solid", fgColor="1e293b")
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        r += 1

        total_a = total_l = total_e = 0.0
        net_income = 0.0
        for a in accounts:
            agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
            if a["type"] == "asset":
                amt = agg["debit"] - agg["credit"]
                if amt != 0:
                    ws.cell(row=r, column=1, value=a["name"])
                    c = ws.cell(row=r, column=2, value=round(amt, 2))
                    c.number_format = "#,##0.00"
                    total_a += amt
                    r += 1
            elif a["type"] == "revenue":
                net_income += agg["credit"] - agg["debit"]
            elif a["type"] == "expense":
                net_income -= agg["debit"] - agg["credit"]

        ws.cell(row=r, column=1, value="إجمالي الأصول").font = Font(bold=True)
        c = ws.cell(row=r, column=2, value=round(total_a, 2))
        c.font = Font(bold=True); c.number_format = "#,##0.00"
        c.fill = PatternFill("solid", fgColor="e5e7eb")
        r += 2

        ws.cell(row=r, column=1, value="الخصوم").font = Font(bold=True, size=14, color="FFFFFF")
        ws.cell(row=r, column=1).fill = PatternFill("solid", fgColor="991b1b")
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        r += 1
        for a in accounts:
            if a["type"] == "liability":
                agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
                amt = agg["credit"] - agg["debit"]
                if amt != 0:
                    ws.cell(row=r, column=1, value=a["name"])
                    c = ws.cell(row=r, column=2, value=round(amt, 2))
                    c.number_format = "#,##0.00"
                    total_l += amt
                    r += 1
        ws.cell(row=r, column=1, value="إجمالي الخصوم").font = Font(bold=True)
        c = ws.cell(row=r, column=2, value=round(total_l, 2))
        c.font = Font(bold=True); c.number_format = "#,##0.00"
        c.fill = PatternFill("solid", fgColor="fca5a5")
        r += 2

        ws.cell(row=r, column=1, value="حقوق الملكية").font = Font(bold=True, size=14, color="FFFFFF")
        ws.cell(row=r, column=1).fill = PatternFill("solid", fgColor="6d28d9")
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        r += 1
        for a in accounts:
            if a["type"] == "equity":
                agg = aggr.get(a["id"], {"debit": 0, "credit": 0})
                amt = agg["credit"] - agg["debit"]
                if amt != 0:
                    ws.cell(row=r, column=1, value=a["name"])
                    c = ws.cell(row=r, column=2, value=round(amt, 2))
                    c.number_format = "#,##0.00"
                    total_e += amt
                    r += 1
        if net_income != 0:
            ws.cell(row=r, column=1, value="صافي ربح الفترة").font = Font(italic=True)
            c = ws.cell(row=r, column=2, value=round(net_income, 2))
            c.number_format = "#,##0.00"
            total_e += net_income
            r += 1
        ws.cell(row=r, column=1, value="إجمالي حقوق الملكية").font = Font(bold=True)
        c = ws.cell(row=r, column=2, value=round(total_e, 2))
        c.font = Font(bold=True); c.number_format = "#,##0.00"
        c.fill = PatternFill("solid", fgColor="c7d2fe")
        r += 1

        ws.cell(row=r, column=1, value="إجمالي الخصوم + حقوق الملكية").font = Font(bold=True, size=13)
        c = ws.cell(row=r, column=2, value=round(total_l + total_e, 2))
        c.font = Font(bold=True, size=13); c.number_format = "#,##0.00"
        c.fill = PatternFill("solid", fgColor="fef3c7")

        for col_letter, w in [("A", 45), ("B", 22)]:
            ws.column_dimensions[col_letter].width = w

        return _xlsx_response(wb, f"Balance-Sheet-{as_of or _now_iso()[:10]}.xlsx")

    # ---------- Fixed Assets ----------
    @api.get("/fixed-assets")
    async def list_fixed_assets(user=Depends(require_shop_user), as_of: Optional[str] = None):
        await ensure_fixed_asset_accounts(db, _sid(user))
        as_of = as_of or _now_iso()[:10]
        rows = await db.fixed_assets.find({"shop_id": _sid(user)}, {"_id": 0}).sort("purchase_date", -1).to_list(1000)
        for r in rows:
            r["depreciation"] = _compute_depreciation(r, as_of)
        return rows

    @api.get("/fixed-assets/summary")
    async def fixed_assets_summary(user=Depends(require_shop_user), as_of: Optional[str] = None):
        as_of = as_of or _now_iso()[:10]
        rows = await db.fixed_assets.find({"shop_id": _sid(user), "disposed_at": None}, {"_id": 0}).to_list(1000)
        gross = sum(r["purchase_cost"] for r in rows)
        accumulated = sum(_compute_depreciation(r, as_of)["accumulated"] for r in rows)
        return {
            "as_of": as_of,
            "count": len(rows),
            "gross_cost": round(gross, 2),
            "accumulated_depreciation": round(accumulated, 2),
            "net_book_value": round(gross - accumulated, 2),
        }

    @api.post("/fixed-assets")
    async def create_fixed_asset(data: FixedAssetIn, user=Depends(require_shop_user)):
        await ensure_fixed_asset_accounts(db, _sid(user))
        # Create individual asset account under 1201
        parent = await db.accounts.find_one({"shop_id": _sid(user), "code": "1201"})
        # Next code
        last = await db.accounts.find({"shop_id": _sid(user), "code": {"$regex": "^1201"}}).sort("code", -1).limit(1).to_list(1)
        try:
            next_code = str(int(last[0]["code"]) + 1) if last and last[0]["code"] != "1201" else "120101"
        except Exception:
            next_code = f"1201{len(last) + 1:02d}"
        asset_acc_id = _new_id()
        await db.accounts.insert_one({
            "id": asset_acc_id,
            "shop_id": _sid(user),
            "code": next_code,
            "name": f"أصل ثابت - {data.name}",
            "type": "asset",
            "parent_id": parent["id"] if parent else None,
            "is_group": False,
            "is_system": True,
            "is_fixed_asset_item": True,
            "balance": 0.0,
            "created_at": _now_iso(),
        })
        asset_id = _new_id()
        doc = {
            "id": asset_id,
            "shop_id": _sid(user),
            **data.model_dump(),
            "asset_account_id": asset_acc_id,
            "accumulated_dep_posted": 0.0,
            "last_dep_date": None,
            "disposed_at": None,
            "created_at": _now_iso(),
        }
        await db.fixed_assets.insert_one(doc)
        # Post purchase JE
        pay_acc = None
        if data.payment_account_id:
            pay_acc = await db.accounts.find_one({"id": data.payment_account_id, "shop_id": _sid(user)})
        if not pay_acc:
            pay_acc = await get_system_account(db, _sid(user), "is_cash")
        if pay_acc:
            await post_journal(db, _sid(user), user["id"], {
                "date": data.purchase_date,
                "description": f"شراء أصل ثابت - {data.name}",
                "lines": [
                    {"account_id": asset_acc_id, "account_name": f"أصل ثابت - {data.name}", "debit": data.purchase_cost, "credit": 0},
                    {"account_id": pay_acc["id"], "account_name": pay_acc["name"], "debit": 0, "credit": data.purchase_cost},
                ],
                "reference": f"FA-BUY-{asset_id[:8]}",
                "source": "fixed_asset_purchase",
                "source_id": asset_id,
            })
        doc.pop("_id", None)
        return doc

    @api.post("/fixed-assets/{aid}/depreciate")
    async def depreciate_asset(aid: str, data: DepreciateIn, user=Depends(require_shop_user)):
        asset = await db.fixed_assets.find_one({"id": aid, "shop_id": _sid(user)})
        if not asset:
            raise HTTPException(404, "الأصل غير موجود")
        if asset.get("disposed_at"):
            raise HTTPException(400, "الأصل مُخرَج، لا يمكن إهلاكه")
        computed = _compute_depreciation(asset, data.as_of)
        already_posted = asset.get("accumulated_dep_posted", 0)
        to_post = round(computed["accumulated"] - already_posted, 2)
        if to_post <= 0:
            return {"ok": True, "already_up_to_date": True, "computed": computed}
        exp_acc = await get_system_account(db, _sid(user), "is_depreciation_expense")
        acc_dep_acc = await get_system_account(db, _sid(user), "is_accumulated_dep")
        if not exp_acc or not acc_dep_acc:
            raise HTTPException(500, "حسابات الإهلاك غير معدّة")
        await post_journal(db, _sid(user), user["id"], {
            "date": data.as_of,
            "description": f"إهلاك شهري - {asset['name']}",
            "lines": [
                {"account_id": exp_acc["id"], "account_name": exp_acc["name"], "debit": to_post, "credit": 0},
                {"account_id": acc_dep_acc["id"], "account_name": acc_dep_acc["name"], "debit": 0, "credit": to_post},
            ],
            "reference": f"DEP-{aid[:8]}",
            "source": "depreciation",
            "source_id": aid,
        })
        await db.fixed_assets.update_one(
            {"id": aid},
            {"$set": {"accumulated_dep_posted": computed["accumulated"], "last_dep_date": data.as_of}},
        )
        return {"ok": True, "posted": to_post, "computed": computed}

    @api.post("/fixed-assets/depreciate-all")
    async def depreciate_all(data: DepreciateIn, user=Depends(require_shop_user)):
        assets = await db.fixed_assets.find({"shop_id": _sid(user), "disposed_at": None}).to_list(1000)
        exp_acc = await get_system_account(db, _sid(user), "is_depreciation_expense")
        acc_dep_acc = await get_system_account(db, _sid(user), "is_accumulated_dep")
        posted = 0.0
        count = 0
        for asset in assets:
            computed = _compute_depreciation(asset, data.as_of)
            already = asset.get("accumulated_dep_posted", 0)
            to_post = round(computed["accumulated"] - already, 2)
            if to_post <= 0:
                continue
            await post_journal(db, _sid(user), user["id"], {
                "date": data.as_of,
                "description": f"إهلاك شهري - {asset['name']}",
                "lines": [
                    {"account_id": exp_acc["id"], "account_name": exp_acc["name"], "debit": to_post, "credit": 0},
                    {"account_id": acc_dep_acc["id"], "account_name": acc_dep_acc["name"], "debit": 0, "credit": to_post},
                ],
                "reference": f"DEP-{asset['id'][:8]}",
                "source": "depreciation",
                "source_id": asset["id"],
            })
            await db.fixed_assets.update_one(
                {"id": asset["id"]},
                {"$set": {"accumulated_dep_posted": computed["accumulated"], "last_dep_date": data.as_of}},
            )
            posted += to_post
            count += 1
        return {"ok": True, "posted_total": round(posted, 2), "assets_updated": count}

    @api.delete("/fixed-assets/{aid}")
    async def dispose_asset(aid: str, user=Depends(require_shop_user)):
        asset = await db.fixed_assets.find_one({"id": aid, "shop_id": _sid(user)})
        if not asset:
            raise HTTPException(404, "الأصل غير موجود")
        await db.fixed_assets.update_one({"id": aid}, {"$set": {"disposed_at": _now_iso()}})
        return {"ok": True}

    return api
