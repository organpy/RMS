from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.db import Base, utcnow

CHANNELS = ("email", "sms", "whatsapp")


class Reminder(Base):
    """A log entry recording that a member was reminded about a due payment."""

    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    staff_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staff.id", ondelete="SET NULL"))
    channel: Mapped[str] = mapped_column(String(10))
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
