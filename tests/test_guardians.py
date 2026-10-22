from datetime import date

from backend.core import clock


def test_guardian_contact_is_used_first(admin, smtp, monkeypatch):
    monkeypatch.setattr(clock, "today", lambda: date(2026, 6, 1))
    kid = admin.post(
        "/api/members",
        json={"first_name": "Kid", "last_name": "K", "email": "kid@example.com", "guardian_name": "Pat K", "guardian_email": "pat@example.com", "guardian_phone": "+1555"},
    ).json()
    assert kid["guardian_name"] == "Pat K"
    assert admin.get("/api/members", params={"q": "Pat"}).json()["items"][0]["id"] == kid["id"]

    admin.post("/api/messages", json={"channel": "email", "member_ids": [kid["id"]], "kind": "announcement", "body": "Hi"})
    assert smtp[-1]["To"] == "pat@example.com"
    item = admin.get("/api/reminders").json()["items"][0]
    assert (item["email"], item["phone"]) == ("pat@example.com", "+1555")

    admin.patch(f"/api/members/{kid['id']}", json={"guardian_email": None})
    admin.post("/api/messages", json={"channel": "email", "member_ids": [kid["id"]], "kind": "announcement", "body": "Hi"})
    assert smtp[-1]["To"] == "kid@example.com"


def test_invoice_billed_to_guardian(admin):
    import io

    from pypdf import PdfReader

    kid = admin.post("/api/members", json={"first_name": "Kid", "last_name": "K", "guardian_name": "Pat K"}).json()
    p = admin.post("/api/payments", json={"member_id": kid["id"], "amount": "10"}).json()
    text = PdfReader(io.BytesIO(admin.get(f"/api/payments/{p['id']}/invoice.pdf").content)).pages[0].extract_text()
    assert "Pat K" in text and "for Kid K" in text
