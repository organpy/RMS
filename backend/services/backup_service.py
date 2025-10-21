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

    def cleanup_older_than(self, days: int) -> int:
        """Delete backups older than `days` days from disk and DB. Returns number removed."""
        from datetime import datetime, timezone, timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        removed = 0
        for b in self._crud.list_all():
            # b.created_at is naive or tz-aware depending on DB; compare as iso strings defensively
            try:
                created = b.created_at
                if created.tzinfo is None:
                    # assume UTC
                    created = created.replace(tzinfo=timezone.utc)
            except Exception:
                created = None

            if created is None or created < cutoff:
                try:
                    Path(b.path).unlink(missing_ok=True)
                except Exception:
                    logger.exception("Failed to remove backup file during cleanup: %s", b.path)
                try:
                    self._crud.delete(b)
                except Exception:
                    logger.exception("Failed to remove backup DB record during cleanup: %s", b.id)
                removed += 1

        return removed


__all__ = ["BackupService"]
