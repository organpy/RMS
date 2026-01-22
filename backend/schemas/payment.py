"""Payment-related Pydantic schemas."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field

from backend.models import ReminderStatus
from backend.models.payment import PaymentMethod, PaymentStatus
from .common import PaginationMeta, TimestampedSchema

AmountStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]


class PaymentBase(BaseModel):
    """Shared fields for payment payloads."""

    model_config = ConfigDict(extra="forbid")

    member_id: int = Field(gt=0)
    amount: Decimal = Field(gt=Decimal("0"))
    payment_date: date
    next_due_date: Optional[date] = None
    status: PaymentStatus = PaymentStatus.PAID
    method: PaymentMethod = PaymentMethod.CASH
    notes: Optional[str] = Field(default=None, max_length=500)


class PaymentCreate(PaymentBase):
    """Payload for creating a payment."""

    receipt_number: Optional[str] = Field(default=None, max_length=200)
    membership_plan: Optional[str] = Field(default=None, max_length=100)
    interval_days: Optional[int] = Field(default=None, gt=0, le=3650)


class PaymentUpdate(BaseModel):
    """Payload for updating payment details."""

    model_config = ConfigDict(extra="forbid")

    amount: Optional[Decimal] = Field(default=None, gt=Decimal("0"))
    payment_date: Optional[date] = None
    next_due_date: Optional[date] = None
    status: Optional[PaymentStatus] = None
    method: Optional[PaymentMethod] = None
    receipt_number: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=500)
    refunded_at: Optional[datetime] = None


class PaymentResponse(TimestampedSchema, PaymentBase):
    """Payment payload returned in responses."""

    id: int
    receipt_number: Optional[str] = None
    refunded_at: Optional[datetime] = None
    reminder_status: ReminderStatus | None = None
    reminder_attempt_count: int = Field(default=0, ge=0)
    reminder_last_attempt_at: Optional[datetime] = None
    reminder_next_scheduled_at: Optional[datetime] = None


class PaymentSummary(BaseModel):
    """Aggregated payment metrics for dashboard views."""

    model_config = ConfigDict(extra="forbid")

    total: int = 0
    revenue: float = 0.0
    average_ticket: float = 0.0
    outstanding: float = 0.0
    by_status: dict[str, float] = Field(default_factory=dict)


class PaymentListResponse(BaseModel):
    """Paginated list of payments."""

    model_config = ConfigDict(extra="forbid")

    data: list[PaymentResponse]
    meta: PaginationMeta
    summary: PaymentSummary = Field(default_factory=PaymentSummary)

    @computed_field(return_type=list[PaymentResponse])
    @property
    def payments(self) -> list[PaymentResponse]:
        return self.data


class PaymentSearchFilters(BaseModel):
    """Filtering options for listing payments."""

    model_config = ConfigDict(extra="forbid")

    status: Optional[PaymentStatus] = None
    method: Optional[PaymentMethod] = None
    member_id: Optional[int] = Field(default=None, gt=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=200)
