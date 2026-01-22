"""Member (student/customer) entity definitions."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import CheckConstraint, Date, DateTime, Enum as SQLEnum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover
    from .business import Business
    from .class_course import ClassCourse
    from .group import Group
    from .payment import Payment


class MemberStatus(str, Enum):
    """Possible lifecycle states for a member."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

    @classmethod
    def _missing_(cls, value):
        """Allow case-insensitive lookups for query and payload parsing."""

        if isinstance(value, str):
            normalized = value.strip().lower()
            for member_status in cls:
                if member_status.value == normalized:
                    return member_status
        return None


class Member(TimestampMixin, Base):
    """Represents an enrolled member of the business."""

    __tablename__ = "members"
    __table_args__ = (
        CheckConstraint("status IN ('active','inactive','suspended')", name="ck_members_status_valid"),
        Index("ix_members_business_id", "business_id"),
        Index("ix_members_status", "status"),
        Index("ix_members_class_id", "class_id"),
        Index("ix_members_group_id", "group_id"),
        Index("ix_members_archived_at", "archived_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[Optional[int]] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    membership_plan: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[MemberStatus] = mapped_column(
        SQLEnum(
            MemberStatus,
            name="member_status",
            values_callable=lambda enum_cls: [member_status.value for member_status in enum_cls],
        ),
        default=MemberStatus.ACTIVE,
        nullable=False,
    )
    joined_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    business: Mapped["Business"] = relationship(back_populates="members")
    class_course: Mapped[Optional["ClassCourse"]] = relationship(back_populates="members")
    group: Mapped[Optional["Group"]] = relationship(back_populates="members")
    payments: Mapped[List["Payment"]] = relationship(back_populates="member", cascade="all, delete-orphan")
