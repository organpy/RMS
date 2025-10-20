"""Integration tests for the settings API endpoints."""

from __future__ import annotations

from datetime import date
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pytest

from backend.config import get_settings
from backend.models import (
    Business,
    ClassCourse,
    Group,
    Member,
    Payment,
    PaymentMethod,
    PaymentStatus,
    Receipt,
)
from backend.routers.settings import get_settings_service
from backend.services.settings_service import SettingsService


@pytest.fixture(autouse=True)
def override_settings_service(client, db_session, tmp_path):
    def _override():
        return SettingsService(db_session, assets_dir=tmp_path)

    client.app.dependency_overrides[get_settings_service] = _override
    yield
    client.app.dependency_overrides.pop(get_settings_service, None)


def test_read_settings_initializes_default_business(client, db_session):
    assert db_session.query(Business).count() == 0

    response = client.get("/api/settings")
    assert response.status_code == 200

    payload = response.json()
    assert payload["name"] == get_settings().app_name
    assert payload["primary_color"] is None
    assert payload["currency"] == "USD"
    assert payload["backup_scheduler_enabled"] is False
    assert payload["backup_retention_count"] == 5
    assert "created_at" in payload
    assert "updated_at" in payload

    assert db_session.query(Business).count() == 1


def test_update_settings_applies_changes(client):
    client.get("/api/settings")  # trigger default creation

    response = client.put(
        "/api/settings",
        json={
            "name": "Skyline Athletics",
            "primary_color": "#a1b2c3",
            "language": "ES",
        },
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["name"] == "Skyline Athletics"
    assert payload["primary_color"] == "#A1B2C3"
    assert payload["language"] == "ES"


def test_upload_logo_persists_file_and_updates_business(client, tmp_path):
    client.get("/api/settings")

    response = client.post(
        "/api/settings/logo",
        files={"file": ("brandmark.png", b"fake-bytes", "image/png")},
    )
    assert response.status_code == 201

    payload = response.json()
    assert payload["logo_path"] is not None

    logo_path = Path(payload["logo_path"])
    assert logo_path.exists()
    assert logo_path.read_bytes() == b"fake-bytes"
    assert logo_path.parent == tmp_path


def test_backup_config_endpoint_returns_environment_metadata(client, tmp_path):
    client.get("/api/settings")

    response = client.get("/api/settings/backup-config")
    assert response.status_code == 200

    payload = response.json()
    assert payload["business"]["name"] == get_settings().app_name
    env = payload["environment"]
    assert env["database_url"] == get_settings().database_url
    assert env["branding_assets_dir"] == str(tmp_path)
    assert env["scheduled_backup_dir"] == get_settings().scheduled_backup_dir
    assert env["backup_scheduler_poll_seconds"] == get_settings().backup_scheduler_poll_seconds
    assert "payment_due_interval_days" in env


def test_manual_backup_endpoint_streams_zip_archive(client, db_session):
    client.get("/api/settings")

    business = db_session.query(Business).first()

    class_course = ClassCourse(business_id=business.id, name="Pilates Basics")
    db_session.add(class_course)
    db_session.flush()

    group = Group(class_id=class_course.id, name="Morning Cohort")
    db_session.add(group)
    db_session.flush()

    member = Member(
        business_id=business.id,
        class_id=class_course.id,
        group_id=group.id,
        first_name="Grace",
        last_name="Hopper",
        email="grace@example.com",
    )
    db_session.add(member)
    db_session.flush()

    payment = Payment(
        member_id=member.id,
        amount=200,
        payment_date=date(2025, 4, 5),
        status=PaymentStatus.PAID,
        method=PaymentMethod.CARD,
        receipt_number="R-200",
    )
    db_session.add(payment)
    db_session.flush()

    receipt = Receipt(payment_id=payment.id, file_path="receipts/R-200.pdf")
    db_session.add(receipt)
    db_session.commit()

    response = client.get("/api/settings/backup/manual")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "attachment; filename=" in response.headers.get("content-disposition", "")

    with ZipFile(BytesIO(response.content)) as zip_file:
        assert "members.csv" in zip_file.namelist()
        members_csv = zip_file.read("members.csv").decode("utf-8-sig")
        assert "Grace" in members_csv


def test_update_backup_schedule_endpoint_updates_business(client, db_session):
    client.get("/api/settings")

    response = client.put(
        "/api/settings/backup/schedule",
        json={"enabled": True, "cadence": "daily", "retention_count": 3},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["backup_scheduler_enabled"] is True
    assert payload["backup_cadence"] == "daily"
    assert payload["backup_retention_count"] == 3
    assert payload["backup_next_run_at"] is not None

    business = db_session.query(Business).first()
    assert business.backup_scheduler_enabled is True
    assert business.backup_cadence == "daily"
    assert business.backup_retention_count == 3