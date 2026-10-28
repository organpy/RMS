from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.db import Base, Timestamps


class Expense(Timestamps, Base):
    """Money the organization spent (rent, equipment, salaries...), used for profit reporting."""

    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    spent_on: Mapped[date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(60), index=True)
    description: Mapped[str] = mapped_column(String(200))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    method: Mapped[str] = mapped_column(String(10), default="cash")
    staff_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staff.id", ondelete="SET NULL"))
