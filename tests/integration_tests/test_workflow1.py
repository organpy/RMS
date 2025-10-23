"""Integration test: add member -> record payment -> verify dashboard."""

from datetime import date


def test_add_member_and_record_payment(client, db_session):
    # Create business, class, group via DB fixtures (reuse models directly)
    from backend.models import Business, ClassCourse, Group

    business = Business(name="IT Test Business")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)

    class_course = ClassCourse(business_id=business.id, name="Yoga Starter")
    db_session.add(class_course)
    db_session.commit()
    db_session.refresh(class_course)

    group = Group(class_id=class_course.id, name="Morning")
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)

    # Create member through API
    payload = {
        "business_id": business.id,
        "class_id": class_course.id,
        "group_id": group.id,
        "first_name": "Test",
        "last_name": "User",
        "email": "test.user@example.com",
        "status": "active",
    }

    resp = client.post("/api/members", json=payload)
    assert resp.status_code == 201
    member = resp.json()
    member_id = member["id"]

    # Record a payment
    payment_payload = {
        "member_id": member_id,
        "amount": "25.00",
        "payment_date": date.today().isoformat(),
        "method": "cash",
    }

    pay_resp = client.post("/api/payments", json=payment_payload)
    assert pay_resp.status_code == 201
    payment = pay_resp.json()
    assert payment["member_id"] == member_id

    # Verify dashboard quick stats endpoint exists and returns expected keys
    dash_resp = client.get("/api/dashboard/quick-stats")
    assert dash_resp.status_code == 200
    data = dash_resp.json()
    # current dashboard includes counts like active_members, due_today, overdue
    assert "active_members" in data
    assert data["active_members"] >= 1
