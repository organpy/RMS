"""Integration test: create backup -> delete record -> restore backup -> verify data restored."""

from io import BytesIO


def test_backup_and_restore_member(client, db_session):
    # Ensure business exists
    from backend.models import Business, Member

    business = Business(name="BackupBiz")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)

    # Create a member via direct DB (simulate initial data)
    member = Member(business_id=business.id, first_name="Restore", last_name="Me", email="restore.me@example.com")
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    member_id = member.id

    # Trigger manual backup endpoint which returns archive bytes
    resp = client.get("/api/settings/backup/manual")
    assert resp.status_code == 200
    archive_bytes = resp.content
    assert len(archive_bytes) > 0

    # Delete the member directly
    db_session.delete(member)
    db_session.commit()

    # Verify member gone via API
    list_resp = client.get("/api/members")
    assert list_resp.status_code == 200
    assert all(m["id"] != member_id for m in list_resp.json()["data"])  # member absent

    # Post the archive to restore endpoint (perform actual restore)
    files = {"file": ("backup.zip", BytesIO(archive_bytes), "application/zip")}
    restore_resp = client.post("/api/backup/restore?dry_run=false", files=files)
    assert restore_resp.status_code == 200
    body = restore_resp.json()
    assert body.get("ok") is True

    # Verify member is present again
    list_resp_after = client.get("/api/members")
    assert list_resp_after.status_code == 200
    assert any(m["email"] == "restore.me@example.com" for m in list_resp_after.json()["data"]) 
