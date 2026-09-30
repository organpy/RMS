from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core import clock
from backend.core.db import get_db
from backend.core.security import current_staff
from backend.modules.members.models import Member
from backend.modules.members.schemas import MemberOut
from backend.modules.members.service import count_by_status, status_expr, to_out
from backend.modules.payments.models import Payment
from backend.modules.payments.schemas import PaymentOut
from backend.modules.payments.service import to_out as payment_out

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(current_staff)])


class Dashboard(BaseModel):
    counts: dict[str, int]
    revenue_month: Decimal
    revenue_prev_month: Decimal
    payments_month: int
    new_members_month: int
    expiring: list[MemberOut]
    overdue: list[MemberOut]
    recent_payments: list[PaymentOut]


def _month_start(d: date) -> date:
    return d.replace(day=1)


@router.get("", response_model=Dashboard)
def dashboard(db: Session = Depends(get_db)) -> Dashboard:
    today = clock.today()
    month = _month_start(today)
    prev = _month_start(month - timedelta(days=1))

    def revenue(start: date, end: date):
        return db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0), func.count()).where(
                Payment.refunded_at.is_(None), Payment.paid_on >= start, Payment.paid_on < end
            )
        ).one()

    rev_month, count_month = revenue(month, today + timedelta(days=1))
    rev_prev, _ = revenue(prev, month)
    status_col = status_expr(db)

    def members(where, order, limit=6):
        rows = db.execute(select(Member, status_col).where(where).order_by(*order).limit(limit)).all()
        return [to_out(*row) for row in rows]

    return Dashboard(
        counts=count_by_status(db),
        revenue_month=Decimal(rev_month),
        revenue_prev_month=Decimal(rev_prev),
        payments_month=count_month,
        new_members_month=db.scalar(
            select(func.count()).where(Member.joined_on >= month, Member.archived_at.is_(None))
        ),
        expiring=members(
            (status_col == "active") & (Member.paid_until <= today + timedelta(days=7)), [Member.paid_until]
        ),
        overdue=members(status_col == "overdue", [Member.paid_until]),
        recent_payments=[
            payment_out(p) for p in db.scalars(select(Payment).order_by(Payment.created_at.desc()).limit(6))
        ],
    )
