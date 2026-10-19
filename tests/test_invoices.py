def test_invoice_pdf(admin):
    assert admin.patch("/api/organization", json={"address": "1 Main St\nSpringfield", "locale": "fr-FR"}).status_code == 200
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


def test_invoice_copies_signatures_and_note(admin):
    from pypdf import PdfReader
    import io

    admin.patch("/api/organization", json={"invoice_note": "Fees are non-refundable after the first class."})
    m = admin.post("/api/members", json={"first_name": "Ana", "last_name": "A"}).json()
    p = admin.post("/api/payments", json={"member_id": m["id"], "amount": "30", "description": "Term fee"}).json()

    two = PdfReader(io.BytesIO(admin.get(f"/api/payments/{p['id']}/invoice.pdf").content))
    text = two.pages[0].extract_text()
    assert len(two.pages) == 1 and float(two.pages[0].mediabox.height) > 800  # one A4 sheet
    assert "CUSTOMER COPY" in text and "OFFICE COPY" in text
    assert text.count("CUSTOMER SIGNATURE") == 2 and text.count("non-refundable") == 2
    assert "Admin" in text  # received by the staff member who recorded it

    one = PdfReader(io.BytesIO(admin.get(f"/api/payments/{p['id']}/invoice.pdf", params={"copies": 1}).content)).pages[0]
    assert float(one.mediabox.width) > float(one.mediabox.height)  # A5 landscape
    assert "COPY" not in one.extract_text()


def test_clearing_optional_organization_fields(admin):
    admin.patch("/api/organization", json={"invoice_note": "Note", "phone": "+1555"})
    org = admin.patch("/api/organization", json={"invoice_note": None, "phone": None}).json()
    assert org["invoice_note"] is None and org["phone"] is None
    assert admin.patch("/api/organization", json={"name": None}).json()["name"]
