def _member(admin, **extra):
    return admin.post("/api/members", json={"first_name": "Ana", "last_name": "A", **extra}).json()


def test_record_payment_and_email_invoice(admin, smtp):
    m = _member(admin, email="ana@example.com")
    p = admin.post("/api/payments", json={"member_id": m["id"], "amount": "30", "description": "Fee", "email_invoice": True}).json()
    assert p["invoice_email"] == "sent"
    msg = smtp[0]
    assert msg["To"] == "ana@example.com" and p["invoice_number"] in msg["Subject"]
    (pdf,) = list(msg.iter_attachments())
    assert pdf.get_filename() == f"{p['invoice_number']}.pdf" and pdf.get_content().startswith(b"%PDF")

    history = admin.get("/api/messages", params={"member_id": m["id"]}).json()["items"]
    assert [(h["kind"], h["status"]) for h in history] == [("invoice", "sent")]


def test_email_invoice_endpoint(admin, smtp):
    m = _member(admin, email="ana@example.com")
    p = admin.post("/api/payments", json={"member_id": m["id"], "amount": "30"}).json()
    assert p["invoice_email"] is None and smtp == []
    assert admin.post(f"/api/payments/{p['id']}/email").json()["status"] == "sent"
    assert len(smtp) == 1


def test_email_invoice_without_address_fails_but_payment_is_kept(admin, smtp):
    m = _member(admin)
    p = admin.post("/api/payments", json={"member_id": m["id"], "amount": "30", "email_invoice": True})
    assert p.status_code == 201 and p.json()["invoice_email"] == "failed"
    res = admin.post(f"/api/payments/{p.json()['id']}/email")
    assert res.status_code == 400 and "No email address" in res.json()["detail"]
