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
    from backend.modules.backups import scheduler

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
