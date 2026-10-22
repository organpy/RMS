from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

Status = Literal["active", "due", "overdue", "archived"]


class MemberIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=2000)
    guardian_name: Optional[str] = Field(default=None, max_length=120)
    guardian_phone: Optional[str] = Field(default=None, max_length=40)
    guardian_email: Optional[EmailStr] = None
    course_id: Optional[int] = None
    group_id: Optional[int] = None
    plan_id: Optional[int] = None
    joined_on: Optional[date] = None


class MemberUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=2000)
    guardian_name: Optional[str] = Field(default=None, max_length=120)
    guardian_phone: Optional[str] = Field(default=None, max_length=40)
    guardian_email: Optional[EmailStr] = None
    course_id: Optional[int] = None
    group_id: Optional[int] = None
    plan_id: Optional[int] = None
    joined_on: Optional[date] = None
    archived: Optional[bool] = None


class MemberOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    notes: Optional[str]
    guardian_name: Optional[str]
    guardian_phone: Optional[str]
    guardian_email: Optional[str]
    course_id: Optional[int]
    course_name: Optional[str]
    group_id: Optional[int]
    group_name: Optional[str]
    plan_id: Optional[int]
    plan_name: Optional[str]
    plan_price: Optional[Decimal]
    joined_on: date
    paid_until: Optional[date]
    status: Status
