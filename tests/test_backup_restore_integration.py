from io import BytesIO
from zipfile import ZipFile

from backend.models import Business, Member


def test_backup_then_restore_restores_deleted_member(client, db_session, tmp_path):
    # Ensure default business exists
    client.get("/api/settings")

    business = db_session.query(Business).first()

    # Create a member
    member = Member(business_id=business.id, first_name="Ada", last_name="Lovelace", email="ada@ex.com")
    db_session.add(member)
    db_session.commit()

    # Create a manual backup archive
    resp = client.get("/api/settings/backup/manual")
    assert resp.status_code == 200

    archive_bytes = resp.content

    # Confirm member present in backup
    with ZipFile(BytesIO(archive_bytes)) as zf:
        members_csv = zf.read("members.csv").decode("utf-8-sig")
        assert "Ada" in members_csv

    # Delete the member from DB
    db_session.delete(member)
    db_session.commit()

    assert db_session.query(Member).filter_by(id=member.id).count() == 0

    # Upload the archive to the restore endpoint (non-dry-run)
    files = {"file": ("backup.zip", archive_bytes, "application/zip")}
    resp2 = client.post("/api/backup/restore?dry_run=false", files=files)
    assert resp2.status_code == 200
    payload = resp2.json()
    assert payload["ok"] is True

    # Verify member restored
    restored = db_session.query(Member).filter_by(id=member.id).one_or_none()
    assert restored is not None
    assert restored.first_name == "Ada"
