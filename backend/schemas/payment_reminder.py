"""Schemas for payment reminder workflow."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from backend.models import ReminderAttemptResult, ReminderStatus


class PaymentReminderSummary(BaseModel):
    """High-level reminder status for a payment."""

    model_config = ConfigDict(extra="forbid")

    status: ReminderStatus
    attempt_count: int = Field(ge=0)
    last_attempt_at: datetime | None = None
    next_scheduled_at: datetime | None = None


class PaymentReminderHistoryEntry(BaseModel):
    """Represents a single reminder attempt."""

    model_config = ConfigDict(extra="forbid")

    attempted_at: datetime
    scheduled_for: datetime | None = None
    result: ReminderAttemptResult
    note: str | None = None


class PaymentReminderEnvelope(BaseModel):
    """Combined payload for summary and recent history."""

    model_config = ConfigDict(extra="forbid")

    summary: PaymentReminderSummary
    history: list[PaymentReminderHistoryEntry]


class QueuePaymentReminderRequest(BaseModel):
    """Payload when queueing a new reminder intent."""

    model_config = ConfigDict(extra="forbid")

    scheduled_for: datetime | None = None
    note: str | None = Field(default=None, max_length=500)


__all__ = [
    "PaymentReminderSummary",
    "PaymentReminderHistoryEntry",
    "PaymentReminderEnvelope",
    "QueuePaymentReminderRequest",
]
