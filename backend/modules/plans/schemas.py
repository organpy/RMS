from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PlanIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    interval_days: int = Field(ge=1, le=3660)
    course_id: Optional[int] = None


class PlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    interval_days: Optional[int] = Field(default=None, ge=1, le=3660)
    course_id: Optional[int] = None
    archived: Optional[bool] = None


class PlanOut(PlanIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_name: Optional[str] = None
    archived: bool = False
