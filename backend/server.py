from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import io
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
import logging
from openpyxl import load_workbook, Workbook
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest
)
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json as _json
import csv as _csv

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGO = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

app = FastAPI()
api = APIRouter(prefix="/api")

logger = logging.getLogger("pos")
logging.basicConfig(level=logging.INFO)

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_access_token(user_id: str, role: str, shop_id: Optional[str]) -> str:
    payload = {
        "sub": user_id, "role": role, "shop_id": shop_id,
        "exp": now_utc() + timedelta(days=7), "type": "access"
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

# ---------- Models ----------
class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str
    shop_id: Optional[str] = None
    is_active: bool = True

class LoginIn(BaseModel):
    email: str
    password: str

class ShopCreate(BaseModel):
    name: str
    owner_email: EmailStr
    owner_name: str
    owner_password: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    subscription_months: int = 12

class ShopUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None
    subscription_expires_at: Optional[str] = None

class SubExtendIn(BaseModel):
    months: int = 12

class CategoryIn(BaseModel):
    name: str
    color: Optional[str] = "#3b82f6"

class ProductIn(BaseModel):
    name: str
    barcode: Optional[str] = ""
    category_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    cost_price: float = 0
    sale_price: float = 0
    stock: float = 0
    min_stock: float = 0
    unit: str = "قطعة"
    tax_rate: float = 0
    is_active: bool = True

class WarehouseIn(BaseModel):
    name: str
    location: Optional[str] = ""
    is_default: bool = False

class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    opening_balance: float = 0

class SupplierIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    opening_balance: float = 0

class EmployeeIn(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: Literal["cashier", "accountant", "manager"] = "cashier"
    is_active: bool = True

class InvoiceItem(BaseModel):
    product_id: str
    name: str
    qty: float
    price: float
    cost: float = 0
    discount: float = 0
    tax_rate: float = 0

class SaleIn(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = "زبون نقدي"
    warehouse_id: Optional[str] = None
    items: List[InvoiceItem]
    discount: float = 0
    paid: float = 0
    payment_method: Literal["cash", "card", "credit"] = "cash"
    notes: Optional[str] = ""
    is_return: bool = False
    original_invoice_id: Optional[str] = None

class PurchaseIn(BaseModel):
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = ""
    warehouse_id: Optional[str] = None
    items: List[InvoiceItem]
    discount: float = 0
    paid: float = 0
    notes: Optional[str] = ""
    is_return: bool = False

class ExpenseIn(BaseModel):
    category: str
    amount: float
    notes: Optional[str] = ""

class ShiftAction(BaseModel):
    opening_cash: float = 0
    closing_cash: Optional[float] = None
    notes: Optional[str] = ""

class HeldInvoiceIn(BaseModel):
    label: Optional[str] = ""
    customer_name: Optional[str] = "زبون نقدي"
    warehouse_id: Optional[str] = None
    items: List[InvoiceItem]
    discount: float = 0
    notes: Optional[str] = ""

class TransferItem(BaseModel):
    product_id: str
    name: str
    qty: float

class TransferIn(BaseModel):
    from_warehouse_id: str
    to_warehouse_id: str
    items: List[TransferItem]
    notes: Optional[str] = ""

class CheckoutIn(BaseModel):
    months: int = 12
    origin_url: str

# ---------- Auth Dependencies ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("is_active", True):
        raise HTTPException(401, "User not found")
    return user

async def require_super_admin(user=Depends(get_current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(403, "Super admin only")
    return user

async def require_shop_user(user=Depends(get_current_user)):
    if user["role"] == "super_admin" or not user.get("shop_id"):
        raise HTTPException(403, "Shop user required")
    # Check shop subscription
    shop = await db.shops.find_one({"id": user["shop_id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(403, "Shop not found")
    if not shop.get("is_active", True):
        raise HTTPException(403, "الاشتراك موقوف من قِبل الإدارة")
    exp = shop.get("subscription_expires_at")
    if exp:
        exp_dt = datetime.fromisoformat(exp)
        if exp_dt < now_utc():
            raise HTTPException(403, "انتهى الاشتراك، يرجى التواصل مع الإدارة")
    user["_shop"] = shop
    return user

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=True, samesite="none", max_age=7*24*3600, path="/"
    )

# ---------- Auth Endpoints ----------
@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(401, "بيانات الدخول غير صحيحة")
    if not user.get("is_active", True):
        raise HTTPException(403, "الحساب موقوف")
    # For shop users, check shop active
    if user.get("shop_id"):
        shop = await db.shops.find_one({"id": user["shop_id"]})
        if not shop or not shop.get("is_active", True):
            raise HTTPException(403, "المحل موقوف من قِبل الإدارة")
    token = create_access_token(user["id"], user["role"], user.get("shop_id"))
    set_auth_cookie(response, token)
    return {
        "token": token,
        "user": {k: user[k] for k in ["id","email","name","role","shop_id","is_active"] if k in user}
    }

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    out = {k: user.get(k) for k in ["id","email","name","role","shop_id","is_active"]}
    if user.get("shop_id"):
        shop = await db.shops.find_one({"id": user["shop_id"]}, {"_id": 0, "password_hash": 0})
        out["shop"] = shop
    return out

# ---------- Super Admin: Shops ----------
@api.get("/admin/stats")
async def admin_stats(_=Depends(require_super_admin)):
    total_shops = await db.shops.count_documents({})
    active_shops = await db.shops.count_documents({"is_active": True})
    now_iso = iso(now_utc())
    expired = await db.shops.count_documents({"subscription_expires_at": {"$lt": now_iso}})
    # Revenue: sum of subscription payments this year
    payments = await db.subscription_payments.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    revenue = payments[0]["total"] if payments else 0
    # Global sales across all shops
    sales_agg = await db.sales.aggregate([
        {"$match": {"is_return": False}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total": {"$sum": "$total"}}}
    ]).to_list(1)
    total_sales = sales_agg[0]["total"] if sales_agg else 0
    total_invoices = sales_agg[0]["count"] if sales_agg else 0
    return {
        "total_shops": total_shops,
        "active_shops": active_shops,
        "expired_shops": expired,
        "subscription_revenue": revenue,
        "total_sales": total_sales,
        "total_invoices": total_invoices,
    }

@api.get("/admin/shops")
async def list_shops(_=Depends(require_super_admin)):
    shops = await db.shops.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # attach owner + basic stats
    for s in shops:
        owner = await db.users.find_one({"shop_id": s["id"], "role": "shop_owner"}, {"_id": 0, "password_hash": 0})
        s["owner"] = owner
        sales_agg = await db.sales.aggregate([
            {"$match": {"shop_id": s["id"], "is_return": False}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        s["sales_total"] = sales_agg[0]["total"] if sales_agg else 0
        s["invoices_count"] = sales_agg[0]["count"] if sales_agg else 0
    return shops

@api.post("/admin/shops")
async def create_shop(data: ShopCreate, _=Depends(require_super_admin)):
    email = data.owner_email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "البريد الإلكتروني مستخدم من قبل")
    shop_id = new_id()
    exp = now_utc() + timedelta(days=30*data.subscription_months)
    shop_doc = {
        "id": shop_id, "name": data.name, "phone": data.phone or "",
        "address": data.address or "", "is_active": True,
        "subscription_expires_at": iso(exp),
        "created_at": iso(now_utc()),
    }
    await db.shops.insert_one(shop_doc)
    # Create default warehouse
    await db.warehouses.insert_one({
        "id": new_id(), "shop_id": shop_id, "name": "المخزن الرئيسي",
        "location": "", "is_default": True, "created_at": iso(now_utc()),
    })
    owner_doc = {
        "id": new_id(), "email": email, "name": data.owner_name,
        "password_hash": hash_password(data.owner_password),
        "role": "shop_owner", "shop_id": shop_id, "is_active": True,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(owner_doc)
    # Record initial subscription payment
    await db.subscription_payments.insert_one({
        "id": new_id(), "shop_id": shop_id, "months": data.subscription_months,
        "amount": 0, "created_at": iso(now_utc()),
    })
    return {"ok": True, "shop_id": shop_id}

@api.patch("/admin/shops/{shop_id}")
async def update_shop(shop_id: str, data: ShopUpdate, _=Depends(require_super_admin)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if not upd:
        return {"ok": True}
    await db.shops.update_one({"id": shop_id}, {"$set": upd})
    return {"ok": True}

@api.post("/admin/shops/{shop_id}/extend")
async def extend_subscription(shop_id: str, data: SubExtendIn, _=Depends(require_super_admin)):
    shop = await db.shops.find_one({"id": shop_id})
    if not shop:
        raise HTTPException(404, "Shop not found")
    current_exp = shop.get("subscription_expires_at")
    base = datetime.fromisoformat(current_exp) if current_exp else now_utc()
    if base < now_utc():
        base = now_utc()
    new_exp = base + timedelta(days=30*data.months)
    await db.shops.update_one({"id": shop_id}, {"$set": {"subscription_expires_at": iso(new_exp), "is_active": True}})
    await db.subscription_payments.insert_one({
        "id": new_id(), "shop_id": shop_id, "months": data.months, "amount": 0,
        "created_at": iso(now_utc()),
    })
    return {"ok": True, "subscription_expires_at": iso(new_exp)}

@api.delete("/admin/shops/{shop_id}")
async def delete_shop(shop_id: str, _=Depends(require_super_admin)):
    await db.shops.delete_one({"id": shop_id})
    await db.users.delete_many({"shop_id": shop_id})
    await db.products.delete_many({"shop_id": shop_id})
    await db.sales.delete_many({"shop_id": shop_id})
    await db.purchases.delete_many({"shop_id": shop_id})
    await db.customers.delete_many({"shop_id": shop_id})
    await db.suppliers.delete_many({"shop_id": shop_id})
    await db.expenses.delete_many({"shop_id": shop_id})
    return {"ok": True}

# ---------- Shop scoped helpers ----------
def sid(user): return user["shop_id"]

# ---------- Categories ----------
@api.get("/categories")
async def list_categories(user=Depends(require_shop_user)):
    return await db.categories.find({"shop_id": sid(user)}, {"_id": 0}).sort("name", 1).to_list(1000)

@api.post("/categories")
async def create_category(data: CategoryIn, user=Depends(require_shop_user)):
    doc = {"id": new_id(), "shop_id": sid(user), **data.model_dump(), "created_at": iso(now_utc())}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/categories/{cid}")
async def delete_category(cid: str, user=Depends(require_shop_user)):
    await db.categories.delete_one({"id": cid, "shop_id": sid(user)})
    return {"ok": True}

# ---------- Warehouses ----------
async def _ensure_default_warehouse(shop_id: str) -> str:
    w = await db.warehouses.find_one({"shop_id": shop_id, "is_default": True})
    if w: return w["id"]
    w2 = await db.warehouses.find_one({"shop_id": shop_id})
    if w2:
        await db.warehouses.update_one({"id": w2["id"]}, {"$set": {"is_default": True}})
        return w2["id"]
    wid = new_id()
    await db.warehouses.insert_one({
        "id": wid, "shop_id": shop_id, "name": "المخزن الرئيسي",
        "location": "", "is_default": True, "created_at": iso(now_utc()),
    })
    return wid

@api.get("/warehouses")
async def list_warehouses(user=Depends(require_shop_user)):
    await _ensure_default_warehouse(sid(user))
    return await db.warehouses.find({"shop_id": sid(user)}, {"_id": 0}).sort("name", 1).to_list(100)

@api.post("/warehouses")
async def create_warehouse(data: WarehouseIn, user=Depends(require_shop_user)):
    if data.is_default:
        await db.warehouses.update_many({"shop_id": sid(user)}, {"$set": {"is_default": False}})
    doc = {"id": new_id(), "shop_id": sid(user), **data.model_dump(), "created_at": iso(now_utc())}
    await db.warehouses.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/warehouses/{wid}")
async def update_warehouse(wid: str, data: WarehouseIn, user=Depends(require_shop_user)):
    if data.is_default:
        await db.warehouses.update_many({"shop_id": sid(user)}, {"$set": {"is_default": False}})
    await db.warehouses.update_one({"id": wid, "shop_id": sid(user)}, {"$set": data.model_dump()})
    return {"ok": True}

@api.delete("/warehouses/{wid}")
async def delete_warehouse(wid: str, user=Depends(require_shop_user)):
    count = await db.warehouses.count_documents({"shop_id": sid(user)})
    if count <= 1:
        raise HTTPException(400, "لا يمكن حذف آخر مخزن")
    w = await db.warehouses.find_one({"id": wid, "shop_id": sid(user)})
    if w and w.get("is_default"):
        raise HTTPException(400, "لا يمكن حذف المخزن الافتراضي")
    await db.warehouses.delete_one({"id": wid, "shop_id": sid(user)})
    return {"ok": True}

# ---------- Products ----------
@api.get("/products")
async def list_products(user=Depends(require_shop_user)):
    return await db.products.find({"shop_id": sid(user)}, {"_id": 0}).sort("name", 1).to_list(5000)

def _gen_barcode() -> str:
    """Generate a 13-digit EAN-13-style internal barcode (prefix 2)."""
    import random
    return "2" + "".join(str(random.randint(0, 9)) for _ in range(12))

@api.post("/products")
async def create_product(data: ProductIn, user=Depends(require_shop_user)):
    payload = data.model_dump()
    if not payload.get("warehouse_id"):
        payload["warehouse_id"] = await _ensure_default_warehouse(sid(user))
    if not payload.get("barcode"):
        # Ensure uniqueness within shop
        for _ in range(5):
            b = _gen_barcode()
            existing = await db.products.find_one({"shop_id": sid(user), "barcode": b})
            if not existing:
                payload["barcode"] = b
                break
    doc = {"id": new_id(), "shop_id": sid(user), **payload, "created_at": iso(now_utc())}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/products/{pid}")
async def update_product(pid: str, data: ProductIn, user=Depends(require_shop_user)):
    await db.products.update_one({"id": pid, "shop_id": sid(user)}, {"$set": data.model_dump()})
    return {"ok": True}

@api.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(require_shop_user)):
    await db.products.delete_one({"id": pid, "shop_id": sid(user)})
    return {"ok": True}

# ---------- Customers / Suppliers ----------
@api.get("/customers")
async def list_customers(user=Depends(require_shop_user)):
    return await db.customers.find({"shop_id": sid(user)}, {"_id": 0}).sort("name", 1).to_list(5000)

@api.post("/customers")
async def create_customer(data: CustomerIn, user=Depends(require_shop_user)):
    doc = {"id": new_id(), "shop_id": sid(user), **data.model_dump(),
           "balance": data.opening_balance, "created_at": iso(now_utc())}
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user=Depends(require_shop_user)):
    await db.customers.delete_one({"id": cid, "shop_id": sid(user)})
    return {"ok": True}

@api.get("/suppliers")
async def list_suppliers(user=Depends(require_shop_user)):
    return await db.suppliers.find({"shop_id": sid(user)}, {"_id": 0}).sort("name", 1).to_list(5000)

@api.post("/suppliers")
async def create_supplier(data: SupplierIn, user=Depends(require_shop_user)):
    doc = {"id": new_id(), "shop_id": sid(user), **data.model_dump(),
           "balance": data.opening_balance, "created_at": iso(now_utc())}
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/suppliers/{sid_}")
async def delete_supplier(sid_: str, user=Depends(require_shop_user)):
    await db.suppliers.delete_one({"id": sid_, "shop_id": sid(user)})
    return {"ok": True}

# ---------- Employees ----------
@api.get("/employees")
async def list_employees(user=Depends(require_shop_user)):
    return await db.users.find(
        {"shop_id": sid(user), "role": {"$in": ["cashier","accountant","manager"]}},
        {"_id": 0, "password_hash": 0}
    ).sort("name", 1).to_list(1000)

@api.post("/employees")
async def create_employee(data: EmployeeIn, user=Depends(require_shop_user)):
    email = data.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "البريد مستخدم مسبقاً")
    doc = {
        "id": new_id(), "email": email, "name": data.name,
        "password_hash": hash_password(data.password),
        "role": data.role, "shop_id": sid(user), "is_active": data.is_active,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc

@api.delete("/employees/{eid}")
async def delete_employee(eid: str, user=Depends(require_shop_user)):
    await db.users.delete_one({"id": eid, "shop_id": sid(user)})
    return {"ok": True}

# ---------- Sales ----------
def _compute_totals(items, discount):
    subtotal = sum(i.qty * i.price - i.discount for i in items)
    tax = sum((i.qty * i.price - i.discount) * (i.tax_rate/100) for i in items)
    total = subtotal + tax - discount
    cost_total = sum(i.qty * i.cost for i in items)
    return subtotal, tax, total, cost_total

@api.post("/sales")
async def create_sale(data: SaleIn, user=Depends(require_shop_user)):
    subtotal, tax, total, cost_total = _compute_totals(data.items, data.discount)
    # Find current open shift for this user (if any)
    shift = await db.shifts.find_one({"shop_id": sid(user), "user_id": user["id"], "closed_at": None})
    # Generate sequential invoice number per shop
    counter = await db.counters.find_one_and_update(
        {"shop_id": sid(user), "type": "sale"},
        {"$inc": {"value": 1}}, upsert=True, return_document=True
    )
    inv_no = counter["value"] if counter else 1
    doc = {
        "id": new_id(), "shop_id": sid(user), "invoice_no": inv_no,
        "shift_id": shift["id"] if shift else None,
        "cashier_id": user["id"], "cashier_name": user.get("name",""),
        "customer_id": data.customer_id, "customer_name": data.customer_name or "زبون نقدي",
        "items": [i.model_dump() for i in data.items],
        "subtotal": subtotal, "tax": tax, "discount": data.discount,
        "total": total * (-1 if data.is_return else 1),
        "cost_total": cost_total,
        "profit": (total - cost_total) * (-1 if data.is_return else 1),
        "paid": data.paid, "payment_method": data.payment_method,
        "is_return": data.is_return, "notes": data.notes or "",
        "created_at": iso(now_utc()),
    }
    await db.sales.insert_one(doc)
    # Update stock
    for it in data.items:
        delta = it.qty if data.is_return else -it.qty
        await db.products.update_one(
            {"id": it.product_id, "shop_id": sid(user)},
            {"$inc": {"stock": delta}}
        )
    # Update customer balance
    if data.customer_id and data.payment_method == "credit":
        await db.customers.update_one(
            {"id": data.customer_id, "shop_id": sid(user)},
            {"$inc": {"balance": (total - data.paid) * (-1 if data.is_return else 1)}}
        )
    doc.pop("_id", None)
    return doc

@api.get("/sales")
async def list_sales(user=Depends(require_shop_user), limit: int = 200):
    return await db.sales.find({"shop_id": sid(user)}, {"_id": 0}).sort("created_at", -1).to_list(limit)

@api.get("/sales/{sid_}")
async def get_sale(sid_: str, user=Depends(require_shop_user)):
    s = await db.sales.find_one({"id": sid_, "shop_id": sid(user)}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    return s

@api.post("/sales/{sid_}/return")
async def return_sale(sid_: str, user=Depends(require_shop_user)):
    """Create a full return for the given sale. Idempotent-per-invoice via original_invoice_id check."""
    src = await db.sales.find_one({"id": sid_, "shop_id": sid(user)})
    if not src:
        raise HTTPException(404, "الفاتورة غير موجودة")
    if src.get("is_return"):
        raise HTTPException(400, "لا يمكن إرجاع فاتورة مرتجع")
    already = await db.sales.find_one({"shop_id": sid(user), "original_invoice_id": sid_})
    if already:
        raise HTTPException(400, "تمّ إرجاع هذه الفاتورة سابقاً")
    counter = await db.counters.find_one_and_update(
        {"shop_id": sid(user), "type": "sale"},
        {"$inc": {"value": 1}}, upsert=True, return_document=True
    )
    inv_no = counter["value"] if counter else 1
    doc = {
        "id": new_id(), "shop_id": sid(user), "invoice_no": inv_no,
        "shift_id": None, "cashier_id": user["id"], "cashier_name": user.get("name",""),
        "customer_id": src.get("customer_id"), "customer_name": src.get("customer_name"),
        "items": src.get("items", []),
        "subtotal": src.get("subtotal", 0), "tax": src.get("tax", 0),
        "discount": src.get("discount", 0),
        "total": -abs(src.get("total", 0)),
        "cost_total": src.get("cost_total", 0),
        "profit": -abs(src.get("profit", 0)),
        "paid": -abs(src.get("total", 0)),
        "payment_method": src.get("payment_method", "cash"),
        "is_return": True,
        "original_invoice_id": sid_,
        "original_invoice_no": src.get("invoice_no"),
        "notes": f"مرتجع فاتورة #{src.get('invoice_no')}",
        "created_at": iso(now_utc()),
    }
    await db.sales.insert_one(doc)
    # Restore stock
    for it in src.get("items", []):
        await db.products.update_one(
            {"id": it["product_id"], "shop_id": sid(user)},
            {"$inc": {"stock": it["qty"]}}
        )
    # Customer balance
    if src.get("customer_id") and src.get("payment_method") == "credit":
        await db.customers.update_one(
            {"id": src["customer_id"], "shop_id": sid(user)},
            {"$inc": {"balance": abs(src.get("total", 0))}}
        )
    doc.pop("_id", None)
    return doc

# ---------- Purchases ----------
@api.post("/purchases")
async def create_purchase(data: PurchaseIn, user=Depends(require_shop_user)):
    subtotal, tax, total, _ = _compute_totals(data.items, data.discount)
    counter = await db.counters.find_one_and_update(
        {"shop_id": sid(user), "type": "purchase"},
        {"$inc": {"value": 1}}, upsert=True, return_document=True
    )
    inv_no = counter["value"] if counter else 1
    doc = {
        "id": new_id(), "shop_id": sid(user), "invoice_no": inv_no,
        "supplier_id": data.supplier_id, "supplier_name": data.supplier_name or "",
        "items": [i.model_dump() for i in data.items],
        "subtotal": subtotal, "tax": tax, "discount": data.discount,
        "total": total * (-1 if data.is_return else 1),
        "paid": data.paid, "is_return": data.is_return, "notes": data.notes or "",
        "created_at": iso(now_utc()),
    }
    await db.purchases.insert_one(doc)
    # Update stock & cost
    for it in data.items:
        delta = -it.qty if data.is_return else it.qty
        update = {"$inc": {"stock": delta}}
        if not data.is_return and it.cost > 0:
            update["$set"] = {"cost_price": it.cost}
        await db.products.update_one(
            {"id": it.product_id, "shop_id": sid(user)}, update
        )
    if data.supplier_id:
        await db.suppliers.update_one(
            {"id": data.supplier_id, "shop_id": sid(user)},
            {"$inc": {"balance": (total - data.paid) * (1 if not data.is_return else -1)}}
        )
    doc.pop("_id", None)
    return doc

@api.get("/purchases")
async def list_purchases(user=Depends(require_shop_user), limit: int = 200):
    return await db.purchases.find({"shop_id": sid(user)}, {"_id": 0}).sort("created_at", -1).to_list(limit)

# ---------- Expenses ----------
@api.get("/expenses")
async def list_expenses(user=Depends(require_shop_user)):
    return await db.expenses.find({"shop_id": sid(user)}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api.post("/expenses")
async def create_expense(data: ExpenseIn, user=Depends(require_shop_user)):
    doc = {"id": new_id(), "shop_id": sid(user), **data.model_dump(),
           "user_id": user["id"], "created_at": iso(now_utc())}
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user=Depends(require_shop_user)):
    await db.expenses.delete_one({"id": eid, "shop_id": sid(user)})
    return {"ok": True}

# ---------- Shifts ----------
@api.get("/shifts/current")
async def current_shift(user=Depends(require_shop_user)):
    return await db.shifts.find_one(
        {"shop_id": sid(user), "user_id": user["id"], "closed_at": None},
        {"_id": 0}
    )

@api.post("/shifts/open")
async def open_shift(data: ShiftAction, user=Depends(require_shop_user)):
    existing = await db.shifts.find_one({"shop_id": sid(user), "user_id": user["id"], "closed_at": None})
    if existing:
        raise HTTPException(400, "يوجد وردية مفتوحة بالفعل")
    doc = {
        "id": new_id(), "shop_id": sid(user), "user_id": user["id"],
        "user_name": user.get("name",""),
        "opening_cash": data.opening_cash, "closing_cash": None,
        "opened_at": iso(now_utc()), "closed_at": None, "notes": data.notes or "",
    }
    await db.shifts.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.post("/shifts/close")
async def close_shift(data: ShiftAction, user=Depends(require_shop_user)):
    shift = await db.shifts.find_one({"shop_id": sid(user), "user_id": user["id"], "closed_at": None})
    if not shift:
        raise HTTPException(400, "لا توجد وردية مفتوحة")
    # Compute cash sales during shift
    sales = await db.sales.aggregate([
        {"$match": {"shift_id": shift["id"], "payment_method": "cash", "is_return": False}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    returns = await db.sales.aggregate([
        {"$match": {"shift_id": shift["id"], "is_return": True}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]).to_list(1)
    all_sales = await db.sales.aggregate([
        {"$match": {"shift_id": shift["id"], "is_return": False}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    cash_sales = sales[0]["total"] if sales else 0
    returns_total = abs(returns[0]["total"]) if returns else 0
    total_sales = all_sales[0]["total"] if all_sales else 0
    invoices_count = all_sales[0]["count"] if all_sales else 0
    expected_cash = shift["opening_cash"] + cash_sales - returns_total
    closing_cash = data.closing_cash or 0
    variance = closing_cash - expected_cash
    summary = {
        "cash_sales": cash_sales, "returns_total": returns_total,
        "total_sales": total_sales, "invoices_count": invoices_count,
        "expected_cash": expected_cash, "closing_cash": closing_cash,
        "variance": variance,
    }
    await db.shifts.update_one(
        {"id": shift["id"]},
        {"$set": {
            "closing_cash": closing_cash, "closed_at": iso(now_utc()),
            "notes": data.notes or shift.get("notes",""),
            "summary": summary,
        }}
    )
    return {"ok": True, "summary": summary}

@api.get("/shifts")
async def list_shifts(user=Depends(require_shop_user), limit: int = 100):
    return await db.shifts.find({"shop_id": sid(user)}, {"_id": 0}).sort("opened_at", -1).to_list(limit)

# ---------- Held Invoices (parked carts) ----------
@api.get("/held-invoices")
async def list_held(user=Depends(require_shop_user)):
    return await db.held_invoices.find({"shop_id": sid(user)}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api.post("/held-invoices")
async def hold_invoice(data: HeldInvoiceIn, user=Depends(require_shop_user)):
    if not data.items:
        raise HTTPException(400, "لا يمكن تعليق فاتورة فارغة")
    doc = {
        "id": new_id(), "shop_id": sid(user),
        "user_id": user["id"], "user_name": user.get("name", ""),
        "label": data.label or f"معلّقة {now_utc().strftime('%H:%M')}",
        "customer_name": data.customer_name or "زبون نقدي",
        "warehouse_id": data.warehouse_id,
        "items": [i.model_dump() for i in data.items],
        "discount": data.discount, "notes": data.notes or "",
        "created_at": iso(now_utc()),
    }
    await db.held_invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/held-invoices/{hid}")
async def delete_held(hid: str, user=Depends(require_shop_user)):
    await db.held_invoices.delete_one({"id": hid, "shop_id": sid(user)})
    return {"ok": True}

# ---------- Stock Transfers ----------
@api.get("/transfers")
async def list_transfers(user=Depends(require_shop_user)):
    rows = await db.transfers.find({"shop_id": sid(user)}, {"_id": 0}).sort("created_at", -1).to_list(500)
    warehouses = {w["id"]: w["name"] for w in await db.warehouses.find({"shop_id": sid(user)}, {"_id": 0}).to_list(100)}
    for r in rows:
        r["from_warehouse_name"] = warehouses.get(r.get("from_warehouse_id"), "—")
        r["to_warehouse_name"] = warehouses.get(r.get("to_warehouse_id"), "—")
    return rows

@api.get("/transfers/{tid}")
async def get_transfer(tid: str, user=Depends(require_shop_user)):
    t = await db.transfers.find_one({"id": tid, "shop_id": sid(user)}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    return t

@api.post("/transfers")
async def create_transfer(data: TransferIn, user=Depends(require_shop_user)):
    if data.from_warehouse_id == data.to_warehouse_id:
        raise HTTPException(400, "المخزن المصدر والوجهة متطابقان")
    if not data.items:
        raise HTTPException(400, "أضف صنفاً واحداً على الأقل")
    src_wh = await db.warehouses.find_one({"id": data.from_warehouse_id, "shop_id": sid(user)})
    dst_wh = await db.warehouses.find_one({"id": data.to_warehouse_id, "shop_id": sid(user)})
    if not src_wh or not dst_wh:
        raise HTTPException(404, "مخزن غير موجود")
    counter = await db.counters.find_one_and_update(
        {"shop_id": sid(user), "type": "transfer"},
        {"$inc": {"value": 1}}, upsert=True, return_document=True
    )
    trans_no = counter["value"] if counter else 1
    processed_items = []
    for it in data.items:
        src_prod = await db.products.find_one({"id": it.product_id, "shop_id": sid(user)})
        if not src_prod:
            raise HTTPException(400, f"المنتج غير موجود: {it.name}")
        if src_prod.get("warehouse_id") != data.from_warehouse_id:
            raise HTTPException(400, f"'{src_prod['name']}' ليس في المخزن المصدر")
        if it.qty <= 0:
            raise HTTPException(400, "الكمية يجب أن تكون أكبر من صفر")
        if it.qty > src_prod.get("stock", 0):
            raise HTTPException(400, f"الكمية المطلوبة أكبر من الرصيد لـ '{src_prod['name']}'")
        # Find or create twin product in destination warehouse
        twin = await db.products.find_one({
            "shop_id": sid(user), "warehouse_id": data.to_warehouse_id,
            "name": src_prod["name"]
        })
        if twin:
            await db.products.update_one({"id": twin["id"]}, {"$inc": {"stock": it.qty}})
        else:
            twin_doc = {
                **{k: src_prod[k] for k in ["name", "unit", "cost_price", "sale_price", "min_stock", "tax_rate", "is_active", "category_id"] if k in src_prod},
                "id": new_id(), "shop_id": sid(user),
                "warehouse_id": data.to_warehouse_id,
                "barcode": src_prod.get("barcode") or _gen_barcode(),
                "stock": it.qty,
                "created_at": iso(now_utc()),
            }
            # Barcodes must be unique per shop — if twin uses same barcode as src, that's fine as long as they're in different warehouses; but our index isn't unique on barcode
            await db.products.insert_one(twin_doc)
        # Decrement source
        await db.products.update_one({"id": src_prod["id"]}, {"$inc": {"stock": -it.qty}})
        processed_items.append({"product_id": it.product_id, "name": src_prod["name"], "qty": it.qty})
    doc = {
        "id": new_id(), "shop_id": sid(user), "transfer_no": trans_no,
        "from_warehouse_id": data.from_warehouse_id, "from_warehouse_name": src_wh["name"],
        "to_warehouse_id": data.to_warehouse_id, "to_warehouse_name": dst_wh["name"],
        "items": processed_items, "notes": data.notes or "",
        "user_id": user["id"], "user_name": user.get("name", ""),
        "created_at": iso(now_utc()),
    }
    await db.transfers.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ---------- Products Excel Import/Export ----------
@api.get("/products/template")
async def products_template(user=Depends(require_shop_user)):
    wb = Workbook()
    ws = wb.active
    ws.title = "Products"
    ws.append(["name", "barcode", "category", "unit", "cost_price", "sale_price", "stock", "min_stock", "tax_rate"])
    ws.append(["مثال: علبة تونا", "6291001234567", "مواد غذائية", "قطعة", 3.0, 5.0, 100, 10, 0])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(content=buf.read(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=products_template.xlsx"})

@api.post("/products/import")
async def products_import(file: UploadFile = File(...), user=Depends(require_shop_user)):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "يجب رفع ملف Excel (.xlsx)")
    content = await file.read()
    try:
        wb = load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
    except Exception as e:
        raise HTTPException(400, f"ملف Excel غير صالح: {e}")
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        return {"imported": 0, "errors": ["الملف فارغ"]}
    headers = [str(h).strip().lower() if h else "" for h in rows[0]]
    def idx(name): return headers.index(name) if name in headers else None
    i_name = idx("name"); i_bar = idx("barcode"); i_cat = idx("category"); i_unit = idx("unit")
    i_cost = idx("cost_price"); i_sale = idx("sale_price"); i_stock = idx("stock")
    i_min = idx("min_stock"); i_tax = idx("tax_rate")
    if i_name is None or i_sale is None:
        raise HTTPException(400, "الأعمدة المطلوبة: name, sale_price")
    # Preload existing categories
    cats = await db.categories.find({"shop_id": sid(user)}, {"_id": 0}).to_list(1000)
    cat_by_name = {c["name"]: c["id"] for c in cats}
    imported = 0
    errors = []
    for ridx, row in enumerate(rows[1:], start=2):
        try:
            name = row[i_name]
            if not name: continue
            cat_id = None
            if i_cat is not None and row[i_cat]:
                cname = str(row[i_cat]).strip()
                if cname in cat_by_name:
                    cat_id = cat_by_name[cname]
                else:
                    new_cat = {"id": new_id(), "shop_id": sid(user), "name": cname, "color": "#3b82f6", "created_at": iso(now_utc())}
                    await db.categories.insert_one(new_cat)
                    cat_by_name[cname] = new_cat["id"]
                    cat_id = new_cat["id"]
            doc = {
                "id": new_id(), "shop_id": sid(user),
                "name": str(name).strip(),
                "barcode": (str(row[i_bar]).strip() if i_bar is not None and row[i_bar] else _gen_barcode()),
                "category_id": cat_id,
                "unit": str(row[i_unit]).strip() if i_unit is not None and row[i_unit] else "قطعة",
                "cost_price": float(row[i_cost] or 0) if i_cost is not None else 0,
                "sale_price": float(row[i_sale] or 0),
                "stock": float(row[i_stock] or 0) if i_stock is not None else 0,
                "min_stock": float(row[i_min] or 0) if i_min is not None else 0,
                "tax_rate": float(row[i_tax] or 0) if i_tax is not None else 0,
                "is_active": True, "created_at": iso(now_utc()),
            }
            await db.products.insert_one(doc)
            imported += 1
        except Exception as e:
            errors.append(f"سطر {ridx}: {e}")
    return {"imported": imported, "errors": errors[:20]}

# ---------- Stripe subscription checkout ----------
def _stripe():
    return StripeCheckout(
        api_key=os.environ.get("STRIPE_API_KEY", "sk_test_emergent"),
        webhook_url="",  # unused for create_checkout_session
    )

@api.post("/payments/checkout")
async def create_checkout(data: CheckoutIn, user=Depends(get_current_user)):
    # Only shop owners can renew their own subscription
    if user["role"] not in ("shop_owner", "super_admin"):
        raise HTTPException(403, "غير مسموح")
    shop_id = user.get("shop_id")
    if user["role"] == "super_admin":
        raise HTTPException(400, "شراء الاشتراك من واجهة المحل")
    months = max(1, min(60, data.months))
    yearly = float(os.environ.get("SUBSCRIPTION_YEARLY_USD", "99"))
    amount = round(yearly * (months / 12.0), 2)

    host_base = data.origin_url.rstrip("/")
    success_url = f"{host_base}/renew/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_base}/renew/cancel"

    stripe_checkout = StripeCheckout(
        api_key=os.environ.get("STRIPE_API_KEY", "sk_test_emergent"),
        webhook_url=f"{host_base}/api/webhook/stripe",
    )
    req = CheckoutSessionRequest(
        amount=amount, currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata={"shop_id": shop_id, "months": str(months), "user_id": user["id"]},
    )
    session = await stripe_checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "id": new_id(), "session_id": session.session_id,
        "shop_id": shop_id, "user_id": user["id"],
        "amount": amount, "currency": "usd", "months": months,
        "status": "initiated", "payment_status": "pending",
        "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
    })
    return {"checkout_url": session.url, "session_id": session.session_id, "amount": amount, "months": months}

async def _apply_paid_session(session_id: str):
    """Idempotent: mark session paid and extend shop subscription."""
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        return None
    if tx.get("payment_status") == "paid":
        return tx
    shop = await db.shops.find_one({"id": tx["shop_id"]})
    if not shop:
        return None
    base = datetime.fromisoformat(shop["subscription_expires_at"]) if shop.get("subscription_expires_at") else now_utc()
    if base < now_utc():
        base = now_utc()
    new_exp = base + timedelta(days=30 * tx["months"])
    await db.shops.update_one({"id": shop["id"]}, {"$set": {"subscription_expires_at": iso(new_exp), "is_active": True}})
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": iso(now_utc())}}
    )
    await db.subscription_payments.insert_one({
        "id": new_id(), "shop_id": shop["id"], "months": tx["months"],
        "amount": tx["amount"], "session_id": session_id, "created_at": iso(now_utc()),
    })
    return await db.payment_transactions.find_one({"session_id": session_id})

@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    # Poll Stripe if still pending (webhook fallback)
    if tx.get("payment_status") != "paid":
        try:
            stripe_checkout = StripeCheckout(
                api_key=os.environ.get("STRIPE_API_KEY", "sk_test_emergent"),
                webhook_url="",
            )
            status = await stripe_checkout.get_checkout_status(session_id)
            if status.payment_status == "paid" or status.status == "complete":
                await _apply_paid_session(session_id)
                tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except Exception as e:
            logger.warning(f"Stripe status poll failed: {e}")
    return {"session_id": tx["session_id"], "status": tx["status"], "payment_status": tx["payment_status"], "amount": tx.get("amount"), "months": tx.get("months")}

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        stripe_checkout = StripeCheckout(
            api_key=os.environ.get("STRIPE_API_KEY", "sk_test_emergent"),
            webhook_url="",
        )
        result = await stripe_checkout.handle_webhook(body, sig)
        if result and result.session_id and result.payment_status == "paid":
            await _apply_paid_session(result.session_id)
    except Exception as e:
        logger.warning(f"webhook err: {e}")
    return {"ok": True}

# ---------- Data Migration Wizard (from old cashier systems) ----------
MIGRATION_SCHEMAS = {
    "products": {
        "fields": {
            "name": "اسم المنتج (إجباري)",
            "barcode": "الباركود",
            "category": "الفئة/التصنيف",
            "unit": "وحدة القياس",
            "cost_price": "سعر التكلفة",
            "sale_price": "سعر البيع (إجباري)",
            "stock": "الكمية/الرصيد المخزني",
            "min_stock": "الحد الأدنى",
            "tax_rate": "نسبة الضريبة",
        },
        "required": ["name", "sale_price"],
    },
    "customers": {
        "fields": {
            "name": "الاسم (إجباري)",
            "phone": "الهاتف",
            "email": "البريد الإلكتروني",
            "address": "العنوان",
            "opening_balance": "الرصيد الافتتاحي",
        },
        "required": ["name"],
    },
    "suppliers": {
        "fields": {
            "name": "الاسم (إجباري)",
            "phone": "الهاتف",
            "email": "البريد الإلكتروني",
            "address": "العنوان",
            "opening_balance": "الرصيد الافتتاحي",
        },
        "required": ["name"],
    },
}

def _parse_upload(filename: str, content: bytes):
    """Return (headers: list[str], rows: list[list])."""
    fn = filename.lower()
    if fn.endswith(".csv"):
        text = None
        for enc in ("utf-8-sig", "utf-8", "cp1256", "windows-1256", "latin-1"):
            try:
                text = content.decode(enc); break
            except Exception:
                continue
        if text is None:
            raise HTTPException(400, "تعذّر قراءة ملف CSV — تحقق من الترميز")
        reader = _csv.reader(io.StringIO(text))
        all_rows = list(reader)
        if not all_rows:
            raise HTTPException(400, "الملف فارغ")
        return [str(h or "").strip() for h in all_rows[0]], all_rows[1:]
    if fn.endswith((".xlsx", ".xls")):
        try:
            wb = load_workbook(io.BytesIO(content), data_only=True)
            ws = wb.active
        except Exception as e:
            raise HTTPException(400, f"ملف Excel غير صالح: {e}")
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            raise HTTPException(400, "الملف فارغ")
        headers = [str(h).strip() if h is not None else "" for h in rows[0]]
        return headers, [list(r) for r in rows[1:]]
    raise HTTPException(400, "الصيغة غير مدعومة — استخدم .xlsx أو .csv")

async def _ai_map_columns(headers: list, sample_rows: list, entity: str) -> dict:
    """Use LLM to map source columns to target schema keys."""
    schema = MIGRATION_SCHEMAS[entity]
    target_desc = "\n".join([f"- `{k}` : {v}" for k, v in schema["fields"].items()])
    sample_text = "\n".join([" | ".join(str(c) if c is not None else "" for c in r[:len(headers)]) for r in sample_rows[:3]])
    prompt = f"""أنت مساعد لنقل بيانات من أنظمة كاشير عربية إلى نظام موحّد.
Target schema keys for entity `{entity}`:
{target_desc}

Source columns (from an old system's export, in any language/naming):
{headers}

Sample data rows:
{sample_text}

Task: Map each source column to ONE target schema key from above (or "ignore" if not relevant).
Return ONLY a valid JSON object like: {{"<source column>": "<target_key or ignore>", ...}}
Do NOT add any explanation, code fences, or extra text — just raw JSON.
"""
    try:
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"migration-{new_id()}",
            system_message="You are a strict JSON-only data migration assistant. Reply with JSON only."
        ).with_model("openai", "gpt-4o-mini")
        resp = await chat.send_message(UserMessage(text=prompt))
        text = str(resp).strip()
        # Strip code fences if any
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"): text = text[4:]
            text = text.strip()
        mapping = _json.loads(text)
        # Sanitize: only keep known target keys
        allowed = set(schema["fields"].keys()) | {"ignore"}
        return {str(k): (v if v in allowed else "ignore") for k, v in mapping.items() if k}
    except Exception as e:
        logger.warning(f"AI mapping failed: {e}; falling back to heuristic")
        # Heuristic fallback
        alias = {
            "name": ["name", "الاسم", "اسم", "product", "المنتج", "الصنف", "عنوان", "title"],
            "barcode": ["barcode", "الباركود", "رمز", "كود", "code", "sku", "ean"],
            "category": ["category", "الفئة", "تصنيف", "مجموعة", "قسم"],
            "unit": ["unit", "وحدة", "الوحدة"],
            "cost_price": ["cost", "تكلفة", "التكلفة", "شراء", "cost_price"],
            "sale_price": ["price", "سعر", "بيع", "sale", "sale_price", "selling"],
            "stock": ["stock", "الكمية", "كمية", "مخزون", "الرصيد", "qty", "quantity"],
            "min_stock": ["min", "أدنى", "الحد الأدنى", "minimum"],
            "tax_rate": ["tax", "ضريبة", "vat"],
            "phone": ["phone", "هاتف", "الهاتف", "جوال", "موبايل", "mobile"],
            "email": ["email", "بريد", "mail"],
            "address": ["address", "عنوان", "العنوان"],
            "opening_balance": ["balance", "رصيد", "الرصيد"],
        }
        out = {}
        for h in headers:
            hl = h.lower().strip()
            match = "ignore"
            for key, syns in alias.items():
                if key not in schema["fields"]: continue
                if any(s.lower() in hl for s in syns):
                    match = key; break
            out[h] = match
        return out

@api.get("/migration/schemas")
async def migration_schemas(_=Depends(require_shop_user)):
    return MIGRATION_SCHEMAS

@api.post("/migration/analyze")
async def migration_analyze(entity: str, file: UploadFile = File(...), user=Depends(require_shop_user)):
    if entity not in MIGRATION_SCHEMAS:
        raise HTTPException(400, "نوع بيانات غير مدعوم")
    content = await file.read()
    headers, rows = _parse_upload(file.filename or "", content)
    headers = [h for h in headers if h]
    if not headers:
        raise HTTPException(400, "لم يتم العثور على أعمدة")
    mapping = await _ai_map_columns(headers, rows[:5], entity)
    return {
        "entity": entity,
        "headers": headers,
        "row_count": len(rows),
        "sample_rows": [dict(zip(headers, r)) for r in rows[:5]],
        "suggested_mapping": mapping,
        "schema": MIGRATION_SCHEMAS[entity],
    }

@api.post("/migration/import")
async def migration_import(entity: str, mapping: str, file: UploadFile = File(...), user=Depends(require_shop_user)):
    if entity not in MIGRATION_SCHEMAS:
        raise HTTPException(400, "نوع بيانات غير مدعوم")
    try:
        col_map = _json.loads(mapping)
    except Exception:
        raise HTTPException(400, "mapping JSON غير صالح")
    schema = MIGRATION_SCHEMAS[entity]
    for req in schema["required"]:
        if req not in col_map.values():
            raise HTTPException(400, f"الحقل الإجباري '{schema['fields'][req]}' غير مربوط بعمود")
    content = await file.read()
    headers, rows = _parse_upload(file.filename or "", content)
    # Build index by header -> target
    header_to_target = {h: col_map.get(h, "ignore") for h in headers}
    imported = 0
    errors = []
    default_wh = None
    if entity == "products":
        default_wh = await _ensure_default_warehouse(sid(user))
        cats = await db.categories.find({"shop_id": sid(user)}, {"_id": 0}).to_list(1000)
        cat_by_name = {c["name"]: c["id"] for c in cats}
    for ridx, row in enumerate(rows, start=2):
        try:
            record = {}
            for i, h in enumerate(headers):
                target = header_to_target.get(h, "ignore")
                if target == "ignore": continue
                val = row[i] if i < len(row) else None
                if val is None or (isinstance(val, str) and not val.strip()):
                    continue
                record[target] = val
            # Skip rows missing required
            if any(k not in record for k in schema["required"]):
                continue
            if entity == "products":
                cat_id = None
                if record.get("category"):
                    cname = str(record["category"]).strip()
                    if cname in cat_by_name:
                        cat_id = cat_by_name[cname]
                    else:
                        new_cat = {"id": new_id(), "shop_id": sid(user), "name": cname, "color": "#3b82f6", "created_at": iso(now_utc())}
                        await db.categories.insert_one(new_cat)
                        cat_by_name[cname] = new_cat["id"]; cat_id = new_cat["id"]
                doc = {
                    "id": new_id(), "shop_id": sid(user),
                    "name": str(record["name"]).strip(),
                    "barcode": (str(record["barcode"]).strip() if record.get("barcode") else _gen_barcode()),
                    "category_id": cat_id,
                    "warehouse_id": default_wh,
                    "unit": str(record.get("unit") or "قطعة").strip(),
                    "cost_price": float(record.get("cost_price") or 0),
                    "sale_price": float(record["sale_price"]),
                    "stock": float(record.get("stock") or 0),
                    "min_stock": float(record.get("min_stock") or 0),
                    "tax_rate": float(record.get("tax_rate") or 0),
                    "is_active": True, "created_at": iso(now_utc()),
                }
                await db.products.insert_one(doc)
            elif entity in ("customers", "suppliers"):
                bal = float(record.get("opening_balance") or 0)
                doc = {
                    "id": new_id(), "shop_id": sid(user),
                    "name": str(record["name"]).strip(),
                    "phone": str(record.get("phone") or ""),
                    "email": str(record.get("email") or ""),
                    "address": str(record.get("address") or ""),
                    "opening_balance": bal, "balance": bal,
                    "created_at": iso(now_utc()),
                }
                await db[entity].insert_one(doc)
            imported += 1
        except Exception as e:
            errors.append(f"سطر {ridx}: {e}")
    return {"entity": entity, "imported": imported, "errors": errors[:20], "total_rows": len(rows)}

# ---------- Reports ----------
@api.get("/reports/dashboard")
async def shop_dashboard(user=Depends(require_shop_user)):
    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    async def sum_sales(start):
        pipe = [
            {"$match": {"shop_id": sid(user), "created_at": {"$gte": iso(start)}, "is_return": False}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "profit": {"$sum": "$profit"}, "count": {"$sum": 1}}}
        ]
        r = await db.sales.aggregate(pipe).to_list(1)
        return r[0] if r else {"total": 0, "profit": 0, "count": 0}
    today = await sum_sales(today_start)
    week = await sum_sales(week_start)
    month = await sum_sales(month_start)
    products_count = await db.products.count_documents({"shop_id": sid(user)})
    low_stock = await db.products.count_documents({"shop_id": sid(user), "$expr": {"$lte": ["$stock", "$min_stock"]}})
    customers_count = await db.customers.count_documents({"shop_id": sid(user)})
    # Top products this month
    top_pipe = [
        {"$match": {"shop_id": sid(user), "created_at": {"$gte": iso(month_start)}, "is_return": False}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "qty": {"$sum": "$items.qty"}, "total": {"$sum": {"$multiply": ["$items.qty","$items.price"]}}}},
        {"$sort": {"qty": -1}}, {"$limit": 5}
    ]
    top = await db.sales.aggregate(top_pipe).to_list(5)
    # Daily sales last 7 days
    daily_pipe = [
        {"$match": {"shop_id": sid(user), "created_at": {"$gte": iso(week_start)}, "is_return": False}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "total": {"$sum": "$total"}}},
        {"$sort": {"_id": 1}}
    ]
    daily = await db.sales.aggregate(daily_pipe).to_list(30)
    return {
        "today": today, "week": week, "month": month,
        "products_count": products_count, "low_stock": low_stock,
        "customers_count": customers_count,
        "top_products": top, "daily_sales": daily,
    }

@api.get("/reports/profit-loss")
async def profit_loss(user=Depends(require_shop_user), days: int = 30):
    start = now_utc() - timedelta(days=days)
    sales_r = await db.sales.aggregate([
        {"$match": {"shop_id": sid(user), "created_at": {"$gte": iso(start)}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "cost": {"$sum": "$cost_total"}, "profit": {"$sum": "$profit"}}}
    ]).to_list(1)
    exp_r = await db.expenses.aggregate([
        {"$match": {"shop_id": sid(user), "created_at": {"$gte": iso(start)}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    s = sales_r[0] if sales_r else {"revenue": 0, "cost": 0, "profit": 0}
    e = exp_r[0] if exp_r else {"total": 0}
    return {
        "revenue": s.get("revenue", 0), "cost_of_goods": s.get("cost", 0),
        "gross_profit": s.get("profit", 0), "expenses": e.get("total", 0),
        "net_profit": s.get("profit", 0) - e.get("total", 0),
        "days": days,
    }

# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.shops.create_index("id", unique=True)
    await db.products.create_index([("shop_id", 1), ("barcode", 1)])
    # Backfill: ensure every existing shop has a default warehouse & products have warehouse_id
    async for shop in db.shops.find({}, {"id": 1}):
        wid = await _ensure_default_warehouse(shop["id"])
        await db.products.update_many(
            {"shop_id": shop["id"], "$or": [{"warehouse_id": None}, {"warehouse_id": {"$exists": False}}]},
            {"$set": {"warehouse_id": wid}}
        )
    # Seed super admin
    email = os.environ.get("ADMIN_EMAIL", "admin@pos.com")
    pwd = os.environ.get("ADMIN_PASSWORD", "Admin@1234")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "email": email, "name": "Super Admin",
            "password_hash": hash_password(pwd),
            "role": "super_admin", "shop_id": None, "is_active": True,
            "created_at": iso(now_utc()),
        })
        logger.info(f"Seeded super admin: {email}")
    elif not verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})
    # Write test credentials
    try:
        Path("/app/memory").mkdir(exist_ok=True)
        Path("/app/memory/test_credentials.md").write_text(
            f"# Test Credentials\n\n## Super Admin\n- Email: {email}\n- Password: {pwd}\n- Role: super_admin\n\n"
            "## Endpoints\n- POST /api/auth/login\n- GET /api/auth/me\n- POST /api/auth/logout\n"
        )
    except Exception:
        pass

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
