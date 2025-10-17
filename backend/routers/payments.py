"""FastAPI routes for payment management and reporting."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from fastapi import APIRouter, Depends, Query, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.exceptions import NotFoundError
from backend.models.payment import PaymentMethod
from backend.schemas.common import PaginationMeta
from backend.schemas.payment import (
    PaymentCreate,
    PaymentListResponse,
    PaymentResponse,
    PaymentUpdate,
)
from backend.services import PaymentService, ReceiptService

from .utils import serialize_payment

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
    payments, total = await run_in_threadpool(
        service.list_payments,
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
    return PaymentListResponse(data=data, meta=meta)


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(payload: PaymentCreate, db: Session = Depends(get_db)) -> PaymentResponse:
    """Record a new payment and generate its receipt."""

    service = PaymentService(db)
    payment_dict = payload.model_dump()
    payment = await run_in_threadpool(service.create_payment, payment_dict)

    receipt_service = ReceiptService(db)
    await run_in_threadpool(receipt_service.generate, payment)

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
    payment = await run_in_threadpool(service.get, payment_id)
    update_data = payload.model_dump(exclude_unset=True)
    payment = await run_in_threadpool(service.update_payment, payment, update_data)

    # Regenerate receipt only if an amount or date changed.
    if any(field in update_data for field in {"amount", "payment_date", "next_due_date", "status"}):
        receipt_service = ReceiptService(db)
        await run_in_threadpool(receipt_service.generate, payment, regenerate=True)
        db.refresh(payment)

    return serialize_payment(payment)


@router.get("/{payment_id}/receipt")
async def download_receipt(payment_id: int, db: Session = Depends(get_db)) -> FileResponse:
    """Return the PDF receipt for the requested payment, generating it if missing."""

    service = PaymentService(db)
    payment = await run_in_threadpool(service.get, payment_id)

    receipt_service = ReceiptService(db)
    receipt = payment.receipt
    if receipt is None or not Path(receipt.file_path).exists():
        receipt = await run_in_threadpool(receipt_service.generate, payment, regenerate=True)
        db.refresh(payment)

    file_path = Path(receipt.file_path)
    if not file_path.exists():
        raise NotFoundError("Receipt file not found on disk")
    return FileResponse(file_path, media_type="application/pdf", filename=file_path.name)


@router.get("/overdue", response_model=PaymentListResponse)
async def list_overdue_payments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaymentListResponse:
    """Return payments that are overdue based on their next due date."""

    today = date.today()
    service = PaymentService(db)
    payments, total = await run_in_threadpool(
        service.list_payments,
        due_before=today,
        skip=skip,
        limit=limit,
    )
    data = [serialize_payment(payment) for payment in payments]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    return PaymentListResponse(data=data, meta=meta)


@router.get("/due-today", response_model=PaymentListResponse)
async def list_due_today_payments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaymentListResponse:
    """Return payments whose next due date is today."""

    today = date.today()
    service = PaymentService(db)
    payments, total = await run_in_threadpool(
        service.list_payments,
        due_on=today,
        skip=skip,
        limit=limit,
    )
    data = [serialize_payment(payment) for payment in payments]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    return PaymentListResponse(data=data, meta=meta)
