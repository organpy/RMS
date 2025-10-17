"""Pydantic schemas for dashboard endpoints."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.models.payment import PaymentStatus


class DashboardWidgetsResponse(BaseModel):
    """Payload returned by the dashboard widgets endpoint."""

    model_config = ConfigDict(extra="forbid")

    active_members: int = Field(ge=0)
    inactive_members: int = Field(ge=0)
    suspended_members: int = Field(ge=0)
    due_today: int = Field(ge=0)
    overdue: int = Field(ge=0)
    overdue_inactive: int = Field(ge=0)


class DashboardWidgetsQuery(BaseModel):
    """Optional query parameters accepted by the widgets endpoint."""

    model_config = ConfigDict(extra="forbid")

    reference_date: Optional[date] = None


class DashboardAlertPayment(BaseModel):
    """Compact representation of a payment alert."""

    model_config = ConfigDict(extra="forbid")

    payment_id: int = Field(gt=0)
    member_id: int = Field(gt=0)
    member_name: str = Field(min_length=1)
    next_due_date: date
    amount: Decimal = Field(ge=Decimal("0"))
    status: PaymentStatus


class DashboardAlertsResponse(BaseModel):
    """Payload returned by the dashboard alerts endpoint."""

    model_config = ConfigDict(extra="forbid")

    due_today: list[DashboardAlertPayment] = Field(default_factory=list)
    overdue: list[DashboardAlertPayment] = Field(default_factory=list)


class DashboardAlertsQuery(BaseModel):
    """Optional query parameters accepted by the alerts endpoint."""

    model_config = ConfigDict(extra="forbid")

    reference_date: Optional[date] = None
    limit: int = Field(default=5, ge=1, le=25)
