from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.pagination import Page, Paging, paginate
from backend.core.security import current_staff
from backend.modules.members.models import Member
from backend.modules.members.service import status_expr
from backend.modules.organization.service import get_org
from backend.modules.messaging import templates
from backend.modules.messaging.models import Message

router = APIRouter(prefix="/reminders", tags=["reminders"])

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
        select(Message.member_id, func.max(Message.sent_at).label("last"))
        .where(Message.kind == "reminder", Message.status != "failed")
        .group_by(Message.member_id)
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
                message=templates.render(org.reminder_template, templates.member_values(member, org)),
            )
        )
    return Page(items=items, total=total, page=paging.page, size=paging.size)
