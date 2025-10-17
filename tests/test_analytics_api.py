"""Integration tests for analytics API endpoints."""

from datetime import date
from decimal import Decimal

import pytest

from backend.models import Business, ClassCourse, Member, Payment, PaymentMethod, PaymentStatus


@pytest.fixture
def business(db_session):
    business = Business(name="Analytics API Studio")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


@pytest.fixture
def class_course(db_session, business):
    course = ClassCourse(business_id=business.id, name="Strength" )
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)
    return course


@pytest.fixture
def member(db_session, business, class_course):
    member = Member(
        business_id=business.id,
        class_id=class_course.id,
        first_name="Taylor",
        last_name="Swift",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    # Use payments to populate analytics data
    payment_one = Payment(
        member_id=member.id,
        amount=Decimal("110.00"),
        payment_date=date(2025, 1, 5),
        next_due_date=date(2025, 2, 5),
        status=PaymentStatus.PAID,
        method=PaymentMethod.CARD,
        receipt_number="api-1",
    )
    payment_two = Payment(
        member_id=member.id,
        amount=Decimal("120.00"),
        payment_date=date(2025, 2, 5),
        next_due_date=date(2025, 3, 5),
        status=PaymentStatus.UNPAID,
        method=PaymentMethod.CASH,
        receipt_number="api-2",
    )
    db_session.add_all([payment_one, payment_two])
    db_session.commit()
    return member


def test_revenue_monthly_endpoint(client, member):
    response = client.get("/api/analytics/revenue-monthly", params={"last_periods": 2})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["data"]) == 2


def test_payment_trends_endpoint(client, member):
    response = client.get("/api/analytics/payment-trends", params={"last_months": 3})
    assert response.status_code == 200
    payload = response.json()
    assert any(point["overdue"] >= 0 for point in payload["data"])  # structural check


def test_class_popularity_endpoint(client, member):
    response = client.get("/api/analytics/class-popularity")
    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]


def test_export_endpoint_returns_csv(client, member):
    response = client.get("/api/analytics/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "monthly_revenue" in response.text
