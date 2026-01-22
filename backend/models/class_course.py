"""Class/course/program entity definitions."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover - import for type checkers only
    from .business import Business
    from .class_membership_plan import ClassMembershipPlan
    from .group import Group
    from .member import Member


class ClassCourse(TimestampMixin, Base):
    """Represents a class, course, or program offered by a business."""

    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    grouping_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    business: Mapped["Business"] = relationship(back_populates="classes")
    groups: Mapped[List["Group"]] = relationship(back_populates="class_course", cascade="all, delete-orphan")
    members: Mapped[List["Member"]] = relationship(back_populates="class_course")
    membership_plans: Mapped[List["ClassMembershipPlan"]] = relationship(
        back_populates="class_course",
        cascade="all, delete-orphan",
        order_by="ClassMembershipPlan.id",
    )
