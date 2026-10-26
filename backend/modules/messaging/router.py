from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.errors import AppError, NotFound
from backend.core.pagination import Page, Paging, paginate
from backend.core.security import current_staff, require_admin
from backend.modules.members.models import Member
from backend.modules.members.service import balance_of
from backend.modules.organization.service import get_org

from . import providers, service, templates
from .models import Message

router = APIRouter(tags=["messaging"])

Channel = Literal["email", "sms", "whatsapp"]
MAX_RECIPIENTS = 200


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    channel: Channel
    kind: str
    recipient: str
    subject: Optional[str]
    body: str
    status: str
    error: Optional[str]
    sent_at: datetime


class SendIn(BaseModel):
    channel: Channel
    kind: Literal["reminder", "announcement"] = "reminder"
    member_ids: Optional[list[int]] = Field(default=None, max_length=MAX_RECIPIENTS)
    course_id: Optional[int] = None
    group_id: Optional[int] = None
    subject: Optional[str] = Field(default=None, max_length=200)
    body: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _target(self):
        if not (self.member_ids or self.course_id or self.group_id):
            raise ValueError("Choose members, a course or a group")
        if self.kind == "announcement" and not (self.body or "").strip():
            raise ValueError("Announcements need a message")
        return self


class ManualIn(BaseModel):
    member_ids: list[int] = Field(min_length=1, max_length=500)
    channel: Channel


class TestIn(BaseModel):
    channel: Channel
    to: str = Field(min_length=3, max_length=255)


def recipients(db: Session, body: SendIn) -> list[Member]:
    stmt = select(Member).where(Member.archived_at.is_(None))
    if body.member_ids:
        stmt = stmt.where(Member.id.in_(body.member_ids))
    if body.course_id:
        stmt = stmt.where(Member.course_id == body.course_id)
    if body.group_id:
        stmt = stmt.where(Member.group_id == body.group_id)
    members = list(db.scalars(stmt.limit(MAX_RECIPIENTS + 1)))
    if len(members) > MAX_RECIPIENTS:
        raise AppError(f"Send to at most {MAX_RECIPIENTS} members at a time")
    return members


@router.get("/messaging/status", dependencies=[Depends(current_staff)])
def status() -> dict[str, bool]:
    return providers.configured()


@router.post("/messaging/test", dependencies=[Depends(require_admin)])
def test(body: TestIn, db: Session = Depends(get_db)) -> dict[str, str]:
    org = get_org(db)
    try:
        providers.deliver(body.channel, body.to, f"Test message from {org.name}", "Messaging is set up correctly.")
    except providers.SendError as exc:
        raise AppError(str(exc)) from None
    return {"status": "sent"}


@router.post("/messages")
def send(body: SendIn, db: Session = Depends(get_db), staff=Depends(current_staff)) -> dict[str, int]:
    org = get_org(db)
    template = body.body or org.reminder_template
    subject = body.subject or (f"Payment reminder · {org.name}" if body.kind == "reminder" else org.name)
    counts = {"sent": 0, "failed": 0}
    for member in recipients(db, body):
        text = templates.render(template, templates.member_values(member, org, balance_of(db, member.id)))
        message = service.send(
            db, member, body.channel, body.kind, text, subject=subject, staff_id=staff.id, period_ref=member.paid_until
        )
        counts[message.status] += 1
    db.commit()
    return counts


@router.post("/messages/manual", status_code=201)
def log_manual(body: ManualIn, db: Session = Depends(get_db), staff=Depends(current_staff)) -> dict[str, int]:
    """Record reminders sent from a staff member's own device (mailto / sms / WhatsApp links)."""
    members = db.scalars(select(Member).where(Member.id.in_(body.member_ids))).all()
    for m in members:
        db.add(Message(member_id=m.id, staff_id=staff.id, channel=body.channel, kind="reminder",
                       recipient=service.contact(m, body.channel) or "", status="manual", period_ref=m.paid_until))
    db.commit()
    return {"logged": len(members)}


@router.get("/messages", response_model=Page[MessageOut], dependencies=[Depends(current_staff)])
def history(
    paging: Paging,
    member_id: Optional[int] = None,
    status: Optional[Literal["sent", "failed", "manual"]] = None,
    db: Session = Depends(get_db),
) -> Page[MessageOut]:
    stmt = select(Message).order_by(Message.sent_at.desc(), Message.id.desc())
    if member_id is not None:
        stmt = stmt.where(Message.member_id == member_id)
    if status:
        stmt = stmt.where(Message.status == status)
    rows, total = paginate(db, stmt, paging)
    return Page(items=[r[0] for r in rows], total=total, page=paging.page, size=paging.size)


@router.post("/messages/{message_id}/retry", response_model=MessageOut)
def retry(message_id: int, db: Session = Depends(get_db), staff=Depends(current_staff)) -> Message:
    message = db.get(Message, message_id)
    if message is None:
        raise NotFound("Message not found")
    if message.status != "failed":
        raise AppError("Only failed messages can be retried")
    member = db.get(Member, message.member_id)
    message.recipient = service.contact(member, message.channel) or ""
    message.staff_id, message.sent_at = staff.id, datetime.now(timezone.utc)
    service.deliver(message)
    db.commit()
    return message
