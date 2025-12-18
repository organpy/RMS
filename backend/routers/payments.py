"""FastAPI routes for payment management and reporting."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.exceptions import NotFoundError
from backend.models.payment import PaymentMethod, PaymentStatus
from backend.schemas.common import PaginationMeta
from backend.schemas.payment import (
    PaymentCreate,
    PaymentListResponse,
    PaymentResponse,
    PaymentSummary,
    PaymentUpdate,
)
from backend.schemas.payment_reminder import (
    PaymentReminderEnvelope,
    PaymentReminderHistoryEntry,
    PaymentReminderSummary,
    QueuePaymentReminderRequest,
)
from backend.services import PaymentReminderService, PaymentService, ReceiptService

from .utils import serialize_payment


def _build_reminder_summary(reminder) -> PaymentReminderSummary:
    return PaymentReminderSummary(
        status=reminder.status,
        attempt_count=reminder.attempt_count,
        last_attempt_at=reminder.last_attempt_at,
        next_scheduled_at=reminder.next_scheduled_at,
    )


def _build_reminder_history(logs) -> list[PaymentReminderHistoryEntry]:
    return [
        PaymentReminderHistoryEntry(
            attempted_at=entry.attempted_at,
            scheduled_for=entry.scheduled_for,
            result=entry.result,
            note=entry.note,
        )
        for entry in logs
    ]


def _build_reminder_envelope(reminder, logs) -> PaymentReminderEnvelope:
    summary = _build_reminder_summary(reminder)
    history = _build_reminder_history(logs)
    return PaymentReminderEnvelope(summary=summary, history=history)


def _load_reminder_envelope(service: PaymentReminderService, payment_id: int) -> PaymentReminderEnvelope:
    reminder = service.get_or_create(payment_id)
    history = list(service.list_history(payment_id))
    return _build_reminder_envelope(reminder, history[:10])


def _build_payments_summary(payments: list[PaymentResponse]) -> PaymentSummary:
    total = len(payments)
    revenue = sum(float(payment.amount) for payment in payments)
    outstanding_statuses = {"UNPAID", "OVERDUE"}
    by_status: dict[str, float] = {}

    for payment in payments:
        status = payment.status
        if isinstance(status, PaymentStatus):
            key = status.value.upper()
        else:
            key = str(status).upper()
        by_status[key] = by_status.get(key, 0.0) + float(payment.amount)

    outstanding = sum(amount for status_key, amount in by_status.items() if status_key in outstanding_statuses)
    average_ticket = revenue / total if total else 0.0

    return PaymentSummary(
        total=total,
        revenue=revenue,
        outstanding=outstanding,
        average_ticket=average_ticket,
        by_status=by_status,
    )

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.get("", response_model=PaymentListResponse)
async def list_payments(
    status_filter: PaymentStatus | None = Query(default=None, alias="status"),
    method: PaymentMethod | None = Query(default=None),
    member_id: int | None = Query(default=None, ge=1),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaymentListResponse:
    """Return a filtered list of payments."""

    service = PaymentService(db)
    payments, total = service.list_payments(
        status=status_filter,
        method=method,
        member_id=member_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    data = [serialize_payment(payment) for payment in payments]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    summary = _build_payments_summary(data)
    return PaymentListResponse(data=data, meta=meta, summary=summary)


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(payload: PaymentCreate, db: Session = Depends(get_db)) -> PaymentResponse:
    """Record a new payment and generate its receipt."""

    service = PaymentService(db)
    payment_dict = payload.model_dump()
    payment = service.create_payment(payment_dict)

    receipt_service = ReceiptService(db)
    receipt_service.generate(payment)

    db.refresh(payment)
    return serialize_payment(payment)


@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: int,
    payload: PaymentUpdate,
    db: Session = Depends(get_db),
) -> PaymentResponse:
    """Update an existing payment record and keep receipt metadata consistent."""

    service = PaymentService(db)
    payment = service.get(payment_id)
    update_data = payload.model_dump(exclude_unset=True)
    payment = service.update_payment(payment, update_data)

    # Regenerate receipt only if an amount or date changed.
    if any(field in update_data for field in {"amount", "payment_date", "next_due_date", "status"}):
        receipt_service = ReceiptService(db)
        receipt_service.generate(payment, regenerate=True)
        db.refresh(payment)

    return serialize_payment(payment)


@router.get("/{payment_id}/receipt")
async def download_receipt(payment_id: int, db: Session = Depends(get_db)) -> FileResponse:
    """Return the PDF receipt for the requested payment, generating it if missing."""

    service = PaymentService(db)
    payment = service.get(payment_id)

    receipt_service = ReceiptService(db)
    receipt = payment.receipt
    if receipt is None or not Path(receipt.file_path).exists():
        receipt = receipt_service.generate(payment, regenerate=True)
        db.refresh(payment)

    file_path = Path(receipt.file_path)
    if not file_path.exists():
        raise NotFoundError("Receipt file not found on disk")
    return FileResponse(file_path, media_type="application/pdf", filename=file_path.name)


@router.get("/{payment_id}/reminders", response_model=PaymentReminderEnvelope)
async def get_payment_reminders(payment_id: int, db: Session = Depends(get_db)) -> PaymentReminderEnvelope:
    """Return reminder summary and recent history for a payment."""

    service = PaymentReminderService(db)
    envelope = _load_reminder_envelope(service, payment_id)
    return envelope


@router.post("/{payment_id}/reminders", response_model=PaymentReminderEnvelope, status_code=status.HTTP_201_CREATED)
async def queue_payment_reminder(
    payment_id: int,
    payload: QueuePaymentReminderRequest,
    db: Session = Depends(get_db),
) -> PaymentReminderEnvelope:
    """Queue a reminder intent for the payment and return the updated state."""

    service = PaymentReminderService(db)
    service.queue(payment_id, scheduled_for=payload.scheduled_for, note=payload.note)
    envelope = _load_reminder_envelope(service, payment_id)
    return envelope


@router.get("/overdue", response_model=PaymentListResponse)
async def list_overdue_payments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaymentListResponse:
    """Return payments that are overdue based on their next due date."""

    today = date.today()
    service = PaymentService(db)
    payments, total = service.list_payments(due_before=today, skip=skip, limit=limit)
    data = [serialize_payment(payment) for payment in payments]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    summary = _build_payments_summary(data)
    return PaymentListResponse(data=data, meta=meta, summary=summary)


@router.get("/due-today", response_model=PaymentListResponse)
async def list_due_today_payments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaymentListResponse:
    """Return payments whose next due date is today."""

    today = date.today()
    service = PaymentService(db)
    payments, total = service.list_payments(due_on=today, skip=skip, limit=limit)
    data = [serialize_payment(payment) for payment in payments]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    summary = _build_payments_summary(data)
    return PaymentListResponse(data=data, meta=meta, summary=summary)
