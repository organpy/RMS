from datetime import date, datetime, timezone

from backend.core import clock


def test_daily_report_totals_by_method_and_staff(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 10))
    admin.post("/api/staff", json={"username": "sam", "name": "Sam", "password": "password1"})
    a = admin.post("/api/members", json={"first_name": "Ana", "last_name": "A"}).json()
    b = admin.post("/api/members", json={"first_name": "Bob", "last_name": "B"}).json()

    def pay(member, amount, method, day="2026-06-10"):
        return admin.post("/api/payments", json={"member_id": member["id"], "amount": amount, "method": method, "paid_on": day, "description": "Fee"}).json()

    pay(a, "40", "cash")
    pay(b, "25.50", "cash")
    pay(a, "60", "card")
    pay(a, "99", "cash", day="2026-06-09")  # another day
    admin.post("/api/auth/logout")
    admin.post("/api/auth/login", json={"username": "sam", "password": "password1"})
    pay(b, "10", "transfer")

    r = admin.get("/api/reports/daily").json()  # defaults to today
    assert r["date"] == "2026-06-10" and r["count"] == 4 and float(r["total"]) == 135.5
    assert {m: float(v) for m, v in r["by_method"].items()} == {"cash": 65.5, "card": 60, "transfer": 10}
    staff = {s["staff_name"]: float(s["total"]) for s in r["by_staff"]}
    assert staff == {"Ada Admin": 125.5, "Sam": 10}
    assert r["refunds"] == [] and float(r["refunded_total"]) == 0
    assert admin.get("/api/reports/daily", params={"day": "2026-06-09"}).json()["count"] == 1
    assert admin.get("/api/reports/daily", params={"day": "2026-01-01"}).json()["total"] in (0, "0")


def test_daily_report_lists_refunds_on_the_day_they_happen(admin, monkeypatch):
    today = datetime.now(timezone.utc).date()
    monkeypatch.setattr(clock, "today", lambda: today)
    m = admin.post("/api/members", json={"first_name": "Ana", "last_name": "A"}).json()
    p = admin.post("/api/payments", json={"member_id": m["id"], "amount": "30"}).json()
    admin.post(f"/api/payments/{p['id']}/refund")
    r = admin.get("/api/reports/daily").json()
    assert r["count"] == 0 and r["total"] in (0, "0")  # refunded payments are not takings
    assert [x["invoice_number"] for x in r["refunds"]] == [p["invoice_number"]] and float(r["refunded_total"]) == 30
