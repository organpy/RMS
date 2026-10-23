from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.db import Base, Timestamps
from backend.modules.courses.models import Course, Group
from backend.modules.plans.models import Plan


class Member(Timestamps, Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(40))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    discount_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    guardian_name: Mapped[Optional[str]] = mapped_column(String(120))
    guardian_phone: Mapped[Optional[str]] = mapped_column(String(40))
    guardian_email: Mapped[Optional[str]] = mapped_column(String(255))
    course_id: Mapped[Optional[int]] = mapped_column(ForeignKey("courses.id", ondelete="SET NULL"), index=True)
    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("groups.id", ondelete="SET NULL"), index=True)
    plan_id: Mapped[Optional[int]] = mapped_column(ForeignKey("plans.id", ondelete="SET NULL"), index=True)
    joined_on: Mapped[date] = mapped_column(Date, default=date.today)
    paid_until: Mapped[Optional[date]] = mapped_column(Date, index=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)

    course: Mapped[Optional[Course]] = relationship(lazy="joined")
    group: Mapped[Optional[Group]] = relationship(lazy="joined")
    plan: Mapped[Optional[Plan]] = relationship(lazy="joined")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
