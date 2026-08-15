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

import re
from html import escape

from sqlalchemy.orm import Session

from app.config import get_settings
from app.services.settings_store import (
    DB_EMAIL_FROM,
    DB_RESEND_KEY,
    get_setting,
    set_setting,
)


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
    db_key = get_setting(db, DB_RESEND_KEY)
    db_from = get_setting(db, DB_EMAIL_FROM)
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
        set_setting(db, DB_RESEND_KEY, "")
    elif resend_api_key:
        set_setting(db, DB_RESEND_KEY, resend_api_key.strip())

    if email_from is not None:
        set_setting(db, DB_EMAIL_FROM, email_from.strip())

    db.commit()


_NUMBERED_ITEM = re.compile(r"^\s*\d+[.)]\s+(.+)$")
_SECTION_HEADINGS = {
    "three takeaways:": "Three takeaways",
    "reflection questions:": "Reflection questions",
}


def _render_body_blocks(body: str) -> str:
    """Render the AI's plain-text contract into stable email-safe HTML.

    The model never controls markup. Blank-line paragraphs, the two required
    section headings, and numbered lists are recognized here; all text is
    escaped before insertion into the template.
    """
    lines = [
        line.strip()
        for line in body.replace("\r\n", "\n").split("\n")
    ]
    blocks: list[str] = []
    paragraph: list[str] = []
    list_items: list[str] = []
    section: str | None = None

    def flush_paragraph() -> None:
        if not paragraph:
            return
        text = escape("\n".join(paragraph)).replace("\n", "<br>")
        blocks.append(
            '<p style="margin:0 0 22px;color:#332f2a;font-size:16px;'
            f'line-height:1.75;">{text}</p>'
        )
        paragraph.clear()

    def flush_section_heading() -> None:
        nonlocal section
        if section:
            blocks.append(
                '<h2 style="margin:28px 0 12px;color:#2f2a25;font-size:18px;'
                'line-height:1.4;text-align:left;">'
                f"{escape(section)}</h2>"
            )
            section = None

    def flush_list() -> None:
        nonlocal section
        if not list_items:
            return
        items = "".join(
            '<li style="margin:0 0 10px;padding-left:4px;color:#332f2a;">'
            f"{escape(item)}</li>"
            for item in list_items
        )
        list_html = (
            '<ol style="margin:12px 0 0;padding-left:24px;color:#332f2a;'
            f'font-size:16px;line-height:1.65;">{items}</ol>'
        )
        if section == "Three takeaways":
            blocks.append(
                '<div style="margin:22px 0;padding:20px;background:#edf3ff;'
                'border-radius:12px;">'
                '<p style="margin:0;color:#211f1c;font-size:16px;line-height:1.4;'
                'font-weight:700;">Three takeaways</p>'
                f"{list_html}</div>"
            )
        elif section == "Reflection questions":
            blocks.append(
                '<div style="margin:22px 0;padding:20px;background:#ffffff;'
                'border:1px dashed #cbd5e1;border-radius:12px;">'
                '<p style="margin:0;color:#211f1c;font-size:16px;line-height:1.4;'
                'font-weight:700;">Reflection questions</p>'
                f"{list_html}</div>"
            )
        else:
            blocks.append(list_html)
        list_items.clear()
        section = None

    for line in lines:
        if not line:
            flush_paragraph()
            flush_list()
            continue

        heading = _SECTION_HEADINGS.get(line.lower())
        if heading:
            flush_paragraph()
            flush_list()
            flush_section_heading()
            section = heading
            continue

        match = _NUMBERED_ITEM.match(line)
        if match:
            flush_paragraph()
            list_items.append(match.group(1).strip())
            continue

        if list_items:
            flush_list()
        elif section:
            flush_section_heading()
        paragraph.append(line)

    flush_paragraph()
    flush_list()
    flush_section_heading()
    return "".join(blocks)


def render_test_email_html(
    body: str,
    organization_name: str | None,
    subject: str | None = None,
    logo_data_uri: str | None = None,
) -> str:
    """Render a branded, table-safe email without trusting AI-generated HTML."""
    org = escape(organization_name or "After Sunday")
    safe_subject = escape(subject or "A follow-up from Sunday")
    logo = (
        f'<img src="{escape(logo_data_uri, quote=True)}" alt="{org}" '
        'style="display:block;max-width:220px;max-height:90px;margin:0 auto 18px;" />'
        if logo_data_uri
        else f'<div style="font-size:28px;font-weight:700;letter-spacing:-.5px;color:#2f2a25;margin-bottom:18px;">{org}</div>'
    )
    return (
        '<!doctype html><html><body style="margin:0;padding:0;background:#f3f0e9;">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="width:100%;background:#f3f0e9;"><tr><td align="center" '
        'style="padding:28px 12px;">'
        '<table role="presentation" width="680" cellspacing="0" cellpadding="0" '
        'style="width:100%;max-width:680px;background:#ffffff;">'
        '<tr><td style="height:8px;background:#e7dfcf;font-size:0;line-height:0;">&nbsp;</td></tr>'
        '<tr><td style="padding:42px 52px 20px;text-align:center;">'
        f"{logo}"
        '<div style="color:#766d61;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">'
        'A follow-up from your church</div>'
        f'<h1 style="margin:30px 0 0;color:#211f1c;font-size:25px;line-height:1.3;">{safe_subject}</h1>'
        '</td></tr>'
        '<tr><td style="padding:8px 52px 44px;">'
        f"{_render_body_blocks(body)}"
        '<div style="margin-top:34px;padding-top:18px;border-top:1px solid #e5dfd5;'
        'color:#766d61;font-size:12px;line-height:1.6;text-align:center;">'
        f'This is a test email from {org}.<br>Generated with care by After Sunday.'
        '</div></td></tr></table>'
        '</td></tr></table></body></html>'
    )


def send_test_email(
    *,
    to: str,
    subject: str,
    body: str,
    api_key: str,
    from_email: str,
    organization_name: str | None = None,
    logo_data_uri: str | None = None,
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
            "html": render_test_email_html(
                body,
                organization_name,
                subject,
                logo_data_uri,
            ),
        }
    )
