"""Integration tests for payment and receipt API endpoints."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from backend.models import Business, ClassCourse, Member, Payment
from backend.models.member import MemberStatus
from backend.services.receipt_service import ReceiptService


@pytest.fixture
def business(db_session):
    business = Business(name="Northwind Athletics")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


@pytest.fixture
def class_course(db_session, business):
    class_course = ClassCourse(business_id=business.id, name="Power Yoga")
    db_session.add(class_course)
    db_session.commit()
    db_session.refresh(class_course)
    return class_course


@pytest.fixture
def member(db_session, business, class_course):
    member = Member(
        business_id=business.id,
        class_id=class_course.id,
        first_name="Jordan",
        last_name="Blake",
        email="jordan.blake@example.com",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def _patch_pdf(monkeypatch, tmp_path):
    def fake_write_pdf(self: ReceiptService, payment, html_markup):
        self.output_dir = tmp_path
        self.output_dir.mkdir(parents=True, exist_ok=True)
        file_path = self.output_dir / f"{payment.receipt_number}.pdf"
        file_path.write_bytes(b"%PDF-1.4\n%Fake")
        return file_path

    monkeypatch.setattr("backend.services.receipt_service.ReceiptService._write_pdf", fake_write_pdf)


def test_create_payment_generates_receipt(client, db_session, member, class_course, tmp_path, monkeypatch):
    _patch_pdf(monkeypatch, tmp_path)

    payload = {
        "member_id": member.id,
        "amount": "59.99",
        "payment_date": date.today().isoformat(),
        "method": "cash",
    }

    response = client.post("/api/payments", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["receipt_number"].startswith("receipt-")
    assert data["status"] == "paid"
    assert data["next_due_date"] == (date.today() + timedelta(days=30)).isoformat()

    stored_payment = db_session.query(Payment).filter(Payment.id == data["id"]).one()
    receipt_path = Path(tmp_path) / f"{stored_payment.receipt_number}.pdf"
    assert receipt_path.exists()


def test_overdue_and_due_today_endpoints(client, db_session, member, tmp_path, monkeypatch):
    _patch_pdf(monkeypatch, tmp_path)

    overdue_payload = {
        "member_id": member.id,
        "amount": "75.00",
        "payment_date": (date.today() - timedelta(days=45)).isoformat(),
        "method": "card",
    }

    create_response = client.post("/api/payments", json=overdue_payload)
    assert create_response.status_code == 201
    payment_id = create_response.json()["id"]

    overdue_list = client.get("/api/payments/overdue")
    assert overdue_list.status_code == 200
    assert overdue_list.json()["meta"]["total"] == 1

    update_response = client.put(
        f"/api/payments/{payment_id}",
        json={"next_due_date": date.today().isoformat()},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "unpaid"

    due_today_list = client.get("/api/payments/due-today")
    assert due_today_list.status_code == 200
    assert due_today_list.json()["meta"]["total"] == 1

    db_session.refresh(member)
    assert member.status in {MemberStatus.SUSPENDED, MemberStatus.ACTIVE}

    receipt_download = client.get(f"/api/payments/{payment_id}/receipt")
    assert receipt_download.status_code == 200
    assert receipt_download.headers["content-type"] == "application/pdf"


def test_receipt_regeneration(client, db_session, member, tmp_path, monkeypatch):
    _patch_pdf(monkeypatch, tmp_path)

    create_response = client.post(
        "/api/payments",
        json={
            "member_id": member.id,
            "amount": "80.00",
            "payment_date": date.today().isoformat(),
            "method": "transfer",
        },
    )
    payment_id = create_response.json()["id"]

    regen_response = client.post(f"/api/receipts/{payment_id}/regenerate")
    assert regen_response.status_code == 201
    assert regen_response.json()["payment_id"] == payment_id

    receipts = client.get("/api/receipts")
    assert receipts.status_code == 200
    assert receipts.json()["meta"]["total"] >= 1


def test_queue_payment_reminder_enforces_daily_idempotency(client, db_session, member):
    payload = {
        "member_id": member.id,
        "amount": "90.00",
        "payment_date": date.today().isoformat(),
        "method": "cash",
    }

    response = client.post("/api/payments", json=payload)
    assert response.status_code == 201
    payment_id = response.json()["id"]

    schedule_time = datetime.now(timezone.utc) + timedelta(days=1)
    queue_response = client.post(
        f"/api/payments/{payment_id}/reminders",
        json={"scheduled_for": schedule_time.isoformat(), "note": "First attempt"},
    )
    assert queue_response.status_code == 201
    envelope = queue_response.json()
    assert envelope["summary"]["status"] == "queued"
    assert envelope["summary"]["attempt_count"] == 1
    assert len(envelope["history"]) == 1
    assert envelope["history"][0]["note"] == "First attempt"

    duplicate_response = client.post(
        f"/api/payments/{payment_id}/reminders",
        json={"scheduled_for": schedule_time.isoformat(), "note": "Duplicate"},
    )
    assert duplicate_response.status_code == 422
    error_payload = duplicate_response.json()
    assert error_payload["code"] == "validation_error"

    get_response = client.get(f"/api/payments/{payment_id}/reminders")
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["summary"]["attempt_count"] == 1
    assert len(fetched["history"]) == 1


def test_payments_list_includes_reminder_metadata(client, db_session, member):
    payload = {
        "member_id": member.id,
        "amount": "120.00",
        "payment_date": date.today().isoformat(),
        "method": "card",
    }

    response = client.post("/api/payments", json=payload)
    payment_id = response.json()["id"]

    client.post(
        f"/api/payments/{payment_id}/reminders",
        json={"note": "Follow up"},
    )

    list_response = client.get("/api/payments")
    assert list_response.status_code == 200
    first_entry = list_response.json()["data"][0]
    assert first_entry["id"] == payment_id
    assert first_entry["reminder_attempt_count"] == 1
    assert first_entry["reminder_status"] == "queued"
