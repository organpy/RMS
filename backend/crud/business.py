"""CRUD helper for business settings persistence."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models import Business


class BusinessCRUD:
    """Encapsulate common `Business` persistence operations."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_primary(self) -> Optional[Business]:
        """Return the first business record used for branding settings."""

        stmt = select(Business).order_by(Business.id.asc()).limit(1)
        return self.session.execute(stmt).scalars().first()

    def create(self, payload: dict) -> Business:
        """Insert a new business record."""

        business = Business(**payload)
        self.session.add(business)
        self.session.commit()
        self.session.refresh(business)
        return business

    def update(self, business: Business, payload: dict) -> Business:
        """Apply updates to the supplied business record."""

        for field, value in payload.items():
            setattr(business, field, value)
        self.session.add(business)
        self.session.commit()
        self.session.refresh(business)
        return business


__all__ = ["BusinessCRUD"]
