from datetime import date

import pytest

PLAN = [None]


@pytest.fixture
def member(admin):
    plan = admin.post("/api/plans", json={"name": "Monthly", "price": "45.00", "interval_days": 30}).json()
    m = admin.post("/api/members", json={"first_name": "Omar", "last_name": "Benali", "plan_id": plan["id"]}).json()
    PLAN[0] = plan["id"]
    return m, plan


def _pay(client, member_id, **kw):
    r = client.post("/api/payments", json={"member_id": member_id, "plan_id": PLAN[0], **kw})
    assert r.status_code == 201, r.text
    return r.json()


def test_plan_payment_covers_period_and_chains(admin, member):
    m, _ = member
    p1 = _pay(admin, m["id"], paid_on="2026-01-05")
    assert p1["amount"] == "45.00" and p1["description"] == "Monthly"
    assert (p1["period_start"], p1["period_end"]) == ("2026-01-05", "2026-02-03")
    p2 = _pay(admin, m["id"], paid_on="2026-01-20")
    assert p2["period_start"] == "2026-02-04"
    assert admin.get(f"/api/members/{m['id']}").json()["paid_until"] == "2026-03-05"


def test_refund_rolls_back_paid_until(admin, member):
    m, _ = member
    _pay(admin, m["id"], paid_on="2026-01-05")
    p2 = _pay(admin, m["id"], paid_on="2026-01-20")
    assert admin.post(f"/api/payments/{p2['id']}/refund").status_code == 200
    assert admin.get(f"/api/members/{m['id']}").json()["paid_until"] == "2026-02-03"
    assert admin.post(f"/api/payments/{p2['id']}/refund").status_code == 409


def test_invoice_numbers_are_sequential_per_year(admin, member):
    m, _ = member
    numbers = [_pay(admin, m["id"], paid_on=d)["invoice_number"] for d in ("2026-12-30", "2026-12-31", "2027-01-01")]
    assert numbers == ["INV-2026-0001", "INV-2026-0002", "INV-2027-0001"]


def test_one_off_payment_requires_amount(admin):
    m = admin.post("/api/members", json={"first_name": "A", "last_name": "B"}).json()
    assert admin.post("/api/payments", json={"member_id": m["id"]}).status_code == 400
    p = _pay(admin, m["id"], plan_id=None, amount="15", description="Uniform")
    assert p["period_end"] is None


def test_list_totals_cover_all_pages(admin, member):
    m, _ = member
    for _ in range(30):
        _pay(admin, m["id"], paid_on=str(date(2026, 1, 1)))
    page = admin.get("/api/payments?size=10").json()
    assert page["total"] == 30 and len(page["items"]) == 10
    assert page["amount_total"] == "1350.00"
    assert admin.get("/api/payments?q=benali&size=5").json()["total"] == 30
    assert admin.get("/api/payments?from=2026-02-01").json()["total"] == 0
