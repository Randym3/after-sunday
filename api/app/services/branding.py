"""Organization branding settings (name + logo) used across the app.

The logo is stored through the StorageBackend under the single-segment key
`organization_logo`; the key + content type are recorded in app_settings so
the browser can fetch it via the storage public URL.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.settings_store import get_setting, set_setting
from app.storage import get_storage

DB_ORG_NAME = "organization_name"
DB_LOGO_KEY = "organization_logo_key"
DB_LOGO_CONTENT_TYPE = "organization_logo_content_type"

LOGO_STORAGE_KEY = "organization_logo"
LOGO_MAX_BYTES = 2 * 1024 * 1024  # 2 MB
LOGO_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
}


def is_supported_logo(content_type: str | None) -> bool:
    return (content_type or "").lower() in LOGO_CONTENT_TYPES


def get_organization_name(db: Session) -> str | None:
    return get_setting(db, DB_ORG_NAME)


def get_branding(db: Session) -> dict:
    logo_key = get_setting(db, DB_LOGO_KEY)
    return {
        "organization_name": get_organization_name(db),
        "logo_url": (
            get_storage().public_url(LOGO_STORAGE_KEY) if logo_key else None
        ),
        "logo_content_type": get_setting(db, DB_LOGO_CONTENT_TYPE),
    }


def set_organization_name(db: Session, name: str | None) -> None:
    set_setting(db, DB_ORG_NAME, (name or "").strip())
    db.commit()


def save_logo(db: Session, data: bytes, content_type: str) -> None:
    get_storage().save(LOGO_STORAGE_KEY, data)
    set_setting(db, DB_LOGO_KEY, LOGO_STORAGE_KEY)
    set_setting(db, DB_LOGO_CONTENT_TYPE, content_type.lower())
    db.commit()


def clear_logo(db: Session) -> None:
    get_storage().delete(LOGO_STORAGE_KEY)
    set_setting(db, DB_LOGO_KEY, "")
    set_setting(db, DB_LOGO_CONTENT_TYPE, "")
    db.commit()
