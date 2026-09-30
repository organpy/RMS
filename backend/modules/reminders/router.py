import re
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.pagination import Page, Paging, paginate
from backend.core.security import current_staff
from backend.modules.invoices.render import money
from backend.modules.members.models import Member
from backend.modules.members.service import status_expr
from backend.modules.organization.service import get_org

from .models import Reminder

router = APIRouter(prefix="/reminders", tags=["reminders"])

PLACEHOLDER = re.compile(r"\{(\w+)\}")


class ReminderItem(BaseModel):
    member_id: int
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    plan_name: Optional[str]
    amount: Optional[Decimal]
    paid_until: Optional[date]
    status: Literal["due", "overdue"]
    last_reminded_at: Optional[datetime]
    message: str


class ReminderLog(BaseModel):
    member_ids: list[int] = Field(min_length=1, max_length=500)
    channel: Literal["email", "sms", "whatsapp"]


def render_message(template: str, values: dict[str, str]) -> str:
    return PLACEHOLDER.sub(lambda m: values.get(m.group(1), m.group(0)), template)


@router.get("", response_model=Page[ReminderItem])
def pending(
    paging: Paging,
    status: Optional[Literal["due", "overdue"]] = None,
    db: Session = Depends(get_db),
    _=Depends(current_staff),
) -> Page[ReminderItem]:
    org = get_org(db)
    status_col = status_expr(db)
    last = (
        select(Reminder.member_id, func.max(Reminder.sent_at).label("last"))
        .group_by(Reminder.member_id)
        .subquery()
    )
    stmt = (
        select(Member, status_col, last.c.last)
        .outerjoin(last, last.c.member_id == Member.id)
        .where(status_col.in_([status] if status else ["due", "overdue"]))
        .order_by(Member.paid_until.asc().nulls_last(), Member.last_name)
    )
    rows, total = paginate(db, stmt, paging)
    items = []
    for member, member_status, last_at in rows:
        amount = member.plan.price if member.plan else None
        values = {
            "first_name": member.first_name,
            "last_name": member.last_name,
            "plan": member.plan.name if member.plan else "membership",
            "organization": org.name,
            "due_date": member.paid_until.strftime("%d %b %Y") if member.paid_until else "now",
            "amount": money(amount, org.currency, org.locale) if amount is not None else "",
        }
        items.append(
            ReminderItem(
                member_id=member.id,
                full_name=member.full_name,
                email=member.email,
                phone=member.phone,
                plan_name=member.plan.name if member.plan else None,
                amount=amount,
                paid_until=member.paid_until,
                status=member_status,
                last_reminded_at=last_at,
                message=render_message(org.reminder_template, values),
            )
        )
    return Page(items=items, total=total, page=paging.page, size=paging.size)


@router.post("", status_code=201)
def log_reminders(body: ReminderLog, db: Session = Depends(get_db), staff=Depends(current_staff)) -> dict[str, int]:
    """Record that members were contacted (the message itself is sent from the staff's own device)."""
    ids = set(db.scalars(select(Member.id).where(Member.id.in_(body.member_ids))))
    db.add_all(Reminder(member_id=i, staff_id=staff.id, channel=body.channel) for i in ids)
    db.commit()
    return {"logged": len(ids)}
