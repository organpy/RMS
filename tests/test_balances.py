import io
from datetime import date

from pypdf import PdfReader

from backend.core import clock


def _pay(admin, member, **body):
    return admin.post("/api/payments", json={"member_id": member["id"], **body}).json()


def _member(admin, **extra):
    return admin.post("/api/members", json={"first_name": "Ana", "last_name": "A", **extra}).json()


def _balance(admin, member):
    return float(admin.get(f"/api/members/{member['id']}").json()["balance"])


def test_partial_payment_leaves_balance_until_settled(admin):
    m = _member(admin)
    assert _balance(admin, m) == 0
    part = _pay(admin, m, amount="30", amount_due="50", description="Term")
    assert float(part["amount_due"]) == 50 and _balance(admin, m) == 20

    settle = _pay(admin, m, amount="20", amount_due="0", description="Balance")
    assert _balance(admin, m) == 0
    admin.post(f"/api/payments/{settle['id']}/refund")
    assert _balance(admin, m) == 20  # refunded payments no longer count
    admin.post(f"/api/payments/{part['id']}/refund")
    assert _balance(admin, m) == 0

    plain = _pay(admin, m, amount="10")
    assert float(plain["amount_due"]) == 10 and _balance(admin, m) == 0  # due defaults to the amount paid


def test_balance_in_lists_reminders_and_messages(admin, smtp, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 1))
    admin.patch("/api/organization", json={"reminder_template": "Hi {first_name}, you owe {balance}"})
    m = _member(admin, email="ana@example.com")
    _pay(admin, m, amount="30", amount_due="50", description="Term", paid_on="2026-01-01", period_start="2026-01-01", period_end="2026-03-01")

    assert float(admin.get("/api/members").json()["items"][0]["balance"]) == 20
    item = admin.get("/api/reminders").json()["items"][0]
    assert float(item["balance"]) == 20 and item["message"] == "Hi Ana, you owe €20.00"
    admin.post("/api/messages", json={"channel": "email", "member_ids": [m["id"]]})
    assert "you owe €20.00" in smtp[-1].get_content()


def test_invoice_shows_balance_due_for_partial_payments(admin):
    m = _member(admin)
    text = lambda p: PdfReader(io.BytesIO(admin.get(f"/api/payments/{p['id']}/invoice.pdf").content)).pages[0].extract_text()
    partial = text(_pay(admin, m, amount="30", amount_due="50"))
    assert partial.count("PARTIAL") == 2 and partial.count("Balance due") == 2 and "20.00" in partial
    full = text(_pay(admin, m, amount="30"))
    assert "PAID" in full and "Balance due" not in full
