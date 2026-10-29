"""Business analytics for a date range. Bucketing is done in Python so it works on any database."""

import csv
import io
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from backend.core import clock
from backend.core.db import get_db
from backend.core.errors import AppError
from backend.core.security import current_staff
from backend.modules.attendance.models import Attendance, ClassSession
from backend.modules.courses.models import Course, Group
from backend.modules.expenses.models import Expense
from backend.modules.members.models import Member
from backend.modules.payments.models import Payment
from backend.modules.payments.service import discounted
from backend.modules.plans.models import Plan

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(current_staff)])

MAX_MONTHS = 36
ZERO = Decimal(0)


class Kpis(BaseModel):
    collected: Decimal
    collected_prev: Decimal
    expenses: Decimal
    expenses_prev: Decimal
    profit: Decimal
    profit_prev: Decimal
    payments: int
    new_members: int
    new_members_prev: int
    active_members: int  # members whose coverage includes the end of the range
    arpu: Decimal  # collected per member who paid in the range
    collection_rate: Optional[float]  # share of what was charged that was actually collected
    churned: int  # members whose coverage ended in the range and who have not renewed
    churn_rate: Optional[float]  # lapsed / (lapsed + still covered)
    attendance_rate: Optional[float]


class MonthPoint(BaseModel):
    month: str
    revenue: Decimal
    expenses: Decimal
    profit: Decimal
    payments: int
    new_members: int
    active_members: int


class Share(BaseModel):
    name: str
    revenue: Decimal


class Forecast(BaseModel):
    days: int
    members: int
    amount: Decimal


class AgingBucket(BaseModel):
    label: str
    members: int
    amount: Decimal


class Analytics(BaseModel):
    start: date
    end: date
    kpis: Kpis
    months: list[MonthPoint]
    forecast: list[Forecast]
    aging: list[AgingBucket]
    by_method: list[Share]
    by_plan: list[Share]
    by_course: list[Share]
    by_group: list[Share]


def _next_month(d: date) -> date:
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1)


def _month_starts(start: date, end: date) -> list[date]:
    out, cursor = [], start.replace(day=1)
    while cursor <= end:
        out.append(cursor)
        cursor = _next_month(cursor)
    return out


def default_range() -> tuple[date, date]:
    today = clock.today()
    first = today.replace(day=1)
    for _ in range(11):
        first = (first - timedelta(days=1)).replace(day=1)
    return first, today


def _sum(db: Session, column, *where) -> Decimal:
    return Decimal(db.scalar(select(func.coalesce(func.sum(column), 0)).where(*where)) or 0)


def _ratio(part, whole) -> Optional[float]:
    return round(float(part) / float(whole), 3) if whole else None


def compute(db: Session, start: date, end: date) -> Analytics:
    if end < start:
        raise AppError("The end date must not be before the start date")
    months = _month_starts(start, end)
    if len(months) > MAX_MONTHS:
        raise AppError(f"Choose a range of at most {MAX_MONTHS} months")
    today = clock.today()
    live = Payment.refunded_at.is_(None)
    in_range = (Payment.paid_on >= start, Payment.paid_on <= end)

    span = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=span - 1)

    collected = _sum(db, Payment.amount, live, *in_range)
    collected_prev = _sum(db, Payment.amount, live, Payment.paid_on >= prev_start, Payment.paid_on <= prev_end)
    spent = _sum(db, Expense.amount, Expense.spent_on >= start, Expense.spent_on <= end)
    spent_prev = _sum(db, Expense.amount, Expense.spent_on >= prev_start, Expense.spent_on <= prev_end)
    charged = _sum(db, Payment.amount_due, live, *in_range)
    paying, count = db.execute(select(func.count(func.distinct(Payment.member_id)), func.count()).where(live, *in_range)).one()
    joined = lambda a, b: db.scalar(select(func.count()).where(Member.joined_on >= a, Member.joined_on <= b))  # noqa: E731

    def active_on(day: date) -> int:
        return db.scalar(
            select(func.count(func.distinct(Payment.member_id))).where(live, Payment.period_start <= day, Payment.period_end >= day)
        ) or 0

    churned = db.scalar(
        select(func.count()).where(Member.archived_at.is_(None), Member.paid_until >= start, Member.paid_until < min(end, today))
    ) or 0
    attended = func.sum(case((Attendance.status.in_(("present", "late")), 1), else_=0))
    att_hit, att_total = db.execute(
        select(func.coalesce(attended, 0), func.count()).select_from(Attendance).join(ClassSession).where(ClassSession.held_on >= start, ClassSession.held_on <= end)
    ).one()

    active_end = active_on(min(end, today))
    kpis = Kpis(
        collected=collected,
        collected_prev=collected_prev,
        expenses=spent,
        expenses_prev=spent_prev,
        profit=collected - spent,
        profit_prev=collected_prev - spent_prev,
        payments=count,
        new_members=joined(start, end),
        new_members_prev=joined(prev_start, prev_end),
        active_members=active_end,
        arpu=(collected / paying).quantize(Decimal("0.01")) if paying else ZERO,
        collection_rate=_ratio(collected, charged),
        churned=churned,
        churn_rate=_ratio(churned, churned + active_end),
        attendance_rate=_ratio(att_hit, att_total),
    )

    # Monthly series.
    key = lambda d: d.strftime("%Y-%m")  # noqa: E731
    begin, stop = months[0], _next_month(months[-1])
    revenue, counts, outgoing, new = (defaultdict(Decimal), defaultdict(int), defaultdict(Decimal), defaultdict(int))
    for paid_on, amount in db.execute(select(Payment.paid_on, Payment.amount).where(live, Payment.paid_on >= begin, Payment.paid_on < stop)):
        revenue[key(paid_on)] += amount
        counts[key(paid_on)] += 1
    for spent_on, amount in db.execute(select(Expense.spent_on, Expense.amount).where(Expense.spent_on >= begin, Expense.spent_on < stop)):
        outgoing[key(spent_on)] += amount
    for (joined_on,) in db.execute(select(Member.joined_on).where(Member.joined_on >= begin, Member.joined_on < stop)):
        new[key(joined_on)] += 1
    periods = db.execute(select(Payment.member_id, Payment.period_start, Payment.period_end).where(live, Payment.period_start < stop, Payment.period_end >= begin)).all()
    points = []
    for first in months:
        last = _next_month(first)
        k = key(first)
        active = {m for m, s, e in periods if s < last and e >= first}
        points.append(MonthPoint(month=k, revenue=revenue[k], expenses=outgoing[k], profit=revenue[k] - outgoing[k], payments=counts[k], new_members=new[k], active_members=len(active)))

    # Expected renewals: members whose coverage ends soon, valued at their (discounted) plan price.
    upcoming = db.execute(
        select(Member.paid_until, Plan.price, Member.discount_percent)
        .outerjoin(Plan, Plan.id == Member.plan_id)
        .where(Member.archived_at.is_(None), Member.paid_until > today, Member.paid_until <= today + timedelta(days=90))
    ).all()
    forecast = []
    for days in (30, 60, 90):
        rows = [(price, pct) for until, price, pct in upcoming if until <= today + timedelta(days=days)]
        forecast.append(Forecast(days=days, members=len(rows), amount=sum((discounted(p, pct) for p, pct in rows if p is not None), ZERO)))

    # Overdue aging by days since coverage ended.
    edges = [(30, "1–30 days"), (60, "31–60 days"), (90, "61–90 days"), (None, "Over 90 days")]
    aging = {label: [0, ZERO] for _, label in edges}
    for until, price, pct in db.execute(
        select(Member.paid_until, Plan.price, Member.discount_percent)
        .outerjoin(Plan, Plan.id == Member.plan_id)
        .where(Member.archived_at.is_(None), Member.paid_until < today)
    ):
        days = (today - until).days
        label = next(lbl for limit, lbl in edges if limit is None or days <= limit)
        aging[label][0] += 1
        aging[label][1] += discounted(price, pct) if price is not None else ZERO

    def shares(label, *joins):
        stmt = select(label, func.sum(Payment.amount)).select_from(Payment)
        for target, on in joins:
            stmt = stmt.outerjoin(target, on)
        stmt = stmt.where(live, *in_range).group_by(label).order_by(func.sum(Payment.amount).desc())
        return [Share(name=name or "Other", revenue=Decimal(total)) for name, total in db.execute(stmt)]

    member_join = (Member, Member.id == Payment.member_id)
    return Analytics(
        start=start,
        end=end,
        kpis=kpis,
        months=points,
        forecast=forecast,
        aging=[AgingBucket(label=label, members=n, amount=amount) for label, (n, amount) in aging.items()],
        by_method=shares(Payment.method),
        by_plan=shares(Payment.description),
        by_course=shares(Course.name, member_join, (Course, Course.id == Member.course_id)),
        by_group=shares(Group.name, member_join, (Group, Group.id == Member.group_id)),
    )


def _range(start: Optional[date], end: Optional[date]) -> tuple[date, date]:
    default_start, default_end = default_range()
    return start or default_start, end or default_end


@router.get("", response_model=Analytics)
def analytics(start: Optional[date] = None, end: Optional[date] = None, db: Session = Depends(get_db)) -> Analytics:
    return compute(db, *_range(start, end))


@router.get("/export.csv")
def export(start: Optional[date] = None, end: Optional[date] = None, db: Session = Depends(get_db)) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Month", "Revenue", "Expenses", "Profit", "Payments", "New members", "Active members"])
    for p in compute(db, *_range(start, end)).months:
        writer.writerow([p.month, p.revenue, p.expenses, p.profit, p.payments, p.new_members, p.active_members])
    headers = {"Content-Disposition": 'attachment; filename="analytics.csv"'}
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers=headers)
