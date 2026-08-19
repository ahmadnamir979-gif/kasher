"""Iteration 3 backend tests: warehouses CRUD + sales return endpoint + product default warehouse assignment."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
    # Load from frontend/.env
    from pathlib import Path
    for line in Path('/app/frontend/.env').read_text().splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

ADMIN_EMAIL = "admin@pos.com"
ADMIN_PASS = "Admin@1234"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def shop_owner(admin_token):
    """Create a fresh test shop + login as its owner."""
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_it3_{tag}@pos.com"
    pw = "Owner@1234"
    r = requests.post(f"{BASE_URL}/api/admin/shops",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"TEST_it3_shop_{tag}",
            "owner_email": email,
            "owner_name": "Owner it3",
            "owner_password": pw,
            "phone": "", "address": "", "subscription_months": 12
        })
    assert r.status_code == 200, r.text
    shop_id = r.json()["shop_id"]
    r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r2.status_code == 200
    return {"token": r2.json()["token"], "shop_id": shop_id}


def H(token): return {"Authorization": f"Bearer {token}"}


# -------------------- Warehouses --------------------
class TestWarehouses:
    def test_default_warehouse_exists(self, shop_owner):
        r = requests.get(f"{BASE_URL}/api/warehouses", headers=H(shop_owner["token"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        defaults = [w for w in data if w.get("is_default")]
        assert len(defaults) == 1, f"Expected exactly 1 default warehouse, got {len(defaults)}"

    def test_create_warehouse(self, shop_owner):
        r = requests.post(f"{BASE_URL}/api/warehouses",
            headers=H(shop_owner["token"]),
            json={"name": "TEST_wh_extra", "location": "طابق 2", "is_default": False})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_wh_extra"
        assert d["is_default"] is False
        # verify persistence
        r2 = requests.get(f"{BASE_URL}/api/warehouses", headers=H(shop_owner["token"]))
        names = [w["name"] for w in r2.json()]
        assert "TEST_wh_extra" in names

    def test_update_warehouse(self, shop_owner):
        # find the extra
        r = requests.get(f"{BASE_URL}/api/warehouses", headers=H(shop_owner["token"]))
        w = next(w for w in r.json() if w["name"] == "TEST_wh_extra")
        r2 = requests.patch(f"{BASE_URL}/api/warehouses/{w['id']}",
            headers=H(shop_owner["token"]),
            json={"name": "TEST_wh_renamed", "location": "طابق 3", "is_default": False})
        assert r2.status_code == 200
        r3 = requests.get(f"{BASE_URL}/api/warehouses", headers=H(shop_owner["token"]))
        names = [w["name"] for w in r3.json()]
        assert "TEST_wh_renamed" in names

    def test_cannot_delete_default(self, shop_owner):
        r = requests.get(f"{BASE_URL}/api/warehouses", headers=H(shop_owner["token"]))
        default_w = next(w for w in r.json() if w.get("is_default"))
        r2 = requests.delete(f"{BASE_URL}/api/warehouses/{default_w['id']}", headers=H(shop_owner["token"]))
        assert r2.status_code == 400
        assert "افتراضي" in r2.text or "آخر" in r2.text

    def test_delete_non_default(self, shop_owner):
        r = requests.get(f"{BASE_URL}/api/warehouses", headers=H(shop_owner["token"]))
        extra = next(w for w in r.json() if not w.get("is_default"))
        r2 = requests.delete(f"{BASE_URL}/api/warehouses/{extra['id']}", headers=H(shop_owner["token"]))
        assert r2.status_code == 200


# -------------------- Products default warehouse --------------------
class TestProductDefaultWarehouse:
    def test_product_without_warehouse_gets_default(self, shop_owner):
        # get default warehouse
        rw = requests.get(f"{BASE_URL}/api/warehouses", headers=H(shop_owner["token"]))
        default_w = next(w for w in rw.json() if w.get("is_default"))
        # create product without warehouse_id
        r = requests.post(f"{BASE_URL}/api/products",
            headers=H(shop_owner["token"]),
            json={"name": "TEST_prod_A", "sale_price": 10, "cost_price": 5, "stock": 20})
        assert r.status_code == 200
        assert r.json()["warehouse_id"] == default_w["id"]


# -------------------- Sales Return --------------------
class TestSalesReturn:
    @pytest.fixture(scope="class")
    def sale_with_product(self, shop_owner):
        # create a product
        r = requests.post(f"{BASE_URL}/api/products",
            headers=H(shop_owner["token"]),
            json={"name": "TEST_return_prod", "sale_price": 20, "cost_price": 8, "stock": 50})
        p = r.json()
        # create sale
        r2 = requests.post(f"{BASE_URL}/api/sales",
            headers=H(shop_owner["token"]),
            json={
                "customer_name": "زبون تجريبي",
                "items": [{"product_id": p["id"], "name": p["name"], "qty": 3, "price": 20, "cost": 8}],
                "discount": 0, "paid": 60, "payment_method": "cash"
            })
        assert r2.status_code == 200, r2.text
        sale = r2.json()
        return {"product": p, "sale": sale}

    def test_return_creates_negated_sale_and_restores_stock(self, shop_owner, sale_with_product):
        p = sale_with_product["product"]
        sale = sale_with_product["sale"]
        # get stock before
        r_before = requests.get(f"{BASE_URL}/api/products", headers=H(shop_owner["token"]))
        stock_before = next(x for x in r_before.json() if x["id"] == p["id"])["stock"]
        # do return
        rr = requests.post(f"{BASE_URL}/api/sales/{sale['id']}/return", headers=H(shop_owner["token"]))
        assert rr.status_code == 200, rr.text
        ret = rr.json()
        assert ret["is_return"] is True
        assert ret["total"] == -abs(sale["total"])
        assert ret["original_invoice_id"] == sale["id"]
        # verify stock restored (+3)
        r_after = requests.get(f"{BASE_URL}/api/products", headers=H(shop_owner["token"]))
        stock_after = next(x for x in r_after.json() if x["id"] == p["id"])["stock"]
        assert stock_after == stock_before + 3, f"stock: before={stock_before} after={stock_after}"

    def test_double_return_blocked(self, shop_owner, sale_with_product):
        sale = sale_with_product["sale"]
        rr = requests.post(f"{BASE_URL}/api/sales/{sale['id']}/return", headers=H(shop_owner["token"]))
        assert rr.status_code == 400
        assert "سابقاً" in rr.text or "already" in rr.text.lower()

    def test_cannot_return_a_return(self, shop_owner, sale_with_product):
        # find the created return
        r = requests.get(f"{BASE_URL}/api/sales", headers=H(shop_owner["token"]))
        ret = next(s for s in r.json() if s.get("original_invoice_id") == sale_with_product["sale"]["id"])
        rr = requests.post(f"{BASE_URL}/api/sales/{ret['id']}/return", headers=H(shop_owner["token"]))
        assert rr.status_code == 400
        assert "مرتجع" in rr.text
