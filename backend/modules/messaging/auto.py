"""Automatic payment reminders, sent by the background jobs loop.

Each coverage period (``paid_until``) gets at most one reminder shortly before it ends and one
after the grace offset. Members who fell behind long before the feature was enabled are left to
the Reminders page, so switching it on never floods everyone at once.
"""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from backend.core import clock
from backend.core.db import session_scope
from backend.modules.members.models import Member
from backend.modules.organization.service import get_org

from . import providers, service, templates
from .models import Message

ORDER = ("email", "whatsapp", "sms")
CATCH_UP_DAYS = 7


def _reminded(*extra):
    """An automatic reminder already exists for the member's current coverage period."""
    return exists().where(
        Message.member_id == Member.id,
        Message.kind == "reminder",
        Message.staff_id.is_(None),
        Message.period_ref == Member.paid_until,
        *extra,
    )


def due(db: Session, today: date) -> list[Member]:
    org = get_org(db)
    before = select(Member).where(
        Member.paid_until.between(today, today + timedelta(days=org.remind_before_days)),
        ~_reminded(),
    )
    after_end = today - timedelta(days=org.remind_after_days)
    after = select(Member).where(
        Member.paid_until.between(after_end - timedelta(days=CATCH_UP_DAYS), after_end),
        ~_reminded(Message.sent_at >= Member.paid_until),  # one more once it has ended
    )
    active = Member.archived_at.is_(None)
    return list(db.scalars(before.where(active))) + list(db.scalars(after.where(active)))


def run(today: date | None = None) -> int:
    """Send due automatic reminders; returns how many were attempted."""
    today = today or clock.today()
    channels = [c for c in ORDER if providers.configured()[c]]
    if not channels:
        return 0
    # Stamp messages on ``today`` so the before/after rule follows the same clock as the windows.
    sent_at = datetime.combine(today, datetime.now(timezone.utc).timetz())
    attempted = 0
    with session_scope() as db:
        org = get_org(db)
        if not org.auto_remind:
            return 0
        for member in due(db, today):
            channel = next((c for c in channels if service.contact(member, c)), None)
            if channel is None:
                continue
            text = templates.render(org.reminder_template, templates.member_values(member, org))
            service.send(db, member, channel, "reminder", text, subject=f"Payment reminder · {org.name}", period_ref=member.paid_until, sent_at=sent_at)
            attempted += 1
    return attempted
