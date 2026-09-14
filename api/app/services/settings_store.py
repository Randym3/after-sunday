"""Read/write helpers for the app_settings key-value table.

Secret keys listed in SECRET_SETTING_KEYS are encrypted at rest via
app.services.crypto and decrypted transparently on read.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.setting import AppSetting
from app.services.crypto import DecryptionError, decrypt_value, encrypt_value

DB_RESEND_KEY = "resend_api_key"
DB_EMAIL_FROM = "email_from"
DB_YOUTUBE_CHANNEL_URL = "youtube_channel_url"

# Keys whose values are secrets — encrypted at rest via app.services.crypto.
SECRET_SETTING_KEYS = {DB_RESEND_KEY}


def get_setting(db: Session, key: str) -> str | None:
    setting = db.get(AppSetting, key)
    if setting is None:
        return None
    if key in SECRET_SETTING_KEYS:
        try:
            return decrypt_value(setting.value)
        except DecryptionError as exc:
            print(f"[settings] {exc} — treating '{key}' as unset.")
            return None
    return setting.value


def set_setting(db: Session, key: str, value: str) -> None:
    setting = db.get(AppSetting, key)
    if not value:
        if setting is not None:
            db.delete(setting)
        return
    stored = encrypt_value(value) if key in SECRET_SETTING_KEYS else value
    if setting is None:
        db.add(AppSetting(key=key, value=stored))
    else:
        setting.value = stored
