from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.core.pagination import Page

Method = Literal["cash", "card", "transfer", "other"]


class ExpenseIn(BaseModel):
    spent_on: Optional[date] = None
    category: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    method: Method = "cash"


class ExpenseUpdate(BaseModel):
    spent_on: Optional[date] = None
    category: Optional[str] = Field(default=None, min_length=1, max_length=60)
    description: Optional[str] = Field(default=None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    method: Optional[Method] = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    spent_on: date
    category: str
    description: str
    amount: Decimal
    method: Method
    staff_name: Optional[str] = None
    created_at: datetime


class ExpensePage(Page[ExpenseOut]):
    amount_total: Decimal
