"""Unit tests for the analytics service aggregations."""

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from backend.models import Business, ClassCourse, Member, Payment, PaymentMethod, PaymentStatus
from backend.services.analytics_service import AnalyticsService


@pytest.fixture
def business(db_session):
    business = Business(name="Insight Athletics")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


@pytest.fixture
def classes(db_session, business):
    class_one = ClassCourse(business_id=business.id, name="Pilates")
    class_two = ClassCourse(business_id=business.id, name="Kickboxing")
    db_session.add_all([class_one, class_two])
    db_session.commit()
    db_session.refresh(class_one)
    db_session.refresh(class_two)
    return class_one, class_two


def _member(db_session, business_id: int, class_id: int, *, created_at: datetime) -> Member:
    member = Member(
        business_id=business_id,
        class_id=class_id,
        first_name="Test",
        last_name="Member",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    member.created_at = created_at
    member.updated_at = created_at
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def _payment(
    db_session,
    member_id: int,
    *,
    payment_date: date,
    next_due_date: date | None,
    amount: Decimal,
    status: PaymentStatus,
    method: PaymentMethod = PaymentMethod.CASH,
) -> Payment:
    payment = Payment(
        member_id=member_id,
        amount=amount,
        payment_date=payment_date,
        next_due_date=next_due_date,
        status=status,
        method=method,
        receipt_number=f"analytics-{member_id}-{payment_date}",
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


def test_revenue_aggregations(db_session, business, classes):
    service = AnalyticsService(db_session)
    class_one, _ = classes

    member = _member(
        db_session,
        business.id,
        class_one.id,
        created_at=datetime(2025, 1, 5, tzinfo=timezone.utc),
    )
    _payment(
        db_session,
        member.id,
        payment_date=date(2025, 1, 10),
        next_due_date=date(2025, 2, 10),
        amount=Decimal("120.00"),
        status=PaymentStatus.PAID,
    )
    _payment(
        db_session,
        member.id,
        payment_date=date(2025, 2, 10),
        next_due_date=date(2025, 3, 10),
        amount=Decimal("130.00"),
        status=PaymentStatus.PAID,
    )
    _payment(
        db_session,
        member.id,
        payment_date=date(2025, 2, 15),
        next_due_date=date(2025, 3, 15),
        amount=Decimal("50.00"),
        status=PaymentStatus.REFUNDED,
    )

    monthly = service.monthly_revenue(last_months=2)
    assert [point.period for point in monthly] == ["2025-01", "2025-02"]
    assert monthly[0].total == Decimal("120.00")
    assert monthly[1].total == Decimal("130.00")

    yearly = service.yearly_revenue(last_years=2)
    assert yearly[-1].total == Decimal("250.00")


def test_member_growth_and_trends(db_session, business, classes):
    service = AnalyticsService(db_session)
    class_one, class_two = classes

    member_one = _member(
        db_session,
        business.id,
        class_one.id,
        created_at=datetime(2025, 3, 1, tzinfo=timezone.utc),
    )
    member_two = _member(
        db_session,
        business.id,
        class_two.id,
        created_at=datetime(2025, 4, 1, tzinfo=timezone.utc),
    )

    _payment(
        db_session,
        member_one.id,
        payment_date=date(2025, 3, 5),
        next_due_date=date(2025, 4, 5),
        amount=Decimal("90.00"),
        status=PaymentStatus.PAID,
    )
    _payment(
        db_session,
        member_two.id,
        payment_date=date(2025, 4, 6),
        next_due_date=date(2025, 5, 6),
        amount=Decimal("95.00"),
        status=PaymentStatus.UNPAID,
    )
    _payment(
        db_session,
        member_two.id,
        payment_date=date(2025, 4, 20),
        next_due_date=date(2025, 5, 20),
        amount=Decimal("100.00"),
        status=PaymentStatus.OVERDUE,
    )

    members_growth = service.new_members_per_month(last_months=3)
    assert members_growth[-1].period == "2025-04"
    assert members_growth[-1].total == Decimal("1")

    trends = service.payment_trends(last_months=3)
    april = next(point for point in trends if point.period == "2025-04")
    assert april.paid == 0
    assert april.unpaid == 1
    assert april.overdue == 1


def test_class_popularity_and_overdue_trend(db_session, business, classes):
    service = AnalyticsService(db_session)
    class_one, class_two = classes

    member_one = _member(
        db_session,
        business.id,
        class_one.id,
        created_at=datetime(2025, 5, 1, tzinfo=timezone.utc),
    )
    member_two = _member(
        db_session,
        business.id,
        class_one.id,
        created_at=datetime(2025, 5, 2, tzinfo=timezone.utc),
    )
    _member(
        db_session,
        business.id,
        class_two.id,
        created_at=datetime(2025, 5, 3, tzinfo=timezone.utc),
    )

    _payment(
        db_session,
        member_one.id,
        payment_date=date(2025, 5, 5),
        next_due_date=date(2025, 6, 5),
        amount=Decimal("75.00"),
        status=PaymentStatus.OVERDUE,
    )
    _payment(
        db_session,
        member_two.id,
        payment_date=date(2025, 6, 5),
        next_due_date=date(2025, 7, 5),
        amount=Decimal("85.00"),
        status=PaymentStatus.OVERDUE,
    )

    popularity = service.class_popularity(limit=2)
    assert popularity[0].class_id == class_one.id
    assert popularity[0].member_count == 2

    overdue_trend = service.overdue_payment_trend(last_months=2)
    assert overdue_trend[-1].total == Decimal("1")


def test_export_summary_contains_sections(db_session, business, classes):
    service = AnalyticsService(db_session)
    class_one, _ = classes

    member = _member(
        db_session,
        business.id,
        class_one.id,
        created_at=datetime(2025, 7, 1, tzinfo=timezone.utc),
    )
    _payment(
        db_session,
        member.id,
        payment_date=date(2025, 7, 10),
        next_due_date=date(2025, 8, 10),
        amount=Decimal("60.00"),
        status=PaymentStatus.PAID,
    )

    filename, content = service.export_summary()
    assert filename.endswith("analytics-summary.csv")
    assert "monthly_revenue" in content
    assert "class_popularity" in content
