"""Business entity representing the organization using the system."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover - used only for static type checking
    from .class_course import ClassCourse
    from .member import Member
    from .staff import Staff


class Business(TimestampMixin, Base):
    """Stores branding, localization, and contact information for a business."""

    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    logo_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    secondary_color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="EN")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    backup_scheduler_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    backup_cadence: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    backup_retention_count: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    backup_retention_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    backup_last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    backup_next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    classes: Mapped[List["ClassCourse"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    members: Mapped[List["Member"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    staff: Mapped[List["Staff"]] = relationship(back_populates="business", cascade="all, delete-orphan")
