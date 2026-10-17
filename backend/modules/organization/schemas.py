from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

HEX = r"^#[0-9a-fA-F]{6}$"


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    has_logo: bool = False
    primary_color: str
    currency: str
    locale: str
    grace_days: int
    reminder_template: str
    invoice_prefix: str
    auto_remind: bool
    remind_before_days: int
    remind_after_days: int


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=40)
    address: Optional[str] = Field(default=None, max_length=500)
    tax_id: Optional[str] = Field(default=None, max_length=60)
    primary_color: Optional[str] = Field(default=None, pattern=HEX)
    currency: Optional[str] = Field(default=None, pattern=r"^[A-Z]{3}$")
    locale: Optional[str] = Field(default=None, pattern=r"^[a-z]{2}(-[A-Z]{2})?$")
    grace_days: Optional[int] = Field(default=None, ge=0, le=90)
    reminder_template: Optional[str] = Field(default=None, min_length=1, max_length=1000)
    invoice_prefix: Optional[str] = Field(default=None, pattern=r"^[A-Z0-9]{1,10}$")
    auto_remind: Optional[bool] = None
    remind_before_days: Optional[int] = Field(default=None, ge=0, le=30)
    remind_after_days: Optional[int] = Field(default=None, ge=0, le=60)
