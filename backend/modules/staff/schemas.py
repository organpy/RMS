from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["admin", "staff"]
Username = Field(min_length=3, max_length=60, pattern=r"^[a-zA-Z0-9._-]+$")
Password = Field(min_length=8, max_length=128)


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    role: Role
    active: bool
    last_login_at: Optional[datetime] = None


class StaffCreate(BaseModel):
    username: str = Username
    name: str = Field(min_length=1, max_length=120)
    password: str = Password
    role: Role = "staff"


class StaffUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    role: Optional[Role] = None
    active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
