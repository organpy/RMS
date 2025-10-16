"""Shared mixins and base classes for ORM models."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from sqlalchemy import func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base class for all SQLAlchemy models."""


created_at_annotation = Annotated[datetime, mapped_column(server_default=func.now(), nullable=False)]
updated_at_annotation = Annotated[
    datetime,
    mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False),
]


class TimestampMixin:
    """Add created/updated timestamps to inheriting models."""

    created_at: Mapped[created_at_annotation]
    updated_at: Mapped[updated_at_annotation]
