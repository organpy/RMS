"""Common schema utilities used across endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PaginationMeta(BaseModel):
    """Metadata describing a paginated collection."""

    total: int
    skip: int
    limit: int


class TimestampedSchema(BaseModel):
    """Base schema that exposes created/updated timestamps."""

    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    updated_at: datetime


class ClassSummary(BaseModel):
    """Lightweight representation of a class for embedding within other payloads."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    grouping_type: Optional[str] = None


class GroupSummary(BaseModel):
    """Lightweight representation of a group for embedding within other payloads."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
