"""Member (student/customer) entity definitions."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import CheckConstraint, Date, Enum as SQLEnum, ForeignKey, String
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


class Member(TimestampMixin, Base):
    """Represents an enrolled member of the business."""

    __tablename__ = "members"
    __table_args__ = (
        CheckConstraint("status IN ('active','inactive','suspended')", name="ck_members_status_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[Optional[int]] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
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

    business: Mapped["Business"] = relationship(back_populates="members")
    class_course: Mapped[Optional["ClassCourse"]] = relationship(back_populates="members")
    group: Mapped[Optional["Group"]] = relationship(back_populates="members")
    payments: Mapped[List["Payment"]] = relationship(back_populates="member", cascade="all, delete-orphan")
