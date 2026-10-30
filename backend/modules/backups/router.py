from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from backend.core.db import get_db, session_scope
from backend.core.security import require_admin
from backend.modules.audit.service import audit
from backend.modules.organization.service import get_org

from . import service

router = APIRouter(prefix="/backups", tags=["backups"], dependencies=[Depends(require_admin)])


class BackupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    filename: str
    size: int
    kind: str
    created_at: datetime


class Schedule(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    backup_enabled: bool
    backup_cadence: Literal["daily", "weekly"]
    backup_keep: int = Field(ge=1, le=100)
    backup_last_at: Optional[datetime] = None


def _log(staff, action: str, filename: str) -> None:
    with session_scope() as db:
        audit(db, staff, action, "backup", None, filename)


@router.get("", response_model=list[BackupOut])
def list_backups() -> list:
    return service.list_backups()


@router.post("", response_model=BackupOut, status_code=201)
def create_backup(staff=Depends(require_admin)):
    backup = service.create("manual")
    _log(staff, "created", backup.filename)
    return backup


@router.get("/schedule", response_model=Schedule)
def read_schedule(db: Session = Depends(get_db)):
    return get_org(db)


@router.put("/schedule", response_model=Schedule)
def update_schedule(body: Schedule, db: Session = Depends(get_db), staff=Depends(require_admin)):
    org = get_org(db)
    org.backup_enabled, org.backup_cadence, org.backup_keep = body.backup_enabled, body.backup_cadence, body.backup_keep
    audit(db, staff, "updated", "backup", None, f"schedule: {'on' if body.backup_enabled else 'off'}, {body.backup_cadence}, keep {body.backup_keep}")
    db.commit()
    return org


@router.post("/restore", status_code=204)
def restore_backup(file: UploadFile, staff=Depends(require_admin)) -> None:
    service.restore(file.file)
    _log(staff, "restored", file.filename or "uploaded backup")  # written to the restored database


@router.get("/{filename}")
def download(filename: str) -> FileResponse:
    return FileResponse(service.resolve(filename), media_type="application/zip", filename=filename)


@router.delete("/{filename}", status_code=204)
def delete(filename: str, staff=Depends(require_admin)) -> None:
    service.resolve(filename).unlink()
    _log(staff, "deleted", filename)
