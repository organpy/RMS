"""Class membership plan definitions."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover
    from .class_course import ClassCourse


class ClassMembershipPlan(TimestampMixin, Base):
    """Represents a predefined membership plan for a class."""

    __tablename__ = "class_membership_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False)

    class_course: Mapped["ClassCourse"] = relationship(back_populates="membership_plans")
