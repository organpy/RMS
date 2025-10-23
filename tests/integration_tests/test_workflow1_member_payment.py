import pytest
from datetime import date


def test_add_member_record_payment_and_check_payments(client):
    """Workflow 1: Add member -> Record payment -> Verify payment appears in list

    Uses the project's existing `client` pytest fixture (TestClient) and assumes
    the API endpoints `/api/members` and `/api/payments` exist.
    """
    # Create a member
    # Ensure a business exists (settings API persists Business used by members)
    settings_payload = {"name": "Test Business"}
    sresp = client.put("/api/settings", json=settings_payload)
    assert sresp.status_code in (200, 201)

    member_payload = {
        "first_name": "Integration",
        "last_name": "Tester",
        "email": "int+tester@example.com",
        "business_id": 1,
    }
    resp = client.post("/api/members", json=member_payload)
    assert resp.status_code == 201
    member = resp.json()

    # Record a payment for that member
    # payments endpoint should be available via router
    payment_payload = {
        "member_id": member["id"],
        "amount": 25.0,
        "payment_date": date.today().isoformat(),
        "status": "paid",
    }
    pay_resp = client.post("/api/payments", json=payment_payload)
    assert pay_resp.status_code in (200, 201)

    # Fetch payments and assert the newly created payment exists
    list_resp = client.get("/api/payments")
    assert list_resp.status_code == 200
    data = list_resp.json()
    payments = data.get("payments") or data.get("data") or []
    assert any(p.get("member_id") == member["id"] or p.get("amount") == 25.0 for p in payments)
