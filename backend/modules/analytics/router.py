"""Monthly aggregates. Bucketing is done in Python so it works on any database."""

import csv
import io
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core import clock
from backend.core.db import get_db
from backend.core.security import current_staff
from backend.modules.courses.models import Course
from backend.modules.members.models import Member
from backend.modules.payments.models import Payment

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(current_staff)])


class MonthPoint(BaseModel):
    month: str
    revenue: Decimal
    payments: int
    new_members: int
    active_members: int


class Share(BaseModel):
    name: str
    revenue: Decimal


class Analytics(BaseModel):
    months: list[MonthPoint]
    by_plan: list[Share]
    by_course: list[Share]


def _months(count: int) -> list[date]:
    first = clock.today().replace(day=1)
    out = [first]
    for _ in range(count - 1):
        out.append((out[-1] - timedelta(days=1)).replace(day=1))
    return out[::-1]


def _next_month(d: date) -> date:
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1)


def compute(db: Session, months: int) -> Analytics:
    starts = _months(months)
    begin, end = starts[0], _next_month(starts[-1])
    key = lambda d: d.strftime("%Y-%m")  # noqa: E731
    paid = Payment.refunded_at.is_(None)

    revenue: dict[str, Decimal] = defaultdict(Decimal)
    counts: dict[str, int] = defaultdict(int)
    for paid_on, amount in db.execute(
        select(Payment.paid_on, Payment.amount).where(paid, Payment.paid_on >= begin, Payment.paid_on < end)
    ):
        revenue[key(paid_on)] += amount
        counts[key(paid_on)] += 1

    joined: dict[str, int] = defaultdict(int)
    for (joined_on,) in db.execute(select(Member.joined_on).where(Member.joined_on >= begin, Member.joined_on < end)):
        joined[key(joined_on)] += 1

    periods = db.execute(
        select(Payment.member_id, Payment.period_start, Payment.period_end).where(
            paid, Payment.period_start < end, Payment.period_end >= begin
        )
    ).all()
    points = []
    for start in starts:
        stop = _next_month(start)
        active = {m for m, s, e in periods if s < stop and e >= start}
        k = key(start)
        points.append(MonthPoint(month=k, revenue=revenue[k], payments=counts[k], new_members=joined[k], active_members=len(active)))

    def shares(label, *joins):
        stmt = select(label, func.sum(Payment.amount)).select_from(Payment)
        for target, on in joins:
            stmt = stmt.join(target, on)
        stmt = stmt.where(paid, Payment.paid_on >= begin, Payment.paid_on < end).group_by(label)
        rows = db.execute(stmt.order_by(func.sum(Payment.amount).desc())).all()
        return [Share(name=name or "Other", revenue=Decimal(total)) for name, total in rows]

    return Analytics(
        months=points,
        by_plan=shares(Payment.description),
        by_course=shares(Course.name, (Member, Member.id == Payment.member_id), (Course, Course.id == Member.course_id)),
    )


@router.get("", response_model=Analytics)
def analytics(months: int = Query(12, ge=1, le=36), db: Session = Depends(get_db)) -> Analytics:
    return compute(db, months)


@router.get("/export.csv")
def export(months: int = Query(12, ge=1, le=36), db: Session = Depends(get_db)) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Month", "Revenue", "Payments", "New members", "Active members"])
    for p in compute(db, months).months:
        writer.writerow([p.month, p.revenue, p.payments, p.new_members, p.active_members])
    headers = {"Content-Disposition": 'attachment; filename="analytics.csv"'}
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers=headers)
