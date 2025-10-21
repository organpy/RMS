import os
import time
from datetime import datetime, timedelta, timezone
from io import BytesIO
from zipfile import ZipFile

import pytest

from backend.services.settings_service import SettingsService
from backend.services.backup_service import BackupService
from backend.crud.backup import BackupCRUD


def build_test_archive_bytes():
    buf = BytesIO()
    with ZipFile(buf, 'w') as zf:
        zf.writestr('business.csv', 'id,name\n1,Test\n')
    return buf.getvalue()


def test_generate_and_persist_backup(db_session, tmp_path):
    # Use a temp backups dir
    settings = None
    service = SettingsService(db_session, settings=settings, assets_dir=str(tmp_path))

    # Generate archive (this will attempt to persist to backups_dir from settings; override)
    # Patch the backups_dir to tmp_path/backups
    service.backups_dir = tmp_path / 'backups'
    archive = service.generate_backup_archive()

    # File should exist on disk
    file_path = service.backups_dir / archive.filename
    assert file_path.exists()

    # There should be a DB record
    crud = BackupCRUD(db_session)
    recs = crud.list_all()
    assert any(r.path == str(file_path) for r in recs)


def test_cleanup_removes_old_backups(db_session, tmp_path):
    # Prepare backups dir
    backups_dir = tmp_path / 'backups'
    backups_dir.mkdir(parents=True)

    # Create two fake backup files
    recent = backups_dir / 'recent.zip'
    recent.write_bytes(b'recent')
    old = backups_dir / 'old.zip'
    old.write_bytes(b'old')

    # Insert DB records for them with timestamps
    from backend.models import Backup

    b1 = Backup(path=str(recent), size=recent.stat().st_size, status='completed')
    b2 = Backup(path=str(old), size=old.stat().st_size, status='completed')
    # set created_at manually
    past = datetime.now(timezone.utc) - timedelta(days=90)
    b2.created_at = past
    db_session.add_all([b1, b2])
    db_session.commit()

    svc = BackupService(db_session)
    # Run cleanup older than 30 days
    removed = svc.cleanup_older_than(30)
    assert removed >= 1
    # old file should be removed
    assert not old.exists()
    # DB should not contain old record
    recs = svc.list_backups()
    assert all(r.path != str(old) for r in recs)
