from datetime import date

from backend.core import clock


def test_dashboard_summary(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 15))
    plan = admin.post("/api/plans", json={"name": "Monthly", "price": "30", "interval_days": 30}).json()
    a = admin.post("/api/members", json={"first_name": "A", "last_name": "A", "plan_id": plan["id"]}).json()
    b = admin.post("/api/members", json={"first_name": "B", "last_name": "B", "plan_id": plan["id"]}).json()
    admin.post("/api/payments", json={"member_id": a["id"], "plan_id": plan["id"], "paid_on": "2026-05-20"})  # until 2026-06-18
    admin.post("/api/payments", json={"member_id": b["id"], "plan_id": plan["id"], "paid_on": "2026-03-01"})  # long overdue
    admin.post("/api/payments", json={"member_id": b["id"], "amount": "5", "paid_on": "2026-06-02"})

    d = admin.get("/api/dashboard").json()
    assert d["counts"]["active"] == 1 and d["counts"]["overdue"] == 1
    assert d["revenue_month"] == "5.00" and d["revenue_prev_month"] == "0.00"  # May 20 is after May 15
    assert [m["first_name"] for m in d["expiring"]] == ["A"]
    assert [m["first_name"] for m in d["overdue"]] == ["B"]
    assert len(d["recent_payments"]) == 3
