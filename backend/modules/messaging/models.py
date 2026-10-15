from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.db import Base, utcnow

KINDS = ("reminder", "invoice", "announcement")
STATUSES = ("sent", "failed", "manual")


class Message(Base):
    """Every message sent (or attempted) to a member, including ones sent from a staff device."""

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    staff_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staff.id", ondelete="SET NULL"))
    payment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payments.id", ondelete="SET NULL"))
    channel: Mapped[str] = mapped_column(String(10))
    kind: Mapped[str] = mapped_column(String(15))
    recipient: Mapped[str] = mapped_column(String(255), default="")
    subject: Mapped[Optional[str]] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10))
    error: Mapped[Optional[str]] = mapped_column(String(500))
    period_ref: Mapped[Optional[date]] = mapped_column(Date)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
