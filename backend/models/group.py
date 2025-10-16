"""Group entity definitions."""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover - import for type hints only
    from .class_course import ClassCourse
    from .member import Member


class Group(TimestampMixin, Base):
    """Represents a subgroup within a class/course."""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    class_course: Mapped["ClassCourse"] = relationship(back_populates="groups")
    members: Mapped[List["Member"]] = relationship(back_populates="group", cascade="all, delete-orphan")
