from __future__ import annotations

import logging
from pathlib import Path
from typing import List

from sqlalchemy.orm import Session

from backend.crud import BackupCRUD
from backend.models import Backup
from backend.config import get_settings

logger = logging.getLogger("backup")


class BackupService:
    def __init__(self, session: Session, *, settings=None) -> None:
        self.session = session
        self._crud = BackupCRUD(session)
        self.settings = settings or get_settings()
        self.backups_dir = Path(self.settings.scheduled_backup_dir)

    def list_backups(self) -> List[Backup]:
        return self._crud.list_all()

    def delete_backup(self, backup_id: int) -> bool:
        backup = self._crud.get(backup_id)
        if not backup:
            return False
        # Remove archive file safely
        try:
            Path(backup.path).unlink(missing_ok=True)
        except Exception as exc:
            logger.exception("Failed to delete backup file: %s", exc)
            # proceed to remove DB record anyway
        self._crud.delete(backup)
        return True


__all__ = ["BackupService"]
