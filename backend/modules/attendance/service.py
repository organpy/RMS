from datetime import date, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from backend.core import clock

from .models import Attendance, ClassSession

RATE_WINDOW_DAYS = 90


def rates(db: Session, member_ids: list[int] | None = None, since: date | None = None) -> dict[int, float]:
    """Share of recorded sessions each member attended (present or late), over the last 90 days."""
    since = since or clock.today() - timedelta(days=RATE_WINDOW_DAYS)
    attended = func.sum(case((Attendance.status.in_(("present", "late")), 1), else_=0))
    stmt = (
        select(Attendance.member_id, attended, func.count())
        .join(ClassSession)
        .where(ClassSession.held_on >= since)
        .group_by(Attendance.member_id)
    )
    if member_ids is not None:
        stmt = stmt.where(Attendance.member_id.in_(member_ids))
    return {member_id: round(hit / total, 3) for member_id, hit, total in db.execute(stmt) if total}
