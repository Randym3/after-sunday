import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user_uuid
from app.db import get_db
from app.schemas.setting import (
    BrandingRead,
    BrandingUpdate,
    EmailSettingsRead,
    EmailSettingsUpdate,
    StorageRead,
)
from app.services.branding import (
    LOGO_MAX_BYTES,
    clear_logo,
    get_branding,
    is_supported_logo,
    save_logo,
    set_organization_name,
)
from app.services.email import (
    apply_email_settings,
    mask_api_key,
    resolve_email_config,
)
from app.storage import get_storage

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/email", response_model=EmailSettingsRead)
def get_email_settings(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    api_key, email_from, source = resolve_email_config(db)
    return EmailSettingsRead(
        email_from=email_from,
        resend_configured=api_key is not None,
        resend_key_masked=mask_api_key(api_key) if api_key else None,
        source=source,
    )


@router.put("/email", response_model=EmailSettingsRead)
def update_email_settings(
    payload: EmailSettingsUpdate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    apply_email_settings(
        db,
        resend_api_key=payload.resend_api_key,
        email_from=payload.email_from,
        clear_resend_key=payload.clear_resend_key,
    )
    api_key, email_from, source = resolve_email_config(db)
    return EmailSettingsRead(
        email_from=email_from,
        resend_configured=api_key is not None,
        resend_key_masked=mask_api_key(api_key) if api_key else None,
        source=source,
    )


@router.get("/branding", response_model=BrandingRead)
def get_branding_settings(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    return get_branding(db)


@router.put("/branding", response_model=BrandingRead)
def update_branding_settings(
    payload: BrandingUpdate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    if payload.organization_name is not None:
        set_organization_name(db, payload.organization_name)
    return get_branding(db)


@router.put("/branding/logo", response_model=BrandingRead)
async def upload_branding_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    content_type = (file.content_type or "").lower()
    if not is_supported_logo(content_type):
        raise HTTPException(
            status_code=415,
            detail="Logo must be a PNG, JPEG, WebP, or SVG image.",
        )
    data = await file.read()
    if len(data) > LOGO_MAX_BYTES:
        raise HTTPException(
            status_code=413, detail="Logo must be 2 MB or smaller."
        )
    if not data:
        raise HTTPException(status_code=422, detail="Logo file is empty.")
    save_logo(db, data, content_type)
    return get_branding(db)


@router.delete("/branding/logo", response_model=BrandingRead)
def remove_branding_logo(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    clear_logo(db)
    return get_branding(db)


@router.get("/storage", response_model=StorageRead)
def get_storage_settings(
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    storage = get_storage()
    return StorageRead(
        backend=storage.backend_name,
        location=storage.location,
        public_base_url="/media",
    )
