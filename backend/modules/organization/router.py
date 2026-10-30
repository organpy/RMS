from fastapi import APIRouter, Depends, Response, UploadFile
from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.core.db import get_db
from backend.core.errors import AppError, NotFound
from backend.core.security import current_staff, require_admin
from backend.modules.audit.service import audit

from .schemas import OrganizationOut, OrganizationUpdate
from .service import get_org

router = APIRouter(prefix="/organization", tags=["organization"])

MAX_LOGO_BYTES = 1024 * 1024
SIGNATURES = {b"\x89PNG\r\n\x1a\n": "image/png", b"\xff\xd8\xff": "image/jpeg", b"RIFF": "image/webp"}


def _out(org) -> OrganizationOut:
    out = OrganizationOut.model_validate(org)
    out.has_logo = bool(org.logo_mime) and get_settings().logo_path.exists()
    return out


@router.get("", response_model=OrganizationOut, dependencies=[Depends(current_staff)])
def read(db: Session = Depends(get_db)) -> OrganizationOut:
    return _out(get_org(db))


CLEARABLE = {"email", "phone", "address", "tax_id", "invoice_note"}


@router.patch("", response_model=OrganizationOut)
def update(body: OrganizationUpdate, db: Session = Depends(get_db), staff=Depends(require_admin)) -> OrganizationOut:
    org = get_org(db)
    changed = []
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None or key in CLEARABLE:
            setattr(org, key, value)
            changed.append(key)
    audit(db, staff, "updated", "settings", None, ", ".join(changed))
    db.commit()
    return _out(org)


@router.put("/logo", response_model=OrganizationOut)
def upload_logo(file: UploadFile, db: Session = Depends(get_db), staff=Depends(require_admin)) -> OrganizationOut:
    data = file.file.read(MAX_LOGO_BYTES + 1)
    if len(data) > MAX_LOGO_BYTES:
        raise AppError("Logo must be 1 MB or smaller")
    mime = next((m for sig, m in SIGNATURES.items() if data.startswith(sig)), None)
    if mime is None or (mime == "image/webp" and data[8:12] != b"WEBP"):
        raise AppError("Logo must be a PNG, JPEG or WebP image")
    get_settings().logo_path.write_bytes(data)
    org = get_org(db)
    org.logo_mime = mime
    audit(db, staff, "updated", "settings", None, "logo")
    db.commit()
    return _out(org)


@router.delete("/logo", response_model=OrganizationOut)
def delete_logo(db: Session = Depends(get_db), staff=Depends(require_admin)) -> OrganizationOut:
    get_settings().logo_path.unlink(missing_ok=True)
    org = get_org(db)
    org.logo_mime = None
    audit(db, staff, "deleted", "settings", None, "logo")
    db.commit()
    return _out(org)


@router.get("/logo")
def logo(db: Session = Depends(get_db)) -> Response:
    org = get_org(db)
    path = get_settings().logo_path
    if not org.logo_mime or not path.exists():
        raise NotFound("No logo")
    return Response(path.read_bytes(), media_type=org.logo_mime, headers={"Cache-Control": "no-cache"})
