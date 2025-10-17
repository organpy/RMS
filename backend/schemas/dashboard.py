"""Pydantic schemas for dashboard endpoints."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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
