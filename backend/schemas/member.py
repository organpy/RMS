"""Member-centric Pydantic schemas."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from backend.models.member import MemberStatus

from .common import ClassSummary, GroupSummary, PaginationMeta, TimestampedSchema

NameStr = Annotated[str, StringConstraints(min_length=1, max_length=100)]
PhoneStr = Annotated[str, StringConstraints(min_length=7, max_length=20)]
SearchStr = Annotated[str, StringConstraints(min_length=1, max_length=100)]


class MemberBase(BaseModel):
    """Shared member attributes."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    first_name: NameStr
    last_name: NameStr
    phone_number: Optional[PhoneStr] = Field(default=None, description="E.164 or local format phone number")
    email: Optional[EmailStr] = None
    status: MemberStatus = Field(default=MemberStatus.ACTIVE)
    joined_at: Optional[date] = None


class MemberCreate(MemberBase):
    """Payload required to create a member."""

    model_config = ConfigDict(extra="forbid")

    business_id: int = Field(gt=0)
    class_id: Optional[int] = Field(default=None, gt=0)
    group_id: Optional[int] = Field(default=None, gt=0)


class MemberUpdate(BaseModel):
    """Payload used to update a member."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    first_name: Optional[NameStr] = None
    last_name: Optional[NameStr] = None
    phone_number: Optional[PhoneStr] = Field(default=None)
    email: Optional[EmailStr] = Field(default=None)
    status: Optional[MemberStatus] = None
    class_id: Optional[int] = Field(default=None, gt=0)
    group_id: Optional[int] = Field(default=None, gt=0)
    joined_at: Optional[date] = None


class MemberStatusUpdate(BaseModel):
    """Dedicated payload for quick status toggles."""

    model_config = ConfigDict(extra="forbid")

    status: MemberStatus


class MemberResponse(TimestampedSchema, MemberBase):
    """Member payload returned to consumers."""

    id: int
    business_id: int
    class_id: Optional[int] = None
    group_id: Optional[int] = None
    class_info: Optional[ClassSummary] = None
    group_info: Optional[GroupSummary] = None


class MemberListResponse(BaseModel):
    """Paginated list of members."""

    model_config = ConfigDict(extra="forbid")

    data: list[MemberResponse]
    meta: PaginationMeta


class MemberSearchFilters(BaseModel):
    """Strongly-typed member list filters used by dependency injection."""

    status: Optional[MemberStatus] = None
    class_id: Optional[int] = Field(default=None, gt=0)
    group_id: Optional[int] = Field(default=None, gt=0)
    search: Optional[SearchStr] = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=25, ge=1, le=100)

    model_config = ConfigDict(extra="forbid")
