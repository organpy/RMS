from io import BytesIO
from zipfile import ZipFile
import os

from backend.models import Business, Member, Receipt


def test_backup_restore_restores_receipt_file(client, db_session, tmp_path):
    # Ensure default business exists
    client.get("/api/settings")

    business = db_session.query(Business).first()

    # Create a member and payment + receipt referencing a file
    member = Member(business_id=business.id, first_name="Grace", last_name="Hopper", email="grace@ex.com")
    db_session.add(member)
    db_session.commit()

    # Create a fake receipt file in the receipts dir
    from backend.config import get_settings
    settings = get_settings()
    receipts_dir = os.path.abspath(settings.receipt_output_dir)
    os.makedirs(receipts_dir, exist_ok=True)

    receipt_filename = f"receipt-test-{member.id}.pdf"
    receipt_path = os.path.join(receipts_dir, receipt_filename)
    with open(receipt_path, "wb") as f:
        f.write(b"PDF-DATA")

    # Create a Payment and a Receipt record referencing the file
    from backend.models import Payment
    from datetime import date
    payment = Payment(member_id=member.id, amount=10.0, payment_date=date.today())
    db_session.add(payment)
    db_session.commit()

    receipt = Receipt(payment_id=payment.id, file_path=receipt_path)
    db_session.add(receipt)
    db_session.commit()

    # Create a manual backup archive
    resp = client.get("/api/settings/backup/manual")
    assert resp.status_code == 200

    archive_bytes = resp.content

    # Delete the receipt file and DB record to simulate data loss
    os.remove(receipt_path)
    db_session.delete(receipt)
    db_session.commit()

    assert not os.path.exists(receipt_path)
    assert db_session.query(Receipt).filter_by(id=receipt.id).count() == 0

    # Upload the archive to the restore endpoint (non-dry-run)
    files = {"file": ("backup.zip", archive_bytes, "application/zip")}
    resp2 = client.post("/api/backup/restore?dry_run=false", files=files)
    assert resp2.status_code == 200
    payload = resp2.json()
    assert payload["ok"] is True

    # Verify receipt DB record restored
    restored = db_session.query(Receipt).filter_by(id=receipt.id).one_or_none()
    assert restored is not None
    # Verify file was restored to receipts dir
    assert os.path.exists(restored.file_path)
    with open(restored.file_path, "rb") as f:
        assert f.read() == b"PDF-DATA"
