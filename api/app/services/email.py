"""Email delivery boundary for test sends.

The provider is deliberately kept behind this small service so a production
email provider can replace Resend without changing sermon routes or UI.

Delivery config comes from either the environment (`RESEND_API_KEY` /
`EMAIL_FROM`, the ops path) or the in-app Settings (`app_settings` table,
managed at `/app/settings`). Environment values take precedence so a
deployment can pin credentials; when no env config exists, the in-app
settings apply.
"""

from __future__ import annotations

from html import escape

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.setting import AppSetting
from app.services.crypto import DecryptionError, decrypt_value, encrypt_value

DB_RESEND_KEY = "resend_api_key"
DB_EMAIL_FROM = "email_from"

# Keys whose values are secrets — encrypted at rest via app.services.crypto.
SECRET_SETTING_KEYS = {DB_RESEND_KEY}


def _get_setting(db: Session, key: str) -> str | None:
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


def _set_setting(db: Session, key: str, value: str) -> None:
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


def resolve_email_config(
    db: Session,
) -> tuple[str | None, str | None, str]:
    """Return ``(api_key, email_from, source)``.

    ``source`` is ``"env"`` when either env value is set, ``"db"`` when the
    in-app settings are present, otherwise ``"unset"``.
    """
    settings = get_settings()
    if settings.resend_api_key or settings.email_from:
        return (
            settings.resend_api_key or None,
            settings.email_from or None,
            "env",
        )
    db_key = _get_setting(db, DB_RESEND_KEY)
    db_from = _get_setting(db, DB_EMAIL_FROM)
    if db_key or db_from:
        return db_key, db_from, "db"
    return None, None, "unset"


def mask_api_key(api_key: str) -> str:
    """Return a display-safe mask (never the full key)."""
    if len(api_key) <= 4:
        return "•" * len(api_key)
    return f"{'•' * 4}{api_key[-4:]}"


def apply_email_settings(
    db: Session,
    *,
    resend_api_key: str | None,
    email_from: str | None,
    clear_resend_key: bool,
) -> None:
    """Persist email settings from the Settings UI."""
    if clear_resend_key:
        _set_setting(db, DB_RESEND_KEY, "")
    elif resend_api_key:
        _set_setting(db, DB_RESEND_KEY, resend_api_key.strip())

    if email_from is not None:
        _set_setting(db, DB_EMAIL_FROM, email_from.strip())

    db.commit()


def _draft_to_html(body: str) -> str:
    paragraphs = body.split("\n\n")
    return "".join(
        f'<p style="margin:0 0 16px;line-height:1.7;">{escape(paragraph).replace(chr(10), "<br>")}</p>'
        for paragraph in paragraphs
        if paragraph.strip()
    )


def send_test_email(
    *,
    to: str,
    subject: str,
    body: str,
    api_key: str,
    from_email: str,
) -> None:
    """Send one test email or raise a configuration/provider error."""
    if not api_key or not from_email:
        raise RuntimeError(
            "Email sending is not configured. Add a Resend API key and "
            "sender address in Settings, or set RESEND_API_KEY and "
            "EMAIL_FROM in api/.env."
        )

    import resend

    resend.api_key = api_key
    resend.Emails.send(
        {
            "from": from_email,
            "to": [to],
            "subject": f"[Test] {subject}",
            "html": (
                '<div style="font-family:Arial,sans-serif;color:#29283d;max-width:640px;">'
                '<p style="font-size:18px;font-weight:700;color:#4f46e5;">After Sunday</p>'
                '<p style="color:#6b7280;font-size:12px;">Test email preview</p>'
                f"{_draft_to_html(body)}"
                '<p style="border-top:1px solid #e5e7eb;padding-top:16px;'
                'color:#6b7280;font-size:12px;">This is a test email from After Sunday.</p>'
                "</div>"
            ),
        }
    )
