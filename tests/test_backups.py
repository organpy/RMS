import io
import zipfile
from datetime import datetime, timedelta, timezone



def test_backup_and_restore_round_trip(admin):
    admin.post("/api/members", json={"first_name": "Keep", "last_name": "Me"})
    b = admin.post("/api/backups").json()
    assert b["kind"] == "manual"
    archive = admin.get(f"/api/backups/{b['filename']}").content
    assert set(zipfile.ZipFile(io.BytesIO(archive)).namelist()) == {"rms.db", "manifest.json"}

    admin.post("/api/members", json={"first_name": "Drop", "last_name": "Me"})
    assert admin.get("/api/members").json()["total"] == 2
    r = admin.post("/api/backups/restore", files={"file": ("b.zip", archive, "application/zip")})
    assert r.status_code == 204, r.text
    names = [m["first_name"] for m in admin.get("/api/members").json()["items"]]
    assert names == ["Keep"]
    kinds = {x["kind"] for x in admin.get("/api/backups").json()}
    assert kinds == {"manual", "pre-restore"}


def test_restore_rejects_foreign_archives(admin):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("rms.db", b"not a database")
    r = admin.post("/api/backups/restore", files={"file": ("x.zip", buf.getvalue(), "application/zip")})
    assert r.status_code == 400
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../etc/passwd", b"x")
        zf.writestr("rms.db", b"x")
    r = admin.post("/api/backups/restore", files={"file": ("x.zip", buf.getvalue(), "application/zip")})
    assert r.status_code == 400
    r = admin.post("/api/backups/restore", files={"file": ("x.zip", b"plain text", "application/zip")})
    assert r.status_code == 400


def test_download_rejects_traversal(admin):
    assert admin.get("/api/backups/..%2Frms.db").status_code == 404
    assert admin.get("/api/backups/secret.key").status_code == 404


def test_scheduled_backups_respect_cadence_and_retention(admin):
    from backend.modules.backups import schedule as scheduler

    admin.put("/api/backups/schedule", json={"backup_enabled": True, "backup_cadence": "daily", "backup_keep": 1})
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert scheduler.run_due_backup(start) is True
    assert scheduler.run_due_backup(start + timedelta(hours=2)) is False
    assert admin.get("/api/backups/schedule").json()["backup_last_at"] is not None


def test_backups_admin_only(admin):
    admin.post("/api/staff", json={"username": "sam", "name": "Sam", "password": "password1"})
    admin.post("/api/auth/logout")
    admin.post("/api/auth/login", json={"username": "sam", "password": "password1"})
    assert admin.get("/api/backups").status_code == 403


def _rewind(archive: bytes, revision: str) -> bytes:
    """Rewrite a backup as if it had been made by an older version of RMS."""
    import sqlite3
    import tempfile
    from pathlib import Path

    from alembic import command
    from sqlalchemy import create_engine

    from backend.core.migrate import _config

    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "rms.db"
        db_path.write_bytes(zipfile.ZipFile(io.BytesIO(archive)).read("rms.db"))
        if revision.startswith("f8d8"):
            engine, cfg = create_engine(f"sqlite:///{db_path}"), _config()
            with engine.begin() as connection:
                cfg.attributes["connection"] = connection
                command.downgrade(cfg, revision)
            engine.dispose()
        else:
            con = sqlite3.connect(db_path)
            con.execute("PRAGMA journal_mode=DELETE")  # keep the change in the main file, not a -wal sidecar
            con.execute("UPDATE alembic_version SET version_num = ?", (revision,))
            con.commit()
            con.close()
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w") as zf:
            zf.write(db_path, "rms.db")
        return out.getvalue()


def test_restore_upgrades_backups_from_older_versions(admin):
    admin.post("/api/members", json={"first_name": "Keep", "last_name": "Me", "discount_percent": 5})
    name = admin.post("/api/backups").json()["filename"]
    old = _rewind(admin.get(f"/api/backups/{name}").content, "f8d8bd535452")  # the very first schema

    admin.post("/api/members", json={"first_name": "Drop", "last_name": "Me"})
    r = admin.post("/api/backups/restore", files={"file": ("old.zip", old, "application/zip")})
    assert r.status_code == 204, r.text
    # The old schema was brought up to date: current features work and the data survived.
    assert [m["first_name"] for m in admin.get("/api/members").json()["items"]] == ["Keep"]
    assert admin.get("/api/messages").status_code == 200 and admin.get("/api/expenses").status_code == 200
    assert admin.post("/api/expenses", json={"category": "Rent", "description": "x", "amount": "5"}).status_code == 201
    assert any(a["action"] == "restored" for a in admin.get("/api/audit").json()["items"])


def test_restore_rejects_backups_from_unknown_versions(admin):
    name = admin.post("/api/backups").json()["filename"]
    future = _rewind(admin.get(f"/api/backups/{name}").content, "ffffffffffff")
    r = admin.post("/api/backups/restore", files={"file": ("new.zip", future, "application/zip")})
    assert r.status_code == 400 and "newer or unknown" in r.json()["detail"]
    assert admin.get("/api/members").status_code == 200  # the live database is untouched
