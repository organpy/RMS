from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core import clock
from backend.core.db import get_db
from backend.core.security import current_staff
from backend.modules.payments.models import Payment
from backend.modules.staff.models import Staff

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(current_staff)])


class Line(BaseModel):
    id: int
    invoice_number: str
    member_name: str
    description: str
    amount: Decimal
    method: str
    staff_name: Optional[str]


class StaffTotal(BaseModel):
    staff_name: Optional[str]
    total: Decimal
    by_method: dict[str, Decimal]


class DailyReport(BaseModel):
    date: date
    total: Decimal
    count: int
    by_method: dict[str, Decimal]
    by_staff: list[StaffTotal]
    payments: list[Line]
    refunds: list[Line]
    refunded_total: Decimal


def _lines(db: Session, *where) -> list[Line]:
    stmt = (
        select(Payment, Staff.name)
        .outerjoin(Staff, Staff.id == Payment.recorded_by)
        .where(*where)
        .order_by(Payment.id)
    )
    return [
        Line(
            id=p.id,
            invoice_number=p.invoice_number,
            member_name=p.member.full_name,
            description=p.description,
            amount=p.amount,
            method=p.method,
            staff_name=staff_name,
        )
        for p, staff_name in db.execute(stmt)
    ]


@router.get("/daily", response_model=DailyReport)
def daily(day: Optional[date] = None, db: Session = Depends(get_db)) -> DailyReport:
    """Cash-up for one day: what was collected, by payment method and by who took it, plus refunds."""
    day = day or clock.today()
    payments = _lines(db, Payment.paid_on == day, Payment.refunded_at.is_(None))
    refunds = _lines(db, func.date(Payment.refunded_at) == day.isoformat())

    by_method: dict[str, Decimal] = {}
    staff_totals: dict[Optional[str], StaffTotal] = {}
    for line in payments:
        by_method[line.method] = by_method.get(line.method, Decimal(0)) + line.amount
        entry = staff_totals.setdefault(line.staff_name, StaffTotal(staff_name=line.staff_name, total=Decimal(0), by_method={}))
        entry.total += line.amount
        entry.by_method[line.method] = entry.by_method.get(line.method, Decimal(0)) + line.amount
    return DailyReport(
        date=day,
        total=sum((p.amount for p in payments), Decimal(0)),
        count=len(payments),
        by_method=by_method,
        by_staff=sorted(staff_totals.values(), key=lambda s: -s.total),
        payments=payments,
        refunds=refunds,
        refunded_total=sum((r.amount for r in refunds), Decimal(0)),
    )
