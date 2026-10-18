from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.core.pagination import Page

Method = Literal["cash", "card", "transfer", "other"]


class PaymentIn(BaseModel):
    member_id: int
    plan_id: Optional[int] = None
    amount: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    method: Method = "cash"
    paid_on: Optional[date] = None
    description: Optional[str] = Field(default=None, max_length=200)
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    email_invoice: bool = False

    @model_validator(mode="after")
    def _period(self):
        if (self.period_start is None) != (self.period_end is None):
            raise ValueError("Provide both period_start and period_end, or neither")
        if self.period_start and self.period_end < self.period_start:
            raise ValueError("period_end must be on or after period_start")
        return self


class PaymentUpdate(BaseModel):
    method: Optional[Method] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    member_name: str
    invoice_number: str
    description: str
    amount: Decimal
    method: Method
    paid_on: date
    period_start: Optional[date]
    period_end: Optional[date]
    notes: Optional[str]
    refunded_at: Optional[datetime]
    invoice_email: Optional[Literal["sent", "failed"]] = None  # set when email_invoice was requested


class PaymentPage(Page[PaymentOut]):
    amount_total: Decimal
