from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.db import Base, utcnow


class AuditLog(Base):
    """Who changed what, and when. The staff name is copied so entries outlive the account."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staff.id", ondelete="SET NULL"))
    staff_name: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(20))
    entity: Mapped[str] = mapped_column(String(20), index=True)
    entity_id: Mapped[Optional[int]] = mapped_column()
    summary: Mapped[str] = mapped_column(String(300))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
