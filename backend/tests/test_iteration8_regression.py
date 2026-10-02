"""
Iteration 8 regression tests for Al-Arraab POS/Accounting.
NOTE: pytest.ini pins each CLASS to one xdist worker, so cross-class state is
NOT shared. All tests that depend on created ids live inside ONE class.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://point-control-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "owner@demo.com"
OWNER_PASS = "Demo@1234"


def login_owner():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data.get("user", {}).get("role") == "owner"
    assert data["user"].get("shop_id")
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s, data


# ======================= Auth =======================
class TestAuth:
    def test_login_owner(self):
        s, data = login_owner()
        assert data["user"]["email"] == OWNER_EMAIL
        assert data["user"]["role"] == "owner"
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == OWNER_EMAIL and me["shop_id"]


# ======================= Dashboard =======================
class TestDashboard:
    def test_dashboard_summary_schema(self):
        s, _ = login_owner()
        r = s.get(f"{API}/dashboard/summary")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["today", "yesterday", "month", "prev_month", "top10",
                  "least_active", "chart_14d", "alerts", "cash_in_drawer", "debts"]:
            assert k in d, f"missing dashboard key: {k}"
        assert "total" in d["today"]
        assert isinstance(d["top10"], list)
        assert isinstance(d["chart_14d"], list)
        assert isinstance(d["alerts"], list)


# ======================= Core regression =======================
class TestCoreRegression:
    def test_core_entities(self):
        s, _ = login_owner()
        ts = int(time.time())
        # Categories
        r = s.post(f"{API}/categories", json={"name": f"TEST_cat_{ts}", "color": "#f00"})
        assert r.status_code == 200, r.text
        # Warehouses
        r = s.post(f"{API}/warehouses", json={"name": f"TEST_wh_{ts}", "location": "X"})
        assert r.status_code == 200, r.text
        # Suppliers
        r = s.post(f"{API}/suppliers", json={"name": f"TEST_sup_c_{ts}", "opening_balance": 50})
        assert r.status_code == 200, r.text
        # Customers
        r = s.post(f"{API}/customers", json={"name": f"TEST_cust_c_{ts}"})
        assert r.status_code == 200, r.text
        # Employee
        r = s.post(f"{API}/employees", json={
            "email": f"TEST_emp_{ts}@demo.com", "name": "E", "password": "Pass@1234",
            "role": "cashier",
        })
        assert r.status_code == 200, r.text
        # Expense
        r = s.post(f"{API}/expenses", json={"category": "TEST_e", "amount": 1})
        assert r.status_code == 200, r.text


# ======================= Products + Sales + Purchases + Movements FULL FLOW =======================
class TestFullFlow:
    """End-to-end: product with new fields → sale (cash + credit) → statement →
    customer payment → return → purchase w/ extra_charges credit → supplier
    statement → supplier payment → product movements."""

    def test_full_flow(self):
        s, _ = login_owner()
        ts = int(time.time())

        # ---- Prereqs ----
        cat = s.post(f"{API}/categories", json={"name": f"TEST_fcat_{ts}", "color": "#333"}).json()
        wh = s.post(f"{API}/warehouses", json={"name": f"TEST_fwh_{ts}", "location": "A"}).json()
        sup = s.post(f"{API}/suppliers", json={
            "name": f"TEST_fsup_{ts}", "opening_balance": 100,
        }).json()
        assert "id" in sup
        cust = s.post(f"{API}/customers", json={"name": f"TEST_fcust_{ts}"}).json()
        assert "id" in cust

        # ---- Create product with ALL new fields ----
        prod_payload = {
            "name": f"TEST_prod_{ts}", "barcode": f"B{ts}",
            "category_id": cat["id"], "warehouse_id": wh["id"],
            "supplier_id": sup["id"],
            "cost_price": 5, "sale_price": 10, "wholesale_price": 8,
            "stock": 50, "min_stock": 5, "location": "Shelf-A1",
        }
        p = s.post(f"{API}/products", json=prod_payload)
        assert p.status_code == 200, p.text
        prod = p.json()
        assert prod["supplier_id"] == sup["id"]
        assert prod["wholesale_price"] == 8
        assert prod["location"] == "Shelf-A1"
        pid = prod["id"]

        # Old-shape product still works
        p2 = s.post(f"{API}/products", json={
            "name": f"TEST_old_{ts}", "cost_price": 1, "sale_price": 2, "stock": 3,
        })
        assert p2.status_code == 200, p2.text

        # ---- Cash sale ----
        before_stock = next(x["stock"] for x in s.get(f"{API}/products").json() if x["id"] == pid)
        r = s.post(f"{API}/sales", json={
            "items": [{"product_id": pid, "name": prod["name"], "qty": 2, "price": 10, "cost": 5}],
            "paid": 20, "payment_method": "cash",
        })
        assert r.status_code == 200, r.text
        inv1 = r.json()
        assert "invoice_no" in inv1
        after_stock = next(x["stock"] for x in s.get(f"{API}/products").json() if x["id"] == pid)
        assert after_stock == before_stock - 2

        # ---- Invoice increments ----
        r2 = s.post(f"{API}/sales", json={
            "items": [{"product_id": pid, "name": prod["name"], "qty": 1, "price": 10, "cost": 5}],
            "paid": 10, "payment_method": "cash",
        })
        assert r2.status_code == 200
        assert r2.json()["invoice_no"] == inv1["invoice_no"] + 1

        # ---- Credit sale → customer statement debit ----
        rc = s.post(f"{API}/sales", json={
            "customer_id": cust["id"], "customer_name": cust["name"],
            "items": [{"product_id": pid, "name": prod["name"], "qty": 1, "price": 50, "cost": 5}],
            "paid": 0, "payment_method": "credit",
        })
        assert rc.status_code == 200, rc.text

        st = s.get(f"{API}/customers/{cust['id']}/statement")
        assert st.status_code == 200
        stdata = st.json()
        assert any(e["debit"] > 0 for e in stdata["entries"])
        assert stdata["closing_balance"] >= 50

        # ---- Customer payment ----
        before_cb = stdata["closing_balance"]
        rp = s.post(f"{API}/customers/{cust['id']}/payment", json={"amount": 20, "method": "cash"})
        assert rp.status_code == 200, rp.text
        after_cb = s.get(f"{API}/customers/{cust['id']}/statement").json()["closing_balance"]
        assert round(before_cb - after_cb, 2) == 20

        # ---- Return cash sale → restores stock ----
        pre_ret = next(x["stock"] for x in s.get(f"{API}/products").json() if x["id"] == pid)
        rr = s.post(f"{API}/sales/{inv1['id']}/return")
        assert rr.status_code == 200, rr.text
        post_ret = next(x["stock"] for x in s.get(f"{API}/products").json() if x["id"] == pid)
        assert post_ret == pre_ret + 2

        # ---- Purchase: credit + extra_charges ----
        po_payload = {
            "supplier_id": sup["id"], "supplier_name": sup["name"],
            "items": [{"product_id": pid, "name": prod["name"], "qty": 5, "price": 4, "cost": 4}],
            "discount": 0, "extra_charges": 7, "paid": 0, "payment_method": "credit",
        }
        pr = s.post(f"{API}/purchases", json=po_payload)
        assert pr.status_code == 200, pr.text
        po = pr.json()
        assert round(po["total"], 2) == 27.0, f"got {po.get('total')}"
        assert po.get("extra_charges") == 7
        assert po.get("payment_method") == "credit"

        # ---- Supplier statement contains credit entry; payment reduces ----
        sst = s.get(f"{API}/suppliers/{sup['id']}/statement")
        assert sst.status_code == 200, sst.text
        sstd = sst.json()
        assert any(e.get("credit", 0) > 0 for e in sstd["entries"])
        pre_sup = sstd["closing_balance"]
        rsp = s.post(f"{API}/suppliers/{sup['id']}/payment", json={"amount": 5, "method": "cash"})
        assert rsp.status_code == 200
        post_sup = s.get(f"{API}/suppliers/{sup['id']}/statement").json()["closing_balance"]
        assert round(pre_sup - post_sup, 2) == 5

        # ---- Product movements ----
        mv = s.get(f"{API}/products/{pid}/movements")
        assert mv.status_code == 200, mv.text
        mvd = mv.json()
        assert any(m.get("in", 0) > 0 for m in mvd["movements"]), "purchase 'in' missing"
        for m in mvd["movements"]:
            assert "balance" in m


# ======================= Inventory extras / cashbox / reports =======================
class TestInventoryCashboxReports:
    def test_dead_stock(self):
        s, _ = login_owner()
        r = s.get(f"{API}/inventory/dead-stock?days=60")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["items", "count", "total_value"]:
            assert k in d

    def test_cashbox_balance_and_movements(self):
        s, _ = login_owner()
        r = s.get(f"{API}/cashbox/balance")
        assert r.status_code == 200
        for k in ["cash", "bank", "total"]:
            assert k in r.json()
        r2 = s.get(f"{API}/cashbox/movements?days=30")
        assert r2.status_code == 200
        for k in ["rows", "total_in", "total_out", "net"]:
            assert k in r2.json()

    @pytest.mark.parametrize("path", [
        "/reports/daily-sales",
        "/reports/top-products",
        "/reports/sales-by-cashier",
        "/reports/sales-by-category",
        "/reports/purchases-summary",
        "/reports/balance-sheet",
    ])
    def test_reports(self, path):
        s, _ = login_owner()
        r = s.get(f"{API}{path}")
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text}"
        assert isinstance(r.json(), dict)


# ======================= Promotions + Audit =======================
class TestPromotionsAudit:
    def test_promotion_crud_apply_and_audit(self):
        s, _ = login_owner()
        # Clean up any pre-existing active TEST promos to avoid stacking discounts
        existing = s.get(f"{API}/promotions").json()
        for p in existing:
            if str(p.get("name", "")).startswith("TEST_"):
                s.delete(f"{API}/promotions/{p['id']}")
        # Also disable any OTHER currently-active percent promos so apply test is deterministic
        for p in s.get(f"{API}/promotions").json():
            if p.get("is_active"):
                s.patch(f"{API}/promotions/{p['id']}", json={
                    **{k: v for k, v in p.items() if k in {
                        "name", "kind", "product_id", "category_id", "buy_qty", "get_qty",
                        "bundle_qty", "bundle_price", "percent_off", "amount_off", "min_total",
                        "starts_at", "ends_at", "time_from", "time_to", "days_of_week",
                    } and v is not None},
                    "is_active": False,
                })

        # Create percent 10%
        r = s.post(f"{API}/promotions", json={
            "name": "TEST_promo_10", "kind": "percent",
            "percent_off": 10, "min_total": 0, "is_active": True,
        })
        assert r.status_code == 200, r.text
        pid = r.json()["id"]

        # List
        rl = s.get(f"{API}/promotions").json()
        assert any(p["id"] == pid for p in rl)

        # Apply
        ra = s.post(f"{API}/promotions/apply", json={
            "items": [{"product_id": "x", "qty": 2, "price": 50}],
            "subtotal": 100,
        })
        assert ra.status_code == 200
        d = ra.json()
        assert "applied" in d and "total_discount" in d
        assert d["total_discount"] == 10.0, f"got {d['total_discount']}, applied={d['applied']}"

        # Delete
        rd = s.delete(f"{API}/promotions/{pid}")
        assert rd.status_code == 200

        # Audit log: all three actions present
        rows = s.get(f"{API}/audit-log?limit=200").json()
        assert isinstance(rows, list) and len(rows) > 0
        if len(rows) >= 2:
            assert rows[0]["created_at"] >= rows[1]["created_at"], "audit log not sorted desc"
        actions = {r.get("action") for r in rows}
        assert "promotion_create" in actions
        assert "promotion_delete" in actions
        # schema fields
        for k in ["user_name", "action", "description", "created_at"]:
            assert k in rows[0]


# ======================= Loyalty =======================
class TestLoyalty:
    def test_loyalty_settings_defaults_and_persist(self):
        s, _ = login_owner()
        r = s.get(f"{API}/loyalty/settings")
        assert r.status_code == 200, r.text
        cfg = r.json()
        for k in ["enabled", "points_per_currency", "redeem_rate", "min_redeem_points"]:
            assert k in cfg
        payload = {k: v for k, v in cfg.items() if k != "shop_id" and not k.startswith("_")}
        payload["min_redeem_points"] = 123
        rp = s.post(f"{API}/loyalty/settings", json=payload)
        assert rp.status_code == 200, rp.text
        rg = s.get(f"{API}/loyalty/settings").json()
        assert rg["min_redeem_points"] == 123


# ======================= Accounting =======================
class TestAccounting:
    def test_accounting_routes(self):
        s, _ = login_owner()
        r = s.get(f"{API}/accounting/accounts")
        assert r.status_code == 200
        accs = r.json()
        assert isinstance(accs, list)
        r = s.get(f"{API}/accounting/journal")
        assert r.status_code == 200
        r = s.get(f"{API}/accounting/vouchers")
        assert r.status_code == 200
        if accs:
            r = s.get(f"{API}/accounting/ledger/{accs[0]['id']}")
            assert r.status_code == 200
