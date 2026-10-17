from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.db import Base, Timestamps

DEFAULT_REMINDER = (
    "Hi {first_name}, a friendly reminder that your {plan} membership at {organization} "
    "was due on {due_date}. Thank you!"
)


class Organization(Timestamps, Base):
    """Single-row table holding the install's identity, billing and backup preferences."""

    __tablename__ = "organization"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(40))
    address: Mapped[Optional[str]] = mapped_column(String(500))
    tax_id: Mapped[Optional[str]] = mapped_column(String(60))
    logo_mime: Mapped[Optional[str]] = mapped_column(String(40))
    primary_color: Mapped[str] = mapped_column(String(7), default="#18181b")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    locale: Mapped[str] = mapped_column(String(10), default="en-US")
    grace_days: Mapped[int] = mapped_column(Integer, default=7)
    reminder_template: Mapped[str] = mapped_column(Text, default=DEFAULT_REMINDER)
    invoice_prefix: Mapped[str] = mapped_column(String(10), default="INV")
    auto_remind: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    remind_before_days: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    remind_after_days: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    backup_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    backup_cadence: Mapped[str] = mapped_column(String(10), default="daily")
    backup_keep: Mapped[int] = mapped_column(Integer, default=7)
    backup_last_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
