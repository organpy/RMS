from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.db import Base, Timestamps

STATUSES = ("present", "late", "absent")


class ClassSession(Timestamps, Base):
    """One meeting of a group on a given day."""

    __tablename__ = "sessions"
    __table_args__ = (UniqueConstraint("group_id", "held_on"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    held_on: Mapped[date] = mapped_column(Date, index=True)

    records: Mapped[list["Attendance"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("session_id", "member_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(10))

    session: Mapped[ClassSession] = relationship(back_populates="records")
