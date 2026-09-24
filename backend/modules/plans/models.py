from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.db import Base, Timestamps
from backend.modules.courses.models import Course


class Plan(Timestamps, Base):
    """A priced subscription: what a member pays and how long it covers."""

    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    interval_days: Mapped[int] = mapped_column(Integer)
    course_id: Mapped[Optional[int]] = mapped_column(ForeignKey("courses.id", ondelete="SET NULL"), index=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    course: Mapped[Optional[Course]] = relationship()
