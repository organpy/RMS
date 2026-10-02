"""Background thread that takes scheduled backups according to organization settings."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone

from backend.core.db import session_scope
from backend.modules.organization.models import Organization

from . import service

log = logging.getLogger(__name__)
CADENCES = {"daily": timedelta(days=1), "weekly": timedelta(weeks=1)}


def run_due_backup(now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    with session_scope() as db:
        org = db.query(Organization).first()
        if org is None or not org.backup_enabled:
            return False
        last = org.backup_last_at
        if last is not None and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if last and now - last < CADENCES.get(org.backup_cadence, CADENCES["daily"]):
            return False
        keep = org.backup_keep
        org.backup_last_at = now
    service.create("scheduled")
    service.prune(keep)
    return True


class Scheduler:
    def __init__(self, interval: float = 900) -> None:
        self.interval = interval
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="rms-backups", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _loop(self) -> None:
        while not self._stop.wait(self.interval):
            try:
                run_due_backup()
            except Exception:  # pragma: no cover - logged for operators
                log.exception("Scheduled backup failed")


scheduler = Scheduler()
