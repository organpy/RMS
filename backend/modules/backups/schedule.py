"""Scheduled backups according to organization settings; run by the background jobs loop."""

from datetime import datetime, timedelta, timezone

from backend.core.db import session_scope
from backend.modules.organization.models import Organization

from . import service

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
