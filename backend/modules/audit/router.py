from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.pagination import Page, Paging, paginate
from backend.core.security import require_admin

from .models import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(require_admin)])


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    staff_name: str
    action: str
    entity: str
    entity_id: Optional[int]
    summary: str
    at: datetime


@router.get("", response_model=Page[AuditOut])
def list_audit(paging: Paging, entity: Optional[str] = None, staff: Optional[str] = None, db: Session = Depends(get_db)) -> Page[AuditOut]:
    stmt = select(AuditLog).order_by(AuditLog.at.desc(), AuditLog.id.desc())
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if staff:
        stmt = stmt.where(AuditLog.staff_name == staff)
    rows, total = paginate(db, stmt, paging)
    return Page(items=[r[0] for r in rows], total=total, page=paging.page, size=paging.size)
