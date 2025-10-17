"""Integration tests for the settings API endpoints."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.config import get_settings
from backend.models import Business
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
    assert "payment_due_interval_days" in env