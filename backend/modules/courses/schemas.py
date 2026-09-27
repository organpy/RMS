from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    schedule: Optional[str] = Field(default=None, max_length=200)
    capacity: Optional[int] = Field(default=None, ge=1, le=10000)


class GroupOut(GroupIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    member_count: int = 0


class CourseIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)


class CourseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    archived: Optional[bool] = None


class CourseOut(CourseIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    archived: bool = False
    member_count: int = 0
    groups: list[GroupOut] = []
