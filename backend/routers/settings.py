"""Routes for managing business branding and application settings."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.settings import (
    BackupConfigResponse,
    BackupEnvironmentSchema,
    BackupScheduleUpdate,
    BusinessSettingsResponse,
    BusinessSettingsUpdate,
)
from backend.services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def get_settings_service(db: Session = Depends(get_db)) -> SettingsService:
    return SettingsService(db)


@router.get("", response_model=BusinessSettingsResponse)
async def read_business_settings(
    service: SettingsService = Depends(get_settings_service),
) -> BusinessSettingsResponse:
    """Return the persisted business branding settings."""

    business = service.get_business()
    return BusinessSettingsResponse.model_validate(business, from_attributes=True)


@router.put("", response_model=BusinessSettingsResponse)
async def update_business_settings(
    payload: BusinessSettingsUpdate,
    service: SettingsService = Depends(get_settings_service),
) -> BusinessSettingsResponse:
    """Persist updates to the business branding settings."""

    business = service.update_business(payload.model_dump(exclude_none=True))
    return BusinessSettingsResponse.model_validate(business, from_attributes=True)


@router.post("/logo", response_model=BusinessSettingsResponse, status_code=status.HTTP_201_CREATED)
async def upload_logo(
    file: UploadFile = File(...),
    service: SettingsService = Depends(get_settings_service),
) -> BusinessSettingsResponse:
    """Upload a new logo asset and update the business settings."""

    content = await file.read()
    business = service.store_logo(filename=file.filename or "logo", content=content)
    await file.close()
    return BusinessSettingsResponse.model_validate(business, from_attributes=True)


@router.get("/backup-config", response_model=BackupConfigResponse)
async def read_backup_configuration(
    service: SettingsService = Depends(get_settings_service),
) -> BackupConfigResponse:
    """Return the configuration payload used for offline backups."""

    backup = service.generate_backup_configuration()
    business = BusinessSettingsResponse.model_validate(backup.business, from_attributes=True)
    environment = BackupEnvironmentSchema(**backup.environment)
    return BackupConfigResponse(business=business, environment=environment)


@router.get("/backup/manual")
async def download_manual_backup(
    service: SettingsService = Depends(get_settings_service),
) -> StreamingResponse:
    """Stream a zipped archive containing CSV exports for core entities."""

    archive = service.generate_backup_archive()
    headers = {
        "Content-Disposition": f'attachment; filename="{archive.filename}"'
    }
    return StreamingResponse(iter([archive.content]), media_type="application/zip", headers=headers)


@router.put("/backup/schedule", response_model=BusinessSettingsResponse)
async def update_backup_schedule(
    payload: BackupScheduleUpdate,
    service: SettingsService = Depends(get_settings_service),
) -> BusinessSettingsResponse:
    """Update automated backup scheduling preferences."""

    business = service.update_backup_schedule(payload)
    return BusinessSettingsResponse.model_validate(business, from_attributes=True)
