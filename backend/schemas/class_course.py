"""Class/course related schemas."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from .common import GroupSummary, PaginationMeta, TimestampedSchema

NameStr = Annotated[str, StringConstraints(min_length=1, max_length=200)]
GroupingStr = Annotated[str, StringConstraints(min_length=1, max_length=100)]
PlanNameStr = Annotated[str, StringConstraints(min_length=1, max_length=120)]


class MembershipPlanBase(BaseModel):
    """Predefined membership plan for a class."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: PlanNameStr
    interval_days: int = Field(gt=0, le=3650)


class ClassBase(BaseModel):
    """Shared class fields."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: NameStr
    description: Optional[str] = Field(default=None, max_length=1000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    grouping_type: Optional[GroupingStr] = None
    membership_plans: list[MembershipPlanBase] = Field(default_factory=list)


class ClassCreate(ClassBase):
    """Payload for creating a class/course."""

    model_config = ConfigDict(extra="forbid")

    business_id: int = Field(gt=0)


class ClassUpdate(BaseModel):
    """Payload for updating a class/course."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Optional[NameStr] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    grouping_type: Optional[GroupingStr] = None
    membership_plans: Optional[list[MembershipPlanBase]] = None


class ClassResponse(TimestampedSchema, ClassBase):
    """Class payload returned from the API."""

    id: int
    business_id: int
    member_count: int = 0
    groups: list[GroupSummary] = []


class ClassListResponse(BaseModel):
    """Paginated list of classes."""

    model_config = ConfigDict(extra="forbid")

    data: list[ClassResponse]
    meta: PaginationMeta
