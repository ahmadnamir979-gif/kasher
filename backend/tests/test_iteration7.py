"""Iteration 7: Save Template, Preview, Rollback, Historical Invoices."""
import os, uuid, json, hashlib
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


def _fp(headers):
    canon = "|".join(sorted([str(h).strip().lower() for h in headers if h]))
    return hashlib.sha1(canon.encode("utf-8")).hexdigest()[:16]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner(admin_token):
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_it7_{tag}@pos.com"
    pw = "Owner@1234"
    r = requests.post(f"{BASE_URL}/api/admin/shops", headers=H(admin_token), json={
        "name": f"TEST_it7_shop_{tag}", "owner_email": email, "owner_name": "Owner it7",
        "owner_password": pw, "phone": "", "address": "", "subscription_months": 12
    })
    assert r.status_code == 200, r.text
    r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    return {"token": r2.json()["token"], "shop_id": r.json()["shop_id"]}


PRODUCTS_CSV = ("اسم الصنف,الباركود,الفئة,سعر البيع,سعر التكلفة,الكمية\n"
                "منتج أ,111,فئة1,10.00,5.00,20\n"
                "منتج ب,222,فئة1,20.00,10.00,15\n"
                "منتج ج,333,فئة2,30.00,15.00,10\n")

INVOICES_CSV = ("رقم الفاتورة,التاريخ,اسم الزبون,الإجمالي,طريقة الدفع\n"
                "1001,2024-01-15,زبون 1,150.00,cash\n"
                "1002,2024-01-16,زبون 2,220.50,card\n"
                "1003,2024-01-17,زبون 3,99.99,cash\n")


# ---------- Schemas ----------
class TestSchemas:
    def test_schemas_includes_invoices(self, owner):
        r = requests.get(f"{BASE_URL}/api/migration/schemas", headers=H(owner["token"]))
        assert r.status_code == 200
        data = r.json()
        for k in ("products", "customers", "suppliers", "invoices"):
            assert k in data, f"missing entity {k}"
        assert "total" in data["invoices"]["fields"]
        assert data["invoices"]["required"] == ["total"]


# ---------- Analyze returns headers_fp and mapping_source ----------
class TestAnalyzeAndTemplate:
    def test_analyze_returns_fp_and_ai_source(self, owner):
        files = {"file": ("p.csv", PRODUCTS_CSV, "text/csv")}
        r = requests.post(f"{BASE_URL}/api/migration/analyze?entity=products",
                          headers=H(owner["token"]), files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "headers_fp" in d and len(d["headers_fp"]) == 16
        assert d["mapping_source"] in ("ai", "template")
        assert "template_name" in d
        # First analyze on fresh headers should be AI (no template saved yet)
        assert d["mapping_source"] == "ai"
        assert d["template_name"] is None
        # store for later tests
        pytest.headers_fp_products = d["headers_fp"]
        pytest.mapping_products = d["suggested_mapping"]
        pytest.sample_rows_products = d["sample_rows"]

    def test_save_template_and_dedup(self, owner):
        fp = pytest.headers_fp_products
        mapping = pytest.mapping_products
        # Force a valid mapping (ensure required present)
        # Make sure name & sale_price map to something
        if "sale_price" not in mapping.values():
            for k in mapping:
                if "سعر البيع" in k:
                    mapping[k] = "sale_price"
        if "name" not in mapping.values():
            for k in mapping:
                if "اسم" in k:
                    mapping[k] = "name"

        payload = {"entity": "products", "headers_fp": fp, "mapping": mapping, "name": "TEST_it7_tpl"}
        r = requests.post(f"{BASE_URL}/api/migration/templates", headers=H(owner["token"]), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert "id" in d
        assert d["updated"] is False
        pytest.tpl_id = d["id"]

        # Second call — same shop/entity/fp — should update
        r2 = requests.post(f"{BASE_URL}/api/migration/templates", headers=H(owner["token"]), json=payload)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["updated"] is True
        assert d2["id"] == pytest.tpl_id

    def test_list_templates(self, owner):
        r = requests.get(f"{BASE_URL}/api/migration/templates", headers=H(owner["token"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(t["id"] == pytest.tpl_id for t in data)

    def test_analyze_uses_template_when_fp_matches(self, owner):
        # Re-upload same file — fingerprint should match & mapping_source=template
        files = {"file": ("p2.csv", PRODUCTS_CSV, "text/csv")}
        r = requests.post(f"{BASE_URL}/api/migration/analyze?entity=products",
                          headers=H(owner["token"]), files=files)
        assert r.status_code == 200
        d = r.json()
        assert d["mapping_source"] == "template"
        assert d["template_name"] == "TEST_it7_tpl"
        assert d["headers_fp"] == pytest.headers_fp_products

    def test_delete_template(self, owner):
        r = requests.delete(f"{BASE_URL}/api/migration/templates/{pytest.tpl_id}",
                            headers=H(owner["token"]))
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # confirm removed
        lst = requests.get(f"{BASE_URL}/api/migration/templates", headers=H(owner["token"])).json()
        assert not any(t["id"] == pytest.tpl_id for t in lst)


# ---------- Preview ----------
class TestPreview:
    def test_preview_returns_3_rows_with_valid_flag(self, owner):
        # Build mapping that includes required (name, sale_price)
        mapping = {"اسم الصنف": "name", "سعر البيع": "sale_price",
                   "الباركود": "barcode", "الفئة": "category",
                   "سعر التكلفة": "cost_price", "الكمية": "stock"}
        sample = [
            {"اسم الصنف": "منتج أ", "الباركود": "111", "الفئة": "فئة1", "سعر البيع": "10.00", "سعر التكلفة": "5", "الكمية": "20"},
            {"اسم الصنف": "منتج ب", "الباركود": "222", "الفئة": "فئة1", "سعر البيع": "20.00", "سعر التكلفة": "10", "الكمية": "15"},
            {"اسم الصنف": "منتج ج", "الباركود": "333", "الفئة": "فئة2", "سعر البيع": "30.00", "سعر التكلفة": "15", "الكمية": "10"},
        ]
        r = requests.post(f"{BASE_URL}/api/migration/preview", headers=H(owner["token"]),
                          json={"entity": "products", "mapping": mapping, "sample_rows": sample})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "preview" in d and len(d["preview"]) == 3
        for row in d["preview"]:
            assert "_valid" in row
            assert row["_valid"] is True
            assert row.get("name")
            assert row.get("sale_price")

    def test_preview_invalid_when_required_missing(self, owner):
        # Omit sale_price mapping — _valid should be false
        mapping = {"اسم الصنف": "name", "الباركود": "barcode"}
        sample = [{"اسم الصنف": "منتج أ", "الباركود": "111"}]
        r = requests.post(f"{BASE_URL}/api/migration/preview", headers=H(owner["token"]),
                          json={"entity": "products", "mapping": mapping, "sample_rows": sample})
        assert r.status_code == 200
        d = r.json()
        assert d["preview"][0]["_valid"] is False


# ---------- Import + Batches + Rollback ----------
class TestImportAndRollback:
    def test_import_products_creates_batch(self, owner):
        mapping = {"اسم الصنف": "name", "سعر البيع": "sale_price",
                   "الباركود": "barcode", "الفئة": "category",
                   "سعر التكلفة": "cost_price", "الكمية": "stock"}
        # count before
        pcount_before = len(requests.get(f"{BASE_URL}/api/products", headers=H(owner["token"])).json())
        files = {"file": ("p.csv", PRODUCTS_CSV, "text/csv")}
        r = requests.post(
            f"{BASE_URL}/api/migration/import?entity=products&mapping={json.dumps(mapping, ensure_ascii=False)}",
            headers=H(owner["token"]), files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "batch_id" in d and d["imported"] == 3 and d["total_rows"] == 3
        pytest.batch_id = d["batch_id"]
        pytest.pcount_before = pcount_before
        # verify products count increased
        pcount_after = len(requests.get(f"{BASE_URL}/api/products", headers=H(owner["token"])).json())
        assert pcount_after == pcount_before + 3

    def test_batches_listing_contains_batch(self, owner):
        r = requests.get(f"{BASE_URL}/api/migration/batches", headers=H(owner["token"]))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 1
        b0 = arr[0]
        for k in ("id", "entity", "filename", "imported", "total_rows", "created_at", "rolled_back"):
            assert k in b0, f"batch missing key {k}"
        assert any(b["id"] == pytest.batch_id for b in arr)

    def test_rollback_deletes_products(self, owner):
        r = requests.post(f"{BASE_URL}/api/migration/rollback/{pytest.batch_id}",
                          headers=H(owner["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True and d["deleted"] >= 3
        # products count back to before
        pcount = len(requests.get(f"{BASE_URL}/api/products", headers=H(owner["token"])).json())
        assert pcount == pytest.pcount_before

    def test_second_rollback_returns_400_arabic(self, owner):
        r = requests.post(f"{BASE_URL}/api/migration/rollback/{pytest.batch_id}",
                          headers=H(owner["token"]))
        assert r.status_code == 400
        body = r.text
        assert "تمّ التراجع" in body or "تراجع" in body


# ---------- Historical Invoices ----------
class TestHistoricalInvoices:
    def test_import_invoices_into_sales(self, owner):
        # Snapshot product stocks before
        products_before = requests.get(f"{BASE_URL}/api/products", headers=H(owner["token"])).json()
        stocks_before = {p["id"]: p.get("stock", 0) for p in products_before}

        mapping = {"رقم الفاتورة": "invoice_no", "التاريخ": "date",
                   "اسم الزبون": "customer_name", "الإجمالي": "total",
                   "طريقة الدفع": "payment_method"}
        files = {"file": ("inv.csv", INVOICES_CSV, "text/csv")}
        r = requests.post(
            f"{BASE_URL}/api/migration/import?entity=invoices&mapping={json.dumps(mapping, ensure_ascii=False)}",
            headers=H(owner["token"]), files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["imported"] == 3 and d["total_rows"] == 3
        pytest.inv_batch_id = d["batch_id"]

        # Verify GET /api/sales returns them and they have is_historical=true, items=[]
        sales = requests.get(f"{BASE_URL}/api/sales", headers=H(owner["token"])).json()
        assert isinstance(sales, list)
        hist = [s for s in sales if s.get("migration_batch_id") == d["batch_id"]]
        assert len(hist) == 3
        for s in hist:
            assert s.get("is_historical") is True
            assert s.get("items") == []
            assert s.get("payment_method") in ("cash", "card", "credit")

        # Verify NO product stock changed
        products_after = requests.get(f"{BASE_URL}/api/products", headers=H(owner["token"])).json()
        for p in products_after:
            assert p.get("stock", 0) == stocks_before.get(p["id"], 0), f"stock changed on {p['id']}"

    def test_rollback_invoices_batch(self, owner):
        r = requests.post(f"{BASE_URL}/api/migration/rollback/{pytest.inv_batch_id}",
                          headers=H(owner["token"]))
        assert r.status_code == 200
        # verify sales no longer contain those docs
        sales = requests.get(f"{BASE_URL}/api/sales", headers=H(owner["token"])).json()
        assert not any(s.get("migration_batch_id") == pytest.inv_batch_id for s in sales)
