"""Staff entity definitions for future authentication support."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover
    from .business import Business


class StaffRole(str, Enum):
    """Role-based access control levels for staff users."""

    ADMIN = "admin"
    MANAGER = "manager"
    VIEWER = "viewer"


class Staff(TimestampMixin, Base):
    """Future-ready staff member entity used for authentication and RBAC."""

    __tablename__ = "staff"
    __table_args__ = (
        {
            "sqlite_autoincrement": True,
        },
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)

    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[StaffRole] = mapped_column(
        SQLEnum(
            StaffRole,
            name="staff_role",
            values_callable=lambda enum_cls: [staff_role.value for staff_role in enum_cls],
        ),
        default=StaffRole.VIEWER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    business: Mapped["Business"] = relationship(back_populates="staff")
