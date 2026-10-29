from datetime import date

from backend.core import clock


def _scenario(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 3, 10))
    course = admin.post("/api/courses", json={"name": "Swim"}).json()
    group = admin.post(f"/api/courses/{course['id']}/groups", json={"name": "G"}).json()
    plan = admin.post("/api/plans", json={"name": "Monthly", "price": "20", "interval_days": 30}).json()
    a = admin.post("/api/members", json={"first_name": "A", "last_name": "A", "course_id": course["id"], "group_id": group["id"], "joined_on": "2026-01-03"}).json()
    b = admin.post("/api/members", json={"first_name": "B", "last_name": "B", "joined_on": "2026-03-01", "discount_percent": 50, "plan_id": plan["id"]}).json()
    for day in ("2026-01-05", "2026-02-04"):
        admin.post("/api/payments", json={"member_id": a["id"], "plan_id": plan["id"], "paid_on": day})
    admin.post("/api/payments", json={"member_id": a["id"], "amount": "7", "description": "Cap", "paid_on": "2026-02-10", "method": "card"})
    admin.post("/api/payments", json={"member_id": b["id"], "plan_id": plan["id"], "amount": "5", "amount_due": "10", "paid_on": "2026-03-02"})  # partial
    admin.post("/api/expenses", json={"category": "Rent", "description": "Feb rent", "amount": "100", "spent_on": "2026-02-01"})
    admin.post("/api/expenses", json={"category": "Supplies", "description": "Paper", "amount": "30", "spent_on": "2026-03-04"})
    admin.put(f"/api/groups/{group['id']}/sessions/2026-03-03", json={"records": [{"member_id": a["id"], "status": "present"}, {"member_id": b["id"], "status": "absent"}]})


def _money(rows, key="revenue"):
    return {r["name"]: float(r[key]) for r in rows}


def test_kpis_series_and_breakdowns(admin, monkeypatch):
    _scenario(admin, monkeypatch)
    d = admin.get("/api/analytics", params={"start": "2026-01-01", "end": "2026-03-10"}).json()
    assert (d["start"], d["end"]) == ("2026-01-01", "2026-03-10")

    k = d["kpis"]
    assert (float(k["collected"]), float(k["collected_prev"])) == (52, 0)
    assert (float(k["expenses"]), float(k["profit"])) == (130, -78)
    assert (k["payments"], k["new_members"], k["new_members_prev"]) == (4, 2, 0)
    assert float(k["arpu"]) == 26  # 52 over the two members who paid
    assert k["collection_rate"] == 0.912  # 52 collected of 57 charged
    assert k["active_members"] == 1  # only B is still covered on 10 March
    assert k["churned"] == 1 and k["churn_rate"] is None  # A lapsed on 5 March; nobody was active before January
    assert k["attendance_rate"] == 0.5

    jan, feb, mar = d["months"]
    assert [(m["month"], float(m["revenue"]), float(m["expenses"]), float(m["profit"]), m["payments"], m["new_members"], m["active_members"]) for m in (jan, feb, mar)] == [
        ("2026-01", 20, 0, 20, 1, 1, 1),
        ("2026-02", 27, 100, -73, 2, 0, 1),
        ("2026-03", 5, 30, -25, 1, 1, 2),
    ]
    assert _money(d["by_method"]) == {"cash": 45, "card": 7}
    assert _money(d["by_plan"]) == {"Monthly": 45, "Cap": 7}
    assert _money(d["by_course"]) == {"Swim": 47, "Other": 5}
    assert _money(d["by_group"]) == {"G": 47, "Other": 5}


def test_forecast_and_aging(admin, monkeypatch):
    _scenario(admin, monkeypatch)
    d = admin.get("/api/analytics", params={"start": "2026-03-01", "end": "2026-03-10"}).json()
    # B's coverage ends 31 March; at a 50% discount they are expected to renew at 10.
    assert [(f["days"], f["members"], float(f["amount"])) for f in d["forecast"]] == [(30, 1, 10), (60, 1, 10), (90, 1, 10)]
    # A's coverage ended five days ago.
    assert [(b["label"], b["members"], float(b["amount"])) for b in d["aging"]] == [("1–30 days", 1, 20), ("31–60 days", 0, 0), ("61–90 days", 0, 0), ("Over 90 days", 0, 0)]
    # The previous period is the same number of days immediately before the range.
    k = admin.get("/api/analytics", params={"start": "2026-02-01", "end": "2026-03-10"}).json()["kpis"]
    assert (float(k["collected"]), float(k["collected_prev"])) == (32, 20)  # 25 Dec – 31 Jan holds only the 5 Jan payment


def test_defaults_validation_and_export(admin, monkeypatch):
    _scenario(admin, monkeypatch)
    d = admin.get("/api/analytics").json()  # last 12 months ending today
    assert (d["start"], d["end"]) == ("2025-04-01", "2026-03-10") and len(d["months"]) == 12
    assert admin.get("/api/analytics", params={"start": "2026-03-01", "end": "2026-01-01"}).status_code == 400
    assert admin.get("/api/analytics", params={"start": "2020-01-01", "end": "2026-03-10"}).status_code == 400
    csv = admin.get("/api/analytics/export.csv", params={"start": "2026-01-01", "end": "2026-03-10"}).text.splitlines()
    assert csv[0] == "Month,Revenue,Expenses,Profit,Payments,New members,Active members"
    assert "2026-02,27.00,100.00,-73.00,2,0,1" in csv
