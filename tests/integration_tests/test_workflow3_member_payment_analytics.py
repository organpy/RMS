import csv
from io import StringIO


def test_member_payment_to_analytics_export(client, db_session):
    """Workflow: Add member -> Record payments -> Export analytics CSV and validate contents

    This test uses the API client fixture and a DB session fixture. It creates a member,
    posts two payments for that member, then calls the analytics export endpoint and
    validates that the response is CSV and contains the expected header row.
    """
    # Create a member
    member_payload = {
        "first_name": "Analytics",
        "last_name": "User",
        "email": "analytics.user@example.com",
        "membership_plan": "Premium",
    }
    resp = client.post("/api/members", json=member_payload)
    assert resp.status_code == 201
    member = resp.json()

    # Record two payments for the member
    payment_payload1 = {"member_id": member["id"], "amount": 50.0, "status": "paid"}
    payment_payload2 = {"member_id": member["id"], "amount": 75.5, "status": "paid"}
    p1 = client.post("/api/payments", json=payment_payload1)
    assert p1.status_code in (200, 201)
    p2 = client.post("/api/payments", json=payment_payload2)
    assert p2.status_code in (200, 201)

    # Call analytics export endpoint
    export_resp = client.get("/api/analytics/export")
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers.get("content-type", "")

    # Parse CSV and ensure there is at least a header row and some content
    csv_text = export_resp.content.decode("utf-8")
    reader = csv.reader(StringIO(csv_text))
    rows = list(reader)
    assert len(rows) >= 1
    header = rows[0]
    # Expect some known columns in the analytics export, e.g., 'metric' or 'value' — be permissive
    assert any(h.lower() in ("metric", "name", "label") for h in header) or any(
        h.lower() in ("value", "amount", "total") for h in header
    )
