from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.errors import AppError, Conflict, NotFound
from backend.core.security import hash_password, require_admin
from backend.modules.audit.service import audit

from .models import Staff
from .schemas import StaffCreate, StaffOut, StaffUpdate

router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("", response_model=list[StaffOut])
def list_staff(db: Session = Depends(get_db), _=Depends(require_admin)) -> list[Staff]:
    return list(db.scalars(select(Staff).order_by(Staff.name)))


@router.post("", response_model=StaffOut, status_code=201)
def create_staff(body: StaffCreate, db: Session = Depends(get_db), me: Staff = Depends(require_admin)) -> Staff:
    username = body.username.lower()
    if db.scalar(select(Staff.id).where(Staff.username == username)):
        raise Conflict("Username already taken")
    staff = Staff(username=username, name=body.name, role=body.role, password_hash=hash_password(body.password))
    db.add(staff)
    db.flush()
    audit(db, me, "created", "staff", staff.id, f"{staff.name} ({staff.role})")
    db.commit()
    return staff


@router.patch("/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: int, body: StaffUpdate, db: Session = Depends(get_db), me: Staff = Depends(require_admin)
) -> Staff:
    staff = db.get(Staff, staff_id) or _missing()
    demoting = body.role == "staff" or body.active is False
    if demoting and staff.id == me.id:
        raise AppError("You cannot demote or deactivate yourself")
    changed = [f for f, v in (('name', body.name), ('role', body.role), ('active', body.active), ('password', body.password)) if v not in (None, '')]
    if body.name is not None:
        staff.name = body.name
    if body.role is not None:
        staff.role = body.role
    if body.active is not None:
        staff.active = body.active
    if body.password:
        staff.password_hash = hash_password(body.password)
    db.flush()
    admins = db.scalar(select(func.count()).where(Staff.role == "admin", Staff.active.is_(True)))
    if not admins:
        raise AppError("At least one active admin is required")
    audit(db, me, "updated", "staff", staff.id, f"{staff.name} ({', '.join(changed)})")
    db.commit()
    return staff


def _missing():
    raise NotFound("Staff member not found")
