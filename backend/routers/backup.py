"""Routes for backup and restore operations (Phase 9).

Implements a /api/backup/restore endpoint that accepts an uploaded zip and supports a dry-run validation.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, Query, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.restore_service import RestoreService

router = APIRouter(prefix="/api/backup", tags=["Backups"])


def get_restore_service(db: Session = Depends(get_db)) -> RestoreService:
    return RestoreService(db)


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    dry_run: bool = Query(True),
    service: RestoreService = Depends(get_restore_service),
):
    """Accept a zip archive upload and either validate (dry-run) or perform the restore.

    - dry_run=True : validate archive and simulate steps without changing DB
    - dry_run=False: perform restore (destructive) after validation
    """

    content = await file.read()
    # Run restore logic in threadpool because service uses blocking DB/FS operations
    result = await run_in_threadpool(service.restore_from_archive, content, dry_run=dry_run)
    if not result.ok:
        return {"ok": False, "details": result.details}
    return {"ok": True, "details": result.details}
