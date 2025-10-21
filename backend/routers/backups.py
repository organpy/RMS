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


@router.post("/cleanup")
async def run_cleanup(service: BackupService = Depends(get_backup_service)):
    """Run cleanup using the configured retention days from the Business settings.

    Returns the number of backups removed.
    """
    from backend.database import SessionLocal
    from backend.services.settings_service import SettingsService

    # Run in threadpool to avoid blocking event loop
    def _work():
        session = SessionLocal()
        try:
            settings_service = SettingsService(session)
            business = settings_service.get_business()
            days = getattr(business, "backup_retention_days", 30) or 30
            svc = BackupService(session)
            return svc.cleanup_older_than(days)
        finally:
            session.close()

    removed = await run_in_threadpool(_work)
    return {"removed": removed}
