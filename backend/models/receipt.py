"""Receipt metadata persistence."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:  # pragma: no cover
    from .payment import Payment


class Receipt(TimestampMixin, Base):
    """Stores references to generated receipt files."""

    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, unique=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    payment: Mapped["Payment"] = relationship(back_populates="receipt")
