from datetime import date

from sqlalchemy.orm import Session

from backend.modules.members.models import Member

from . import providers
from .models import Message


def contact(member: Member, channel: str) -> str | None:
    return member.email if channel == "email" else member.phone


def send(
    db: Session,
    member: Member,
    channel: str,
    kind: str,
    body: str,
    subject: str | None = None,
    attachment: tuple[str, bytes] | None = None,
    staff_id: int | None = None,
    payment_id: int | None = None,
    period_ref: date | None = None,
) -> Message:
    """Deliver one message and record the outcome. Never raises for delivery problems."""
    recipient = contact(member, channel)
    message = Message(
        member_id=member.id,
        staff_id=staff_id,
        payment_id=payment_id,
        channel=channel,
        kind=kind,
        recipient=recipient or "",
        subject=subject,
        body=body,
        period_ref=period_ref,
    )
    deliver(message, attachment)
    db.add(message)
    db.flush()
    return message


def deliver(message: Message, attachment: tuple[str, bytes] | None = None) -> None:
    if not message.recipient:
        message.status, message.error = "failed", f"No {'email address' if message.channel == 'email' else 'phone number'}"
        return
    try:
        providers.deliver(message.channel, message.recipient, message.subject or "", message.body, attachment)
        message.status, message.error = "sent", None
    except providers.SendError as exc:
        message.status, message.error = "failed", str(exc)[:500]
