import csv
import io
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.errors import Conflict
from backend.core.pagination import Paging, paginate
from backend.core.security import current_staff
from backend.modules.members.models import Member
from backend.modules.members.service import search_filter

from . import service
from .models import Payment
from .schemas import Method, PaymentIn, PaymentOut, PaymentPage, PaymentUpdate

router = APIRouter(prefix="/payments", tags=["payments"], dependencies=[Depends(current_staff)])


def _query(q, member_id, method, date_from, date_to, include_refunded):
    stmt = select(Payment).join(Payment.member)
    if q:
        stmt = stmt.where(search_filter(q) | Payment.invoice_number.ilike(f"%{q.strip()}%"))
    if member_id is not None:
        stmt = stmt.where(Payment.member_id == member_id)
    if method:
        stmt = stmt.where(Payment.method == method)
    if date_from:
        stmt = stmt.where(Payment.paid_on >= date_from)
    if date_to:
        stmt = stmt.where(Payment.paid_on <= date_to)
    if not include_refunded:
        stmt = stmt.where(Payment.refunded_at.is_(None))
    return stmt


def _filters(
    q: Optional[str] = Query(None, max_length=100),
    member_id: Optional[int] = None,
    method: Optional[Method] = None,
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
    include_refunded: bool = True,
) -> dict:
    return dict(q=q, member_id=member_id, method=method, date_from=date_from, date_to=date_to, include_refunded=include_refunded)


@router.get("", response_model=PaymentPage)
def list_payments(paging: Paging, filters: dict = Depends(_filters), db: Session = Depends(get_db)) -> PaymentPage:
    stmt = _query(**filters)
    total_amount = db.scalar(
        stmt.where(Payment.refunded_at.is_(None)).with_only_columns(func.coalesce(func.sum(Payment.amount), 0))
    )
    rows, total = paginate(db, stmt.order_by(Payment.paid_on.desc(), Payment.id.desc()), paging)
    return PaymentPage(
        items=[service.to_out(p) for (p,) in rows],
        total=total,
        page=paging.page,
        size=paging.size,
        amount_total=Decimal(total_amount or 0),
    )


@router.get("/export.csv")
def export_csv(filters: dict = Depends(_filters), db: Session = Depends(get_db)) -> StreamingResponse:
    payments = db.scalars(_query(**filters).order_by(Payment.paid_on.desc(), Payment.id.desc())).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Invoice", "Date", "Member", "Description", "Amount", "Method", "Period start", "Period end", "Refunded"])
    for p in payments:
        writer.writerow([p.invoice_number, p.paid_on, p.member.full_name, p.description, p.amount, p.method, p.period_start, p.period_end, p.refunded_at or ""])
    headers = {"Content-Disposition": 'attachment; filename="payments.csv"'}
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers=headers)


@router.post("", response_model=PaymentOut, status_code=201)
def create_payment(body: PaymentIn, db: Session = Depends(get_db)) -> PaymentOut:
    return service.to_out(service.record(db, body))


@router.get("/{payment_id}", response_model=PaymentOut)
def read_payment(payment_id: int, db: Session = Depends(get_db)) -> PaymentOut:
    return service.to_out(service.get_payment(db, payment_id))


@router.patch("/{payment_id}", response_model=PaymentOut)
def update_payment(payment_id: int, body: PaymentUpdate, db: Session = Depends(get_db)) -> PaymentOut:
    payment = service.get_payment(db, payment_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(payment, key, value)
    db.commit()
    return service.to_out(payment)


@router.post("/{payment_id}/refund", response_model=PaymentOut)
def refund_payment(payment_id: int, db: Session = Depends(get_db)) -> PaymentOut:
    payment = service.get_payment(db, payment_id)
    if payment.refunded_at:
        raise Conflict("Payment already refunded")
    payment.refunded_at = datetime.now(timezone.utc)
    db.flush()
    service.refresh_paid_until(db, db.get(Member, payment.member_id))
    db.commit()
    return service.to_out(payment)
