from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.db import Base, Timestamps
from backend.modules.members.models import Member

METHODS = ("cash", "card", "transfer", "other")


class Payment(Timestamps, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    invoice_number: Mapped[str] = mapped_column(String(30), unique=True)
    description: Mapped[str] = mapped_column(String(200))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    method: Mapped[str] = mapped_column(String(10), default="cash")
    paid_on: Mapped[date] = mapped_column(Date, index=True)
    period_start: Mapped[Optional[date]] = mapped_column(Date)
    period_end: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(String(500))
    refunded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    member: Mapped[Member] = relationship(lazy="joined")
