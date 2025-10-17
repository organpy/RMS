"""Integration tests for dashboard endpoints."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from backend.models import Business, Member, MemberStatus, Payment, PaymentMethod, PaymentStatus


@pytest.fixture
def business(db_session):
    business = Business(name="Summit Athletics")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


def _member(db_session, business_id: int, *, status: MemberStatus, archived: bool = False) -> Member:
    member = Member(
        business_id=business_id,
        first_name=f"{status.value.title()} Member",
        last_name="Example",
        status=status,
    )
    if archived:
        member.archived_at = datetime.now(timezone.utc)
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def _payment(
    db_session,
    member_id: int,
    *,
    payment_date: date,
    next_due_date: date,
    status: PaymentStatus,
    receipt_suffix: str,
) -> Payment:
    payment = Payment(
        member_id=member_id,
        amount=Decimal("45.00"),
        payment_date=payment_date,
        next_due_date=next_due_date,
        status=status,
        method=PaymentMethod.CASH,
        receipt_number=f"receipt-test-{receipt_suffix}",
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


def test_dashboard_widgets_endpoint(client, db_session, business):
    today = date(2025, 10, 17)

    active = _member(db_session, business.id, status=MemberStatus.ACTIVE)
    inactive = _member(db_session, business.id, status=MemberStatus.INACTIVE)
    _member(db_session, business.id, status=MemberStatus.SUSPENDED)
    _member(db_session, business.id, status=MemberStatus.ACTIVE, archived=True)

    _payment(
        db_session,
        active.id,
        payment_date=today - timedelta(days=30),
        next_due_date=today,
        status=PaymentStatus.UNPAID,
        receipt_suffix="due",
    )
    _payment(
        db_session,
        inactive.id,
        payment_date=today - timedelta(days=60),
        next_due_date=today - timedelta(days=2),
        status=PaymentStatus.OVERDUE,
        receipt_suffix="overdue",
    )

    response = client.get("/api/dashboard/widgets", params={"reference_date": today.isoformat()})
    assert response.status_code == 200

    payload = response.json()
    assert payload == {
        "active_members": 1,
        "inactive_members": 1,
        "suspended_members": 1,
        "due_today": 1,
        "overdue": 1,
        "overdue_inactive": 1,
    }


def test_dashboard_widgets_defaults_to_today(client, db_session, business):
    today = date.today()

    member = _member(db_session, business.id, status=MemberStatus.ACTIVE)
    _payment(
        db_session,
        member.id,
        payment_date=today,
        next_due_date=today,
        status=PaymentStatus.UNPAID,
        receipt_suffix="default",
    )

    response = client.get("/api/dashboard/widgets")
    assert response.status_code == 200
    assert response.json()["due_today"] == 1


def test_dashboard_alerts_endpoint(client, db_session, business):
    today = date(2025, 10, 17)

    member_due_one = _member(db_session, business.id, status=MemberStatus.ACTIVE)
    member_due_two = _member(db_session, business.id, status=MemberStatus.ACTIVE)
    member_overdue = _member(db_session, business.id, status=MemberStatus.INACTIVE)
    _member(db_session, business.id, status=MemberStatus.ACTIVE, archived=True)

    _payment(
        db_session,
        member_due_one.id,
        payment_date=today - timedelta(days=15),
        next_due_date=today,
        status=PaymentStatus.UNPAID,
        receipt_suffix="alert-due-one",
    )
    _payment(
        db_session,
        member_due_two.id,
        payment_date=today - timedelta(days=7),
        next_due_date=today,
        status=PaymentStatus.UNPAID,
        receipt_suffix="alert-due-two",
    )
    _payment(
        db_session,
        member_overdue.id,
        payment_date=today - timedelta(days=50),
        next_due_date=today - timedelta(days=4),
        status=PaymentStatus.OVERDUE,
        receipt_suffix="alert-overdue-old",
    )
    _payment(
        db_session,
        member_overdue.id,
        payment_date=today - timedelta(days=30),
        next_due_date=today - timedelta(days=2),
        status=PaymentStatus.OVERDUE,
        receipt_suffix="alert-overdue-recent",
    )

    response = client.get(
        "/api/dashboard/alerts",
        params={"reference_date": today.isoformat(), "limit": 1},
    )
    assert response.status_code == 200

    payload = response.json()
    assert len(payload["due_today"]) == 1
    assert payload["due_today"][0]["member_id"] == member_due_one.id
    assert payload["due_today"][0]["next_due_date"] == today.isoformat()
    assert payload["due_today"][0]["status"] == PaymentStatus.UNPAID.value

    assert len(payload["overdue"]) == 1
    assert payload["overdue"][0]["next_due_date"] == (today - timedelta(days=4)).isoformat()
    assert payload["overdue"][0]["status"] == PaymentStatus.OVERDUE.value


def test_dashboard_recent_activity_endpoint(client, db_session, business):
    base_date = date(2025, 10, 1)

    member_one = _member(db_session, business.id, status=MemberStatus.ACTIVE)
    member_two = _member(db_session, business.id, status=MemberStatus.INACTIVE)

    _payment(
        db_session,
        member_one.id,
        payment_date=base_date,
        next_due_date=base_date + timedelta(days=30),
        status=PaymentStatus.PAID,
        receipt_suffix="recent-old",
    )
    mid_payment = _payment(
        db_session,
        member_one.id,
        payment_date=base_date + timedelta(days=5),
        next_due_date=base_date + timedelta(days=35),
        status=PaymentStatus.UNPAID,
        receipt_suffix="recent-mid",
    )
    latest_payment = _payment(
        db_session,
        member_two.id,
        payment_date=base_date + timedelta(days=10),
        next_due_date=base_date + timedelta(days=40),
        status=PaymentStatus.OVERDUE,
        receipt_suffix="recent-latest",
    )

    response = client.get("/api/dashboard/recent-activity", params={"limit": 2})
    assert response.status_code == 200

    payload = response.json()
    assert len(payload["payments"]) == 2
    assert payload["payments"][0]["payment_id"] == latest_payment.id
    assert payload["payments"][0]["status"] == PaymentStatus.OVERDUE.value
    assert payload["payments"][1]["payment_id"] == mid_payment.id