"""Payment entity definitions."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, Date, DateTime, Enum as SQLEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover
    from .member import Member
    from .receipt import Receipt
    from .payment_reminder import PaymentReminder


class PaymentStatus(str, Enum):
    """Represents the lifecycle of a payment."""

    PAID = "paid"
    UNPAID = "unpaid"
    OVERDUE = "overdue"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    """Accepted forms of payment."""

    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    OTHER = "other"


class Payment(TimestampMixin, Base):
    """Records member payments and next-due information."""

    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('paid','unpaid','overdue','refunded')",
            name="ck_payments_status_valid",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), nullable=False)

    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    next_due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(
            PaymentStatus,
            name="payment_status",
            values_callable=lambda enum_cls: [payment_status.value for payment_status in enum_cls],
        ),
        default=PaymentStatus.PAID,
        nullable=False,
    )
    method: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(
            PaymentMethod,
            name="payment_method",
            values_callable=lambda enum_cls: [payment_method.value for payment_method in enum_cls],
        ),
        default=PaymentMethod.CASH,
        nullable=False,
    )
    receipt_number: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, unique=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    refunded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    member: Mapped["Member"] = relationship(back_populates="payments")
    receipt: Mapped[Optional["Receipt"]] = relationship(back_populates="payment", uselist=False)
    reminder: Mapped[Optional["PaymentReminder"]] = relationship(
        "PaymentReminder",
        back_populates="payment",
        uselist=False,
        cascade="all, delete-orphan",
    )
