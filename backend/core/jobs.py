"""Background thread that runs periodic jobs (scheduled backups, automatic reminders)."""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable

log = logging.getLogger(__name__)


class Jobs:
    def __init__(self, *jobs: Callable[[], object], interval: float = 900) -> None:
        self.jobs = jobs
        self.interval = interval
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="rms-jobs", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def run_once(self) -> None:
        for job in self.jobs:
            try:
                job()
            except Exception:  # pragma: no cover - logged for operators
                log.exception("Background job %s failed", job.__qualname__)

    def _loop(self) -> None:
        while not self._stop.wait(self.interval):
            self.run_once()
