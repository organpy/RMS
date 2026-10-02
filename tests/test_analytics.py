from datetime import date

from backend.core import clock


def test_monthly_series_and_shares(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 3, 10))
    course = admin.post("/api/courses", json={"name": "Swim"}).json()
    plan = admin.post("/api/plans", json={"name": "Monthly", "price": "20", "interval_days": 30}).json()
    m = admin.post(
        "/api/members", json={"first_name": "A", "last_name": "B", "course_id": course["id"], "joined_on": "2026-01-03"}
    ).json()
    for d in ("2026-01-05", "2026-02-04"):
        admin.post("/api/payments", json={"member_id": m["id"], "plan_id": plan["id"], "paid_on": d})
    admin.post("/api/payments", json={"member_id": m["id"], "amount": "7", "description": "Cap", "paid_on": "2026-02-10"})

    data = admin.get("/api/analytics?months=3").json()
    assert [p["month"] for p in data["months"]] == ["2026-01", "2026-02", "2026-03"]
    jan, feb, mar = data["months"]
    assert jan["revenue"] == "20.00" and jan["new_members"] == 1 and jan["active_members"] == 1
    assert feb["revenue"] == "27.00" and feb["payments"] == 2
    assert mar["active_members"] == 1  # second period runs into March
    assert data["by_plan"][0] == {"name": "Monthly", "revenue": "40.00"}
    assert data["by_course"] == [{"name": "Swim", "revenue": "47.00"}]
    assert "2026-02,27.00,2,0,1" in admin.get("/api/analytics/export.csv?months=3").text
