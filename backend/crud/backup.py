from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models import Backup


class BackupCRUD:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, payload: dict) -> Backup:
        backup = Backup(**payload)
        self.session.add(backup)
        self.session.commit()
        self.session.refresh(backup)
        return backup

    def list_all(self) -> list[Backup]:
        stmt = select(Backup).order_by(Backup.created_at.desc())
        return self.session.execute(stmt).scalars().all()

    def get(self, backup_id: int) -> Optional[Backup]:
        stmt = select(Backup).where(Backup.id == backup_id)
        return self.session.execute(stmt).scalars().first()

    def delete(self, backup: Backup) -> None:
        self.session.delete(backup)
        self.session.commit()


__all__ = ["BackupCRUD"]
