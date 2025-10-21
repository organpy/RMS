from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.concurrency import run_in_threadpool

from backend.database import get_db
from backend.services.backup_service import BackupService

router = APIRouter(prefix="/api/backups", tags=["Backups"])


def get_backup_service(db: Session = Depends(get_db)) -> BackupService:
    return BackupService(db)


@router.get("")
async def list_backups(service: BackupService = Depends(get_backup_service)):
    backups = await run_in_threadpool(service.list_backups)
    # Return minimal dicts
    return [
        {"id": b.id, "path": b.path, "size": b.size, "status": b.status, "created_at": b.created_at}
        for b in backups
    ]


@router.delete("/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup(backup_id: int, service: BackupService = Depends(get_backup_service)):
    ok = await run_in_threadpool(service.delete_backup, backup_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Backup not found")
    return None
