import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user_uuid
from app.db import get_db
from app.schemas.setting import EmailSettingsRead, EmailSettingsUpdate
from app.services.email import (
    apply_email_settings,
    mask_api_key,
    resolve_email_config,
)

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
