"""Unit tests covering the settings domain service."""

from __future__ import annotations

from datetime import date
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pytest

from backend.config import get_settings
from backend.exceptions import ValidationError
from backend.models import Business, ClassCourse, Group, Member, Payment, PaymentMethod, PaymentStatus, Receipt
from backend.schemas.settings import BackupCadence, BackupScheduleUpdate
from backend.services.settings_service import SettingsService


@pytest.fixture
def service(db_session, tmp_path):
    return SettingsService(db_session, assets_dir=tmp_path)


def test_get_business_creates_default_when_missing(service, db_session):
    assert db_session.query(Business).count() == 0

    business = service.get_business()

    assert business.id is not None
    assert business.name == get_settings().app_name
    assert business.backup_scheduler_enabled is False
    assert business.backup_retention_count == 5
    assert db_session.query(Business).count() == 1


def test_update_business_applies_changes(service):
    service.get_business()

    updated = service.update_business(
        {
            "name": "Northwind Fitness",
            "primary_color": "#112233",
            "secondary_color": "#445566",
            "language": "FR",
            "currency": "EUR",
        }
    )

    assert updated.name == "Northwind Fitness"
    assert updated.primary_color == "#112233"
    assert updated.secondary_color == "#445566"
    assert updated.language == "FR"
    assert updated.currency == "EUR"


def test_store_logo_writes_file_and_updates_business(service, tmp_path):
    service.get_business()

    payload = b"fake-binary"
    business = service.store_logo(filename="brand.png", content=payload)

    assert business.logo_path is not None
    logo_path = Path(business.logo_path)
    assert logo_path.exists()
    assert logo_path.read_bytes() == payload
    assert logo_path.parent == tmp_path


def test_store_logo_rejects_invalid_extension(service):
    service.get_business()

    with pytest.raises(ValidationError):
        service.store_logo(filename="brand.txt", content=b"invalid")


def test_update_backup_schedule_sets_next_run(service):
    business = service.get_business()
    assert business.backup_scheduler_enabled is False

    result = service.update_backup_schedule(
        BackupScheduleUpdate(enabled=True, cadence=BackupCadence.DAILY, retention_count=4)
    )

    assert result.backup_scheduler_enabled is True
    assert result.backup_cadence == BackupCadence.DAILY.value
    assert result.backup_retention_count == 4
    assert result.backup_next_run_at is not None


def test_finalize_scheduled_backup_updates_metadata(service):
    service.update_backup_schedule(BackupScheduleUpdate(enabled=True, cadence=BackupCadence.WEEKLY, retention_count=2))
    run_time = service.clock()

    result = service.finalize_scheduled_backup(run_time, BackupCadence.WEEKLY)

    assert result.backup_last_run_at == run_time
    assert result.backup_next_run_at is not None


def test_generate_backup_configuration_returns_expected_payload(service):
    config = service.generate_backup_configuration()

    assert config.business.name == get_settings().app_name
    assert config.environment["app_name"] == get_settings().app_name
    assert "database_url" in config.environment
    assert "branding_assets_dir" in config.environment
    assert config.environment["branding_assets_dir"] == str(service.assets_dir)


def test_generate_backup_archive_includes_core_entities(service, db_session):
    business = service.get_business()

    class_course = ClassCourse(business_id=business.id, name="Karate Fundamentals")
    db_session.add(class_course)
    db_session.flush()

    group = Group(class_id=class_course.id, name="Beginners")
    db_session.add(group)
    db_session.flush()

    member = Member(
        business_id=business.id,
        class_id=class_course.id,
        group_id=group.id,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        phone_number="555-0101",
    )
    db_session.add(member)
    db_session.flush()

    payment = Payment(
        member_id=member.id,
        amount=125.50,
        payment_date=date(2025, 1, 10),
        status=PaymentStatus.PAID,
        method=PaymentMethod.CASH,
        receipt_number="R-001",
    )
    db_session.add(payment)
    db_session.flush()

    receipt = Receipt(payment_id=payment.id, file_path="receipts/R-001.pdf")
    db_session.add(receipt)
    db_session.commit()

    archive = service.generate_backup_archive()

    assert archive.filename.endswith(".zip")
    assert archive.content

    with ZipFile(BytesIO(archive.content)) as zip_file:
        entries = set(zip_file.namelist())
        assert {
            "business.csv",
            "classes.csv",
            "groups.csv",
            "members.csv",
            "payments.csv",
            "receipts.csv",
        }.issubset(entries)

        members_csv = zip_file.read("members.csv").decode("utf-8-sig")
        assert "Ada" in members_csv

        payments_csv = zip_file.read("payments.csv").decode("utf-8-sig")
        assert "R-001" in payments_csv

        business_csv = zip_file.read("business.csv").decode("utf-8-sig")
        assert business.name in business_csv