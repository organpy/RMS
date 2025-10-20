"""Background worker that executes automated backups on a cadence."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from backend.config import get_settings
from backend.database import SessionLocal
from backend.schemas.settings import BackupCadence
from backend.services.settings_service import SettingsService

logger = logging.getLogger(__name__)


class BackupScheduler:
    """Periodically generates scheduled backups based on business settings."""

    def __init__(self, poll_seconds: Optional[int] = None) -> None:
        settings = get_settings()
        self._poll_seconds = poll_seconds or settings.backup_scheduler_poll_seconds
        self._backups_dir = Path(settings.scheduled_backup_dir)
        self._stop_event: asyncio.Event | None = None
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._run_loop(), name="scheduled-backup-loop")

    async def stop(self) -> None:
        if not self._task:
            return
        if self._stop_event and not self._stop_event.is_set():
            self._stop_event.set()
        try:
            await self._task
        finally:
            self._task = None
            self._stop_event = None

    async def _run_loop(self) -> None:
        assert self._stop_event is not None
        while True:
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._poll_seconds)
            except asyncio.TimeoutError:
                await self._run_once()
                continue
            break

    async def _run_once(self) -> None:
        await asyncio.to_thread(self._execute_once)

    def _execute_once(self) -> None:
        session = SessionLocal()
        try:
            service = SettingsService(session)
            business = service.get_business()
            if not business.backup_scheduler_enabled:
                return

            cadence = self._to_cadence_enum(business.backup_cadence)
            if cadence is None:
                return

            now = datetime.now(timezone.utc)
            reference = business.backup_last_run_at or now
            next_run_at = business.backup_next_run_at or service.calculate_next_run(reference, cadence)
            if next_run_at is None or next_run_at > now:
                if next_run_at and business.backup_next_run_at != next_run_at:
                    business.backup_next_run_at = next_run_at
                    session.add(business)
                    session.commit()
                return

            archive = service.generate_backup_archive()
            self._backups_dir.mkdir(parents=True, exist_ok=True)
            file_path = self._backups_dir / archive.filename
            file_path.write_bytes(archive.content)

            # Persist metadata and enforce retention.
            updated = service.finalize_scheduled_backup(archive.generated_at, cadence)
            retention = (updated.backup_retention_count or business.backup_retention_count or 1)
            service.prune_backup_archives(retention)
        except Exception:  # pragma: no cover - captured for observability
            logger.exception("Scheduled backup execution failed")
        finally:
            session.close()

    @staticmethod
    def _to_cadence_enum(value: Optional[str]) -> Optional[BackupCadence]:
        if value is None:
            return None
        try:
            return BackupCadence(value)
        except ValueError:
            logger.warning("Unknown backup cadence value encountered: %s", value)
            return None

backup_scheduler = BackupScheduler()
