"""Schemas for receipt related API payloads."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from .common import PaginationMeta, TimestampedSchema


class ReceiptResponse(TimestampedSchema):
    """Represents a generated receipt record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_id: int
    file_path: str


class ReceiptListResponse(BaseModel):
    """Paginated collection of receipts."""

    model_config = ConfigDict(extra="forbid")

    data: list[ReceiptResponse]
    meta: PaginationMeta
