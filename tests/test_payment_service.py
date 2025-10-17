"""Tests for payment and receipt domain services."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from backend.models import Business, ClassCourse, Member, MemberStatus, PaymentMethod
from backend.services.payment_service import PaymentService
from backend.services.receipt_service import ReceiptService


@pytest.fixture
def business(db_session):
    business = Business(name="Studio One")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


@pytest.fixture
def class_course(db_session, business):
    course = ClassCourse(business_id=business.id, name="Yoga Basics")
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)
    return course


@pytest.fixture
def member(db_session, business, class_course):
    member = Member(
        business_id=business.id,
        class_id=class_course.id,
        first_name="Jamie",
        last_name="Rivera",
        email="jamie.rivera@example.com",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def _clock():
    return datetime.now(timezone.utc)


def test_receipt_number_uniqueness_and_member_status(db_session, member):
    service = PaymentService(db_session, clock=_clock)

    payment_one = service.create_payment(
        {
            "member_id": member.id,
            "amount": Decimal("50.00"),
            "payment_date": date.today(),
            "method": PaymentMethod.CASH,
        }
    )

    payment_two = service.create_payment(
        {
            "member_id": member.id,
            "amount": Decimal("55.00"),
            "payment_date": date.today(),
            "method": PaymentMethod.CARD,
        }
    )

    overdue_payment = service.create_payment(
        {
            "member_id": member.id,
            "amount": Decimal("60.00"),
            "payment_date": date.today() - timedelta(days=45),
            "method": PaymentMethod.TRANSFER,
        }
    )

    assert payment_one.receipt_number != payment_two.receipt_number
    assert payment_two.receipt_number.endswith("0002")
    assert overdue_payment.receipt_number.endswith("0001")
    db_session.refresh(member)
    assert member.status == MemberStatus.INACTIVE


def test_receipt_service_generation(db_session, member, tmp_path, monkeypatch):
    payment_service = PaymentService(db_session, clock=_clock)
    payment = payment_service.create_payment(
        {
            "member_id": member.id,
            "amount": Decimal("65.00"),
            "payment_date": date.today(),
            "method": PaymentMethod.CASH,
        }
    )

    def fake_write_pdf(self, payment_obj, html_markup):
        self.output_dir = tmp_path
        self.output_dir.mkdir(parents=True, exist_ok=True)
        file_path = self.output_dir / f"{payment_obj.receipt_number}.pdf"
        file_path.write_bytes(b"%PDF-1.4\n%Fake")
        return file_path

    monkeypatch.setattr("backend.services.receipt_service.ReceiptService._write_pdf", fake_write_pdf)

    receipt_service = ReceiptService(db_session, output_dir=tmp_path, clock=_clock)
    receipt = receipt_service.generate(payment)

    assert Path(receipt.file_path).exists()
    assert Path(receipt.file_path).read_bytes().startswith(b"%PDF")
    assert receipt.payment_id == payment.id

    # Ensure repeated generation updates the same record
    updated_receipt = receipt_service.generate(payment, regenerate=True)
    assert updated_receipt.id == receipt.id
    assert Path(updated_receipt.file_path).exists()
