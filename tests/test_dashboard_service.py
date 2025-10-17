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
    suffix: str = "base",
    amount: Decimal = Decimal("50.00"),
    method: PaymentMethod = PaymentMethod.CASH,
    receipt_number: str | None = None,
) -> Payment:
    payment = Payment(
        member_id=member_id,
        amount=amount,
        payment_date=payment_date,
        next_due_date=next_due_date,
        status=status,
        method=method,
        receipt_number=receipt_number or f"receipt-dashboard-{member_id}-{suffix}",
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
        suffix="due",
    )
    _create_payment(
        db_session,
        inactive.id,
        payment_date=today - timedelta(days=60),
        next_due_date=today - timedelta(days=5),
        status=PaymentStatus.OVERDUE,
        suffix="overdue",
    )
    _create_payment(
        db_session,
        suspended.id,
        payment_date=today - timedelta(days=10),
        next_due_date=today - timedelta(days=3),
        status=PaymentStatus.PAID,
        suffix="paid",
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
        suffix="archived",
    )

    result = service.get_widget_counts(reference_date=today)

    assert result.active_members == 0
    assert result.due_today == 0
    assert result.overdue == 0
    assert result.overdue_inactive == 0


def test_get_alerts_limits_and_orders_results(db_session, business):
    service = DashboardService(db_session)
    today = date(2025, 10, 17)

    member_due_one = _create_member(db_session, business.id, status=MemberStatus.ACTIVE)
    member_due_two = _create_member(db_session, business.id, status=MemberStatus.ACTIVE)
    member_overdue = _create_member(db_session, business.id, status=MemberStatus.INACTIVE)
    _create_member(db_session, business.id, status=MemberStatus.ACTIVE, archived=True)

    _create_payment(
        db_session,
        member_due_one.id,
        payment_date=today - timedelta(days=15),
        next_due_date=today,
        status=PaymentStatus.UNPAID,
        suffix="due-one",
    )
    _create_payment(
        db_session,
        member_due_two.id,
        payment_date=today - timedelta(days=10),
        next_due_date=today,
        status=PaymentStatus.UNPAID,
        suffix="due-two",
    )
    _create_payment(
        db_session,
        member_overdue.id,
        payment_date=today - timedelta(days=60),
        next_due_date=today - timedelta(days=5),
        status=PaymentStatus.OVERDUE,
        suffix="overdue-old",
    )
    _create_payment(
        db_session,
        member_overdue.id,
        payment_date=today - timedelta(days=40),
        next_due_date=today - timedelta(days=2),
        status=PaymentStatus.OVERDUE,
        suffix="overdue-recent",
    )

    alerts = service.get_alerts(reference_date=today, limit=1)

    assert len(alerts.due_today) == 1
    assert alerts.due_today[0].member_id == member_due_one.id
    assert alerts.due_today[0].next_due_date == today
    assert alerts.due_today[0].status == PaymentStatus.UNPAID

    assert len(alerts.overdue) == 1
    assert alerts.overdue[0].next_due_date == today - timedelta(days=5)
    assert alerts.overdue[0].status == PaymentStatus.OVERDUE


def test_recent_activity_returns_latest_payments(db_session, business):
    service = DashboardService(db_session)
    base_date = date(2025, 10, 1)

    class_member = _create_member(db_session, business.id, status=MemberStatus.ACTIVE)
    other_member = _create_member(db_session, business.id, status=MemberStatus.INACTIVE)

    _create_payment(
        db_session,
        class_member.id,
        payment_date=base_date,
        next_due_date=base_date + timedelta(days=30),
        status=PaymentStatus.PAID,
        suffix="old",
        amount=Decimal("40.00"),
        method=PaymentMethod.CARD,
    )
    second = _create_payment(
        db_session,
        class_member.id,
        payment_date=base_date + timedelta(days=10),
        next_due_date=base_date + timedelta(days=40),
        status=PaymentStatus.UNPAID,
        suffix="mid",
        amount=Decimal("45.00"),
        method=PaymentMethod.TRANSFER,
    )
    latest = _create_payment(
        db_session,
        other_member.id,
        payment_date=base_date + timedelta(days=15),
        next_due_date=base_date + timedelta(days=45),
        status=PaymentStatus.OVERDUE,
        suffix="new",
        amount=Decimal("55.00"),
        method=PaymentMethod.CASH,
    )

    recent = service.get_recent_activity(limit=2)

    assert len(recent) == 2
    assert recent[0].payment_id == latest.id
    assert recent[0].amount == Decimal("55.00")
    assert recent[0].method == PaymentMethod.CASH
    assert recent[1].payment_id == second.id
    assert recent[1].status == PaymentStatus.UNPAID
