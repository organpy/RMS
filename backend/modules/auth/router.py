from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.errors import Conflict, Unauthorized
from backend.core.security import clear_session, current_staff, hash_password, set_session, throttle, verify_password
from backend.modules.organization.models import Organization
from backend.modules.staff.models import Staff
from backend.modules.staff.schemas import Password, StaffOut, Username

router = APIRouter(prefix="/auth", tags=["auth"])


class SetupIn(BaseModel):
    organization: str = Field(min_length=1, max_length=200)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    name: str = Field(min_length=1, max_length=120)
    username: str = Username
    password: str = Password


class PasswordIn(BaseModel):
    current: str = Field(max_length=128)
    new: str = Password


class LoginIn(BaseModel):
    username: str = Field(max_length=60)
    password: str = Field(max_length=128)


def _needs_setup(db: Session) -> bool:
    return not db.scalar(select(func.count()).select_from(Staff))


@router.get("/status")
def status(db: Session = Depends(get_db)) -> dict[str, bool]:
    return {"setup_required": _needs_setup(db)}


@router.post("/setup", response_model=StaffOut, status_code=201)
def setup(body: SetupIn, response: Response, db: Session = Depends(get_db)) -> Staff:
    if not _needs_setup(db):
        raise Conflict("Setup already completed")
    db.add(Organization(name=body.organization, currency=body.currency))
    admin = Staff(username=body.username.lower(), name=body.name, password_hash=hash_password(body.password), role="admin")
    db.add(admin)
    db.commit()
    set_session(response, admin.id)
    return admin


@router.post("/login", response_model=StaffOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> Staff:
    username = body.username.strip().lower()
    key = f"{request.client.host if request.client else '-'}:{username}"
    throttle.check(key)
    staff = db.scalar(select(Staff).where(Staff.username == username))
    if staff is None or not staff.active or not verify_password(body.password, staff.password_hash):
        throttle.fail(key)
        raise Unauthorized("Invalid username or password")
    throttle.reset(key)
    staff.last_login_at = datetime.now(timezone.utc)
    db.commit()
    set_session(response, staff.id)
    return staff


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    clear_session(response)


@router.get("/me", response_model=StaffOut)
def me(staff: Staff = Depends(current_staff)) -> Staff:
    return staff


@router.post("/password", status_code=204)
def change_password(body: PasswordIn, db: Session = Depends(get_db), staff: Staff = Depends(current_staff)) -> None:
    if not verify_password(body.current, staff.password_hash):
        raise Unauthorized("Current password is incorrect")
    staff.password_hash = hash_password(body.new)
    db.commit()
