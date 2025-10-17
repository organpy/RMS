"""Tests for the dashboard aggregation service."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from backend.models import Business, Member, MemberStatus, Payment, PaymentMethod, PaymentStatus
from backend.services.dashboard_service import DashboardService


@pytest.fixture
def business(db_session):
    business = Business(name="Momentum Studio")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


def _create_member(db_session, business_id: int, *, status: MemberStatus, archived: bool = False) -> Member:
    member = Member(
        business_id=business_id,
        first_name=f"Status-{status.value.capitalize()}",
        last_name="Member",
        status=status,
    )
    if archived:
        member.archived_at = datetime.now(timezone.utc)
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def _create_payment(
    db_session,
    member_id: int,
    *,
    payment_date: date,
    next_due_date: date,
    status: PaymentStatus,
) -> Payment:
    payment = Payment(
        member_id=member_id,
        amount=Decimal("50.00"),
        payment_date=payment_date,
        next_due_date=next_due_date,
        status=status,
        method=PaymentMethod.CASH,
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


def test_widget_counts(db_session, business):
    service = DashboardService(db_session)
    today = date(2025, 10, 17)

    active = _create_member(db_session, business.id, status=MemberStatus.ACTIVE)
    inactive = _create_member(db_session, business.id, status=MemberStatus.INACTIVE)
    suspended = _create_member(db_session, business.id, status=MemberStatus.SUSPENDED)

    _create_payment(
        db_session,
        active.id,
        payment_date=today - timedelta(days=30),
        next_due_date=today,
        status=PaymentStatus.UNPAID,
    )
    _create_payment(
        db_session,
        inactive.id,
        payment_date=today - timedelta(days=60),
        next_due_date=today - timedelta(days=5),
        status=PaymentStatus.OVERDUE,
    )
    _create_payment(
        db_session,
        suspended.id,
        payment_date=today - timedelta(days=10),
        next_due_date=today - timedelta(days=3),
        status=PaymentStatus.PAID,
    )

    result = service.get_widget_counts(reference_date=today)

    assert result.active_members == 1
    assert result.inactive_members == 1
    assert result.suspended_members == 1
    assert result.due_today == 1
    assert result.overdue == 1
    assert result.overdue_inactive == 1


def test_widget_counts_ignore_archived_members(db_session, business):
    service = DashboardService(db_session)
    today = date(2025, 10, 17)

    archived_active = _create_member(
        db_session,
        business.id,
        status=MemberStatus.ACTIVE,
        archived=True,
    )
    _create_payment(
        db_session,
        archived_active.id,
        payment_date=today - timedelta(days=30),
        next_due_date=today,
        status=PaymentStatus.UNPAID,
    )

    result = service.get_widget_counts(reference_date=today)

    assert result.active_members == 0
    assert result.due_today == 0
    assert result.overdue == 0
    assert result.overdue_inactive == 0
