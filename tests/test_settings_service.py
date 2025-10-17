"""Unit tests covering the settings domain service."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.config import get_settings
from backend.exceptions import ValidationError
from backend.models import Business
from backend.services.settings_service import SettingsService


@pytest.fixture
def service(db_session, tmp_path):
    return SettingsService(db_session, assets_dir=tmp_path)


def test_get_business_creates_default_when_missing(service, db_session):
    assert db_session.query(Business).count() == 0

    business = service.get_business()

    assert business.id is not None
    assert business.name == get_settings().app_name
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


def test_generate_backup_configuration_returns_expected_payload(service):
    config = service.generate_backup_configuration()

    assert config.business.name == get_settings().app_name
    assert config.environment["app_name"] == get_settings().app_name
    assert "database_url" in config.environment
    assert "branding_assets_dir" in config.environment
    assert config.environment["branding_assets_dir"] == str(service.assets_dir)