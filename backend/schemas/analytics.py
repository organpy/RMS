"""Pydantic schemas for analytics endpoints."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class TimeSeriesPointSchema(BaseModel):
    """Time series data point with numeric value."""

    model_config = ConfigDict(extra="forbid")

    period: str
    total: Decimal = Field(ge=Decimal("0"))


class TimeSeriesResponse(BaseModel):
    """Generic wrapper for time-series analytics responses."""

    model_config = ConfigDict(extra="forbid")

    data: list[TimeSeriesPointSchema]


class TimeSeriesQuery(BaseModel):
    """Query parameters controlling the number of periods returned."""

    model_config = ConfigDict(extra="forbid")

    last_periods: int = Field(default=12, ge=1, le=60)


class YearlySeriesQuery(BaseModel):
    """Query parameters for yearly aggregations."""

    model_config = ConfigDict(extra="forbid")

    last_years: int = Field(default=5, ge=1, le=15)


class PaymentTrendPointSchema(BaseModel):
    """Breakdown of payment statuses for a given period."""

    model_config = ConfigDict(extra="forbid")

    period: str
    paid: int = Field(ge=0)
    unpaid: int = Field(ge=0)
    overdue: int = Field(ge=0)
    refunded: int = Field(ge=0)


class PaymentTrendResponse(BaseModel):
    """Response payload for payment trend analytics."""

    model_config = ConfigDict(extra="forbid")

    data: list[PaymentTrendPointSchema]


class PaymentTrendQuery(BaseModel):
    """Query parameters for payment trend series."""

    model_config = ConfigDict(extra="forbid")

    last_months: int = Field(default=6, ge=1, le=24)


class ClassPopularityEntrySchema(BaseModel):
    """Popularity entry describing member counts per class."""

    model_config = ConfigDict(extra="forbid")

    class_id: int
    class_name: str
    member_count: int = Field(ge=0)


class ClassPopularityResponse(BaseModel):
    """Response containing class popularity rankings."""

    model_config = ConfigDict(extra="forbid")

    data: list[ClassPopularityEntrySchema]


class ClassPopularityQuery(BaseModel):
    """Query parameters for class popularity rankings."""

    model_config = ConfigDict(extra="forbid")

    limit: int = Field(default=5, ge=1, le=25)
