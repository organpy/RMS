"""FastAPI routes for managing receipt metadata and files."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, Query, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.crud import ReceiptCRUD
from backend.database import get_db
from backend.exceptions import NotFoundError
from backend.schemas.common import PaginationMeta
from backend.schemas.receipt import ReceiptListResponse, ReceiptResponse
from backend.services import PaymentService, ReceiptService

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])


@router.get("", response_model=ReceiptListResponse)
async def list_receipts(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> ReceiptListResponse:
    """Return paginated receipt metadata for administrative tooling."""

    crud = ReceiptCRUD(db)
    receipts, total = await run_in_threadpool(crud.list, skip=skip, limit=limit)
    data = [ReceiptResponse.model_validate(receipt, from_attributes=True) for receipt in receipts]
    meta = PaginationMeta(total=total, skip=skip, limit=limit)
    return ReceiptListResponse(data=data, meta=meta)


@router.get("/{receipt_id}")
async def get_receipt_file(receipt_id: int, db: Session = Depends(get_db)) -> FileResponse:
    """Download an existing receipt by its identifier."""

    crud = ReceiptCRUD(db)
    receipt = await run_in_threadpool(crud.get, receipt_id)
    if receipt is None:
        raise NotFoundError("Receipt not found")

    file_path = Path(receipt.file_path)
    if not file_path.exists():
        raise NotFoundError("Receipt file not found on disk")
    return FileResponse(file_path, media_type="application/pdf", filename=file_path.name)


@router.post("/{payment_id}/regenerate", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def regenerate_receipt(payment_id: int, db: Session = Depends(get_db)) -> ReceiptResponse:
    """Regenerate a receipt for an existing payment and return its metadata."""

    payment_service = PaymentService(db)
    payment = await run_in_threadpool(payment_service.get, payment_id)

    receipt_service = ReceiptService(db)
    receipt = await run_in_threadpool(receipt_service.generate, payment, regenerate=True)

    return ReceiptResponse.model_validate(receipt, from_attributes=True)
