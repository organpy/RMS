from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.security import require_admin
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


@router.get("", response_model=list[BackupOut])
def list_backups() -> list:
    return service.list_backups()


@router.post("", response_model=BackupOut, status_code=201)
def create_backup():
    return service.create("manual")


@router.get("/schedule", response_model=Schedule)
def read_schedule(db: Session = Depends(get_db)):
    return get_org(db)


@router.put("/schedule", response_model=Schedule)
def update_schedule(body: Schedule, db: Session = Depends(get_db)):
    org = get_org(db)
    org.backup_enabled, org.backup_cadence, org.backup_keep = body.backup_enabled, body.backup_cadence, body.backup_keep
    db.commit()
    return org


@router.post("/restore", status_code=204)
def restore_backup(file: UploadFile) -> None:
    service.restore(file.file)


@router.get("/{filename}")
def download(filename: str) -> FileResponse:
    return FileResponse(service.resolve(filename), media_type="application/zip", filename=filename)


@router.delete("/{filename}", status_code=204)
def delete(filename: str) -> None:
    service.resolve(filename).unlink()
