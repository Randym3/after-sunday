from types import SimpleNamespace

from app.models.setting import AppSetting
from app.services import crypto, settings_store
from app.services.settings_store import (
    DB_RESEND_KEY,
    get_setting,
    set_setting,
)


def test_set_and_get_plaintext(db_session):
    set_setting(db_session, "organization_name", "Grace Church")
    db_session.commit()
    assert get_setting(db_session, "organization_name") == "Grace Church"


def test_empty_value_deletes_row(db_session):
    set_setting(db_session, "organization_name", "Grace Church")
    db_session.commit()
    set_setting(db_session, "organization_name", "")
    db_session.commit()
    assert get_setting(db_session, "organization_name") is None


def test_secret_key_encrypted_at_rest(db_session, monkeypatch):
    monkeypatch.setattr(
        crypto, "get_settings", lambda: SimpleNamespace(secret_key="t")
    )
    crypto._warned_no_secret = True  # silence the dev-mode warning
    set_setting(db_session, DB_RESEND_KEY, "re_x")
    db_session.commit()
    stored = db_session.get(AppSetting, DB_RESEND_KEY).value
    assert stored.startswith("enc:v1:")
    assert get_setting(db_session, DB_RESEND_KEY) == "re_x"
