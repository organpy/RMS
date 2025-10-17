"""Unit tests for payment CRUD helpers."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from backend.crud import PaymentCRUD
from backend.models import Business, Member, PaymentMethod, PaymentStatus


@pytest.fixture
def business(db_session):
    business = Business(name="Payments Test Biz")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


@pytest.fixture
def member(db_session, business):
    member = Member(
        business_id=business.id,
        first_name="Taylor",
        last_name="Doe",
        email="taylor.doe@example.com",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def test_create_payment(db_session, member):
    crud = PaymentCRUD(db_session)
    payload = {
        "member_id": member.id,
        "amount": Decimal("49.99"),
        "payment_date": date.today(),
        "next_due_date": date.today() + timedelta(days=30),
        "status": PaymentStatus.PAID,
        "method": PaymentMethod.CARD,
        "receipt_number": "RCPT-001",
        "notes": "Monthly membership.",
    }

    payment = crud.create(payload)

    assert payment.id is not None
    assert payment.member_id == member.id
    assert Decimal(payment.amount) == Decimal("49.99")
    assert payment.method == PaymentMethod.CARD
    assert payment.receipt_number == "RCPT-001"


def test_list_payments_filters(db_session, member):
    crud = PaymentCRUD(db_session)
    today = date.today()

    crud.create(
        {
            "member_id": member.id,
            "amount": Decimal("20.00"),
            "payment_date": today - timedelta(days=10),
            "next_due_date": today + timedelta(days=20),
            "status": PaymentStatus.PAID,
            "method": PaymentMethod.CASH,
        }
    )
    overdue_payment = crud.create(
        {
            "member_id": member.id,
            "amount": Decimal("25.00"),
            "payment_date": today - timedelta(days=45),
            "next_due_date": today - timedelta(days=5),
            "status": PaymentStatus.OVERDUE,
            "method": PaymentMethod.TRANSFER,
        }
    )

    payments, total = crud.list(status=PaymentStatus.OVERDUE)

    assert total == 1
    assert payments[0].id == overdue_payment.id

    payments_by_method, total_by_method = crud.list(method=PaymentMethod.CASH)
    assert total_by_method == 1
    assert payments_by_method[0].method == PaymentMethod.CASH

    due_today_payments, due_today_total = crud.list(due_on=today + timedelta(days=20))
    assert due_today_total == 1
    assert due_today_payments[0].method == PaymentMethod.CASH


def test_update_payment(db_session, member):
    crud = PaymentCRUD(db_session)
    payment = crud.create(
        {
            "member_id": member.id,
            "amount": Decimal("35.00"),
            "payment_date": date.today(),
            "status": PaymentStatus.PAID,
            "method": PaymentMethod.CARD,
        }
    )

    updated = crud.update(
        payment,
        {
            "status": PaymentStatus.REFUNDED,
            "notes": "Customer refunded due to class cancellation.",
        },
    )

    assert updated.status == PaymentStatus.REFUNDED
    assert updated.notes.startswith("Customer refunded")
