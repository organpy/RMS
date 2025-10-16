"""Group-related schemas."""

from __future__ import annotations

from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from .common import PaginationMeta, TimestampedSchema

NameStr = Annotated[str, StringConstraints(min_length=1, max_length=150)]


class GroupBase(BaseModel):
    """Shared group fields."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: NameStr
    description: Optional[str] = Field(default=None, max_length=1000)


class GroupCreate(GroupBase):
    """Payload for creating groups."""

    model_config = ConfigDict(extra="forbid")

    class_id: int = Field(gt=0)


class GroupUpdate(BaseModel):
    """Payload for updating groups."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Optional[NameStr] = None
    description: Optional[str] = Field(default=None, max_length=1000)


class GroupResponse(TimestampedSchema, GroupBase):
    """Group payload returned from the API."""

    id: int
    class_id: int


class GroupListResponse(BaseModel):
    """Paginated list of groups."""

    model_config = ConfigDict(extra="forbid")

    data: list[GroupResponse]
    meta: PaginationMeta
