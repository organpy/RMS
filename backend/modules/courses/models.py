from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.db import Base, Timestamps


class Course(Timestamps, Base):
    """A class, course or programme (e.g. "Grade 5", "CrossFit", "Piano")."""

    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[Optional[str]] = mapped_column(Text)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    groups: Mapped[list["Group"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="Group.name"
    )


class Group(Timestamps, Base):
    """A section of a course (e.g. "Morning", "Group B")."""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    schedule: Mapped[Optional[str]] = mapped_column(String(200))
    capacity: Mapped[Optional[int]] = mapped_column(Integer)

    course: Mapped[Course] = relationship(back_populates="groups")
