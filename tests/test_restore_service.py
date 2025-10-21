import tempfile
from io import BytesIO
from zipfile import ZipFile

import pytest

from backend.services.restore_service import RestoreService


class DummySettings:
    def __init__(self):
        self.scheduled_backup_dir = "data/backups"
        # point to a non-existent DB for safety; dry-run avoids swap
        self.database_url = "sqlite:///./data/test_app.db"


def build_test_archive() -> bytes:
    buf = BytesIO()
    with ZipFile(buf, "w") as zf:
        # minimal CSVs with headers and one row
        zf.writestr("business.csv", "id,name,logo_path,primary_color,secondary_color,language,currency,created_at,updated_at\n1,TestBiz,,#fff,,en,USD,2020-01-01T00:00:00,2020-01-01T00:00:00\n")
        zf.writestr("classes.csv", "id,business_id,name,description,start_date,end_date,grouping_type,created_at,updated_at\n")
        zf.writestr("groups.csv", "id,class_id,name,description,created_at,updated_at\n")
        zf.writestr("members.csv", "id,business_id,class_id,group_id,first_name,last_name,email,phone_number,status,joined_at,archived_at,created_at,updated_at\n")
        zf.writestr("payments.csv", "id,member_id,amount,payment_date,next_due_date,status,method,receipt_number,notes,refunded_at,created_at,updated_at\n")
        zf.writestr("receipts.csv", "id,payment_id,file_path,created_at,updated_at\n")
    return buf.getvalue()


def test_validate_archive(tmp_path):
    data = build_test_archive()
    p = tmp_path / "test.zip"
    p.write_bytes(data)

    service = RestoreService(session=None, settings=DummySettings())
    res = service.validate_archive(p)
    assert res.ok, f"Expected validation to pass, got: {res.details}"


def test_restore_dry_run():
    data = build_test_archive()
    service = RestoreService(session=None, settings=DummySettings())
    # dry-run should validate and not attempt swap
    res = service.restore_from_archive(data, dry_run=True)
    assert res.ok
    assert "Dry-run" in res.details or "validated" in res.details
