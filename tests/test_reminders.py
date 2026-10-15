from datetime import date

from backend.core import clock


def test_pending_reminders_and_logging(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 1))
    assert admin.patch("/api/organization", json={"reminder_template": "Hi {first_name}, {plan} due {due_date} {unknown}"}).status_code == 200
    plan = admin.post("/api/plans", json={"name": "Gold", "price": "50", "interval_days": 30}).json()
    late = admin.post("/api/members", json={"first_name": "Late", "last_name": "L", "plan_id": plan["id"]}).json()
    paid = admin.post("/api/members", json={"first_name": "Paid", "last_name": "P", "plan_id": plan["id"]}).json()
    admin.post("/api/payments", json={"member_id": late["id"], "plan_id": plan["id"], "paid_on": "2026-03-01"})
    admin.post("/api/payments", json={"member_id": paid["id"], "plan_id": plan["id"], "paid_on": "2026-05-20"})

    page = admin.get("/api/reminders").json()
    assert [i["full_name"] for i in page["items"]] == ["Late L"]
    item = page["items"][0]
    assert item["status"] == "overdue"
    assert item["message"] == "Hi Late, Gold due 30 Mar 2026 {unknown}"

    assert admin.post("/api/messages/manual", json={"member_ids": [late["id"], 999], "channel": "email"}).json() == {"logged": 1}
    assert admin.get("/api/reminders").json()["items"][0]["last_reminded_at"] is not None
