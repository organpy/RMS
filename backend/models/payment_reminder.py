"""Models for tracking payment reminder scheduling and history."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin
from .payment import Payment
from .member import Member


class ReminderStatus(str, Enum):
    """Lifecycle status for a payment reminder queue entry."""

    IDLE = "idle"
    QUEUED = "queued"
    SENT = "sent"


class PaymentReminder(TimestampMixin, Base):
    """Represents the active reminder scheduling state for a payment."""

    __tablename__ = "payment_reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id", ondelete="CASCADE"), unique=True, nullable=False)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[ReminderStatus] = mapped_column(
        SQLEnum(ReminderStatus, name="reminder_status"),
        default=ReminderStatus.IDLE,
        nullable=False,
    )
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    payment: Mapped[Payment] = relationship("Payment", back_populates="reminder")
    member: Mapped[Member] = relationship("Member")
    logs: Mapped[list[PaymentReminderLog]] = relationship(
        "PaymentReminderLog",
        back_populates="reminder",
        cascade="all, delete-orphan",
        order_by="PaymentReminderLog.attempted_at.desc()",
    )


class ReminderAttemptResult(str, Enum):
    """Possible outcomes for a reminder attempt."""

    QUEUED = "queued"
    SKIPPED = "skipped"
    COMPLETED = "completed"


class PaymentReminderLog(TimestampMixin, Base):
    """Historical record of reminder actions taken for a payment."""

    __tablename__ = "payment_reminder_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reminder_id: Mapped[int] = mapped_column(ForeignKey("payment_reminders.id", ondelete="CASCADE"), nullable=False)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[ReminderAttemptResult] = mapped_column(
        SQLEnum(ReminderAttemptResult, name="reminder_attempt_result"),
        default=ReminderAttemptResult.QUEUED,
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    reminder: Mapped[PaymentReminder] = relationship("PaymentReminder", back_populates="logs")


__all__ = [
    "PaymentReminder",
    "PaymentReminderLog",
    "ReminderStatus",
    "ReminderAttemptResult",
]
