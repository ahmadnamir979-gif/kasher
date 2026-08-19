from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
import logging

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
    cost_price: float = 0
    sale_price: float = 0
    stock: float = 0
    min_stock: float = 0
    unit: str = "قطعة"
    tax_rate: float = 0
    is_active: bool = True

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
    items: List[InvoiceItem]
    discount: float = 0
    paid: float = 0
    payment_method: Literal["cash", "card", "credit"] = "cash"
    notes: Optional[str] = ""
    is_return: bool = False

class PurchaseIn(BaseModel):
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = ""
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

# ---------- Products ----------
@api.get("/products")
async def list_products(user=Depends(require_shop_user)):
    return await db.products.find({"shop_id": sid(user)}, {"_id": 0}).sort("name", 1).to_list(5000)

@api.post("/products")
async def create_product(data: ProductIn, user=Depends(require_shop_user)):
    doc = {"id": new_id(), "shop_id": sid(user), **data.model_dump(), "created_at": iso(now_utc())}
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
    # Generate sequential invoice number per shop
    counter = await db.counters.find_one_and_update(
        {"shop_id": sid(user), "type": "sale"},
        {"$inc": {"value": 1}}, upsert=True, return_document=True
    )
    inv_no = counter["value"] if counter else 1
    doc = {
        "id": new_id(), "shop_id": sid(user), "invoice_no": inv_no,
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
    await db.shifts.update_one(
        {"id": shift["id"]},
        {"$set": {"closing_cash": data.closing_cash or 0, "closed_at": iso(now_utc()), "notes": data.notes or shift.get("notes","")}}
    )
    return {"ok": True}

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
