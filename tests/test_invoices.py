def test_invoice_pdf(admin):
    admin.patch("/api/organization", json={"address": "1 Main St\nSpringfield", "locale": "fr-FR"})
    m = admin.post("/api/members", json={"first_name": "Zoé", "last_name": "<Dupont & Fils>"}).json()
    p = admin.post("/api/payments", json={"member_id": m["id"], "amount": "1234.5", "description": "Term fee"}).json()
    r = admin.get(f"/api/payments/{p['id']}/invoice.pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert f'filename="{p["invoice_number"]}.pdf"' in r.headers["content-disposition"]


def test_money_formatting():
    from decimal import Decimal

    from backend.modules.invoices.render import money

    assert money(Decimal("1234.5"), "USD", "en-US") == "$1,234.50"
    assert money(Decimal("1234.5"), "EUR", "fr-FR") == "1 234,50 €"
    assert money(Decimal("10"), "MAD", "en-US") == "10.00 MAD"
