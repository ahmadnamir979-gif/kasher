"""Iteration 6: Data Migration Wizard tests."""
import os, uuid, json, io
import pytest, requests
from pathlib import Path

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    for line in Path('/app/frontend/.env').read_text().splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip()
BASE_URL = BASE_URL.rstrip('/')

ADMIN_EMAIL = "admin@pos.com"
ADMIN_PASS = "Admin@1234"

def H(t): return {"Authorization": f"Bearer {t}"}

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]

@pytest.fixture(scope="module")
def shop_owner(admin_token):
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_it6_{tag}@pos.com"
    pw = "Owner@1234"
    r = requests.post(f"{BASE_URL}/api/admin/shops", headers=H(admin_token), json={
        "name": f"TEST_it6_shop_{tag}", "owner_email": email, "owner_name": "Owner it6",
        "owner_password": pw, "phone": "", "address": "", "subscription_months": 12
    })
    assert r.status_code == 200, r.text
    r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    return {"token": r2.json()["token"], "shop_id": r.json()["shop_id"]}


PRODUCTS_CSV = """اسم الصنف,رمز الباركود,الفئة,سعر البيع,سعر التكلفة,الرصيد الحالي
شامبو هيد آند شولدرز,6221031492001,عناية شخصية,45.50,30.00,20
معجون أسنان سيجنال,,عناية شخصية,15.75,10.00,50
صابون لوكس,6221031492003,,8.50,5.00,100
"""

CUSTOMERS_CSV = """الاسم,الهاتف,الرصيد
أحمد محمد,01011112222,150.00
سارة علي,01022223333,0
"""

SUPPLIERS_CSV = """الاسم,الهاتف,العنوان,الرصيد
شركة الأمل,0223334444,القاهرة,500
مورد المدينة,0225556666,الجيزة,0
"""


class TestSchemas:
    def test_schemas_endpoint(self, shop_owner):
        r = requests.get(f"{BASE_URL}/api/migration/schemas", headers=H(shop_owner["token"]))
        assert r.status_code == 200
        data = r.json()
        for k in ("products", "customers", "suppliers"):
            assert k in data
            assert "fields" in data[k] and "required" in data[k]
        assert "name" in data["products"]["required"]
        assert "sale_price" in data["products"]["required"]


class TestAnalyze:
    def test_analyze_products_arabic(self, shop_owner):
        files = {"file": ("products.csv", PRODUCTS_CSV.encode("utf-8-sig"), "text/csv")}
        r = requests.post(f"{BASE_URL}/api/migration/analyze?entity=products",
                          headers=H(shop_owner["token"]), files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["row_count"] == 3
        assert len(d["headers"]) >= 4
        assert len(d["sample_rows"]) >= 1
        m = d["suggested_mapping"]
        # It should map "اسم الصنف"->name and "سعر البيع"->sale_price (LLM or heuristic)
        assert m.get("اسم الصنف") == "name", f"got mapping: {m}"
        assert m.get("سعر البيع") == "sale_price", f"got mapping: {m}"

    def test_analyze_rejects_txt(self, shop_owner):
        files = {"file": ("bad.txt", b"foo,bar\n1,2", "text/plain")}
        r = requests.post(f"{BASE_URL}/api/migration/analyze?entity=products",
                          headers=H(shop_owner["token"]), files=files)
        assert r.status_code == 400

    def test_analyze_unknown_entity(self, shop_owner):
        files = {"file": ("x.csv", b"a,b\n1,2", "text/csv")}
        r = requests.post(f"{BASE_URL}/api/migration/analyze?entity=unknown",
                          headers=H(shop_owner["token"]), files=files)
        assert r.status_code == 400


class TestImport:
    def _mapping_products(self):
        return {
            "اسم الصنف": "name",
            "رمز الباركود": "barcode",
            "الفئة": "category",
            "سعر البيع": "sale_price",
            "سعر التكلفة": "cost_price",
            "الرصيد الحالي": "stock",
        }

    def test_import_products(self, shop_owner):
        mapping = self._mapping_products()
        files = {"file": ("products.csv", PRODUCTS_CSV.encode("utf-8-sig"), "text/csv")}
        r = requests.post(
            f"{BASE_URL}/api/migration/import?entity=products&mapping={requests.utils.quote(json.dumps(mapping))}",
            headers=H(shop_owner["token"]), files=files, timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["imported"] == 3, d
        # verify products
        rp = requests.get(f"{BASE_URL}/api/products", headers=H(shop_owner["token"]))
        assert rp.status_code == 200
        prods = rp.json()
        names = {p["name"] for p in prods}
        assert "شامبو هيد آند شولدرز" in names
        # Auto-barcode check on معجون (missing barcode)
        toothpaste = next(p for p in prods if p["name"].startswith("معجون"))
        assert toothpaste["barcode"] and len(toothpaste["barcode"]) == 13 and toothpaste["barcode"].startswith("2")
        # Category auto-created
        rc = requests.get(f"{BASE_URL}/api/categories", headers=H(shop_owner["token"]))
        cats = [c["name"] for c in rc.json()]
        assert "عناية شخصية" in cats

    def test_import_missing_required_mapping(self, shop_owner):
        # omit sale_price
        mapping = {"اسم الصنف": "name"}
        files = {"file": ("products.csv", PRODUCTS_CSV.encode("utf-8-sig"), "text/csv")}
        r = requests.post(
            f"{BASE_URL}/api/migration/import?entity=products&mapping={requests.utils.quote(json.dumps(mapping))}",
            headers=H(shop_owner["token"]), files=files,
        )
        assert r.status_code == 400
        # Arabic error message
        detail = r.json().get("detail", "")
        assert "إجباري" in detail or "غير مربوط" in detail, detail

    def test_import_customers(self, shop_owner):
        mapping = {"الاسم": "name", "الهاتف": "phone", "الرصيد": "opening_balance"}
        files = {"file": ("cust.csv", CUSTOMERS_CSV.encode("utf-8-sig"), "text/csv")}
        r = requests.post(
            f"{BASE_URL}/api/migration/import?entity=customers&mapping={requests.utils.quote(json.dumps(mapping))}",
            headers=H(shop_owner["token"]), files=files, timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 2
        rc = requests.get(f"{BASE_URL}/api/customers", headers=H(shop_owner["token"]))
        custs = rc.json()
        ahmed = next(c for c in custs if c["name"].startswith("أحمد"))
        assert ahmed["balance"] == 150.0
        assert ahmed["opening_balance"] == 150.0

    def test_import_suppliers(self, shop_owner):
        mapping = {"الاسم": "name", "الهاتف": "phone", "العنوان": "address", "الرصيد": "opening_balance"}
        files = {"file": ("sup.csv", SUPPLIERS_CSV.encode("utf-8-sig"), "text/csv")}
        r = requests.post(
            f"{BASE_URL}/api/migration/import?entity=suppliers&mapping={requests.utils.quote(json.dumps(mapping))}",
            headers=H(shop_owner["token"]), files=files, timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 2
        rs = requests.get(f"{BASE_URL}/api/suppliers", headers=H(shop_owner["token"]))
        sups = rs.json()
        amal = next(s for s in sups if s["name"].startswith("شركة"))
        assert amal["balance"] == 500.0
