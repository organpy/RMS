"""Moving data to a new version: restore during setup, and a backup before schema upgrades."""

import pytest

from backend.core import db, migrate
from backend.modules.backups import service as backups

from .test_backups import _rewind


def _fresh_install(tmp_path):
    """Point the app at a new, empty database, as a newly extracted version would have."""
    engine = db.make_engine(f"sqlite:///{tmp_path / 'new.db'}")
    migrate.upgrade(engine)
    db.engine.dispose()
    db.rebind(engine)


def test_new_install_starts_from_an_old_backup(admin, tmp_path):
    admin.post("/api/members", json={"first_name": "Keep", "last_name": "Me"})
    name = admin.post("/api/backups").json()["filename"]
    old = _rewind(admin.get(f"/api/backups/{name}").content, "f8d8bd535452")  # made by the first release

    _fresh_install(tmp_path)
    admin.post("/api/auth/logout")
    assert admin.get("/api/auth/status").json() == {"setup_required": True}
    r = admin.post("/api/auth/setup/restore", files={"file": ("old.zip", old, "application/zip")})
    assert r.status_code == 204, r.text

    assert admin.get("/api/auth/status").json() == {"setup_required": False}
    assert admin.post("/api/auth/login", json={"username": "admin", "password": "correct-horse"}).status_code == 200
    assert [m["first_name"] for m in admin.get("/api/members").json()["items"]] == ["Keep"]
    assert not any(b["kind"] == "pre-restore" for b in admin.get("/api/backups").json())  # nothing worth keeping


def test_setup_restore_is_closed_once_set_up(admin):
    name = admin.post("/api/backups").json()["filename"]
    archive = admin.get(f"/api/backups/{name}").content
    admin.post("/api/auth/logout")
    r = admin.post("/api/auth/setup/restore", files={"file": ("b.zip", archive, "application/zip")})
    assert r.status_code == 409


def test_setup_restore_rejects_junk(client):
    r = client.post("/api/auth/setup/restore", files={"file": ("x.zip", b"not a zip", "application/zip")})
    assert r.status_code == 400


def test_backup_before_upgrading_an_older_database(admin):
    assert backups.before_upgrade() is None  # already current: nothing to do
    from alembic import command

    cfg = migrate._config()
    with db.engine.begin() as connection:  # the database as the previous release left it
        cfg.attributes["connection"] = connection
        command.downgrade(cfg, "-1")
    made = backups.before_upgrade()
    assert made and made.kind == "pre-upgrade"
    migrate.upgrade(db.engine)
    assert migrate.current_revision(db.engine) == migrate.head_revision()
    assert [b["kind"] for b in admin.get("/api/backups").json()] == ["pre-upgrade"]


def test_data_from_a_newer_version_is_left_alone(admin):
    with db.engine.begin() as con:
        con.exec_driver_sql("UPDATE alembic_version SET version_num = 'ffffffffffff'")
    with pytest.raises(SystemExit, match="newer version"):
        backups.before_upgrade()


def test_health_reports_the_version(client):
    assert client.get("/api/health").json() == {"status": "ok", "version": "dev"}
