from datetime import date

from backend.core import clock


def _add(admin, **body):
    return admin.post("/api/expenses", json={"category": "Rent", "description": "October rent", "amount": "500", **body})


def test_expense_crud_filters_and_totals(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 10))
    rent = _add(admin).json()
    assert rent["spent_on"] == "2026-06-10" and rent["staff_name"] == "Ada Admin" and rent["method"] == "cash"
    _add(admin, category="Equipment", description="New mats", amount="120.50", spent_on="2026-05-30", method="card")
    _add(admin, category="Rent", description="September rent", amount="500", spent_on="2026-05-01")

    page = admin.get("/api/expenses").json()
    assert page["total"] == 3 and float(page["amount_total"]) == 1120.5
    assert [e["description"] for e in page["items"]] == ["October rent", "New mats", "September rent"]
    assert admin.get("/api/expenses/categories").json() == ["Rent", "Equipment"]

    only_rent = admin.get("/api/expenses", params={"category": "Rent"}).json()
    assert only_rent["total"] == 2 and float(only_rent["amount_total"]) == 1000
    assert admin.get("/api/expenses", params={"from": "2026-05-15", "to": "2026-06-01"}).json()["total"] == 1
    assert admin.get("/api/expenses", params={"q": "mats"}).json()["items"][0]["category"] == "Equipment"

    edited = admin.patch(f"/api/expenses/{rent['id']}", json={"amount": "525.25", "description": "Rent (adjusted)"}).json()
    assert edited["amount"] == "525.25" and edited["description"] == "Rent (adjusted)" and edited["category"] == "Rent"
    assert admin.delete(f"/api/expenses/{rent['id']}").status_code == 204
    assert admin.delete(f"/api/expenses/{rent['id']}").status_code == 404
    assert admin.get("/api/expenses").json()["total"] == 2


def test_expense_validation_and_export(admin):
    assert _add(admin, amount="0").status_code == 422
    assert _add(admin, amount="-5").status_code == 422
    assert _add(admin, category="").status_code == 422
    _add(admin, spent_on="2026-05-01")
    csv = admin.get("/api/expenses/export.csv").text.splitlines()
    assert csv[0] == "Date,Category,Description,Amount,Method,Recorded by"
    assert csv[1].startswith("2026-05-01,Rent,October rent,500.00,cash,Ada Admin")


def test_daily_report_includes_expenses(admin, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 10))
    _add(admin, category="Supplies", description="Printer paper", amount="12.40")
    _add(admin, spent_on="2026-06-09")
    r = admin.get("/api/reports/daily").json()
    assert [e["description"] for e in r["expenses"]] == ["Printer paper"] and float(r["expenses_total"]) == 12.4
