from app.schemas.setting import EmailSettingsUpdate
from app.services.email import mask_api_key


def test_mask_api_key_masks_middle():
    assert mask_api_key("re_abcdef123456") == "••••3456"


def test_mask_api_key_short_key_fully_masked():
    assert mask_api_key("abc") == "•••"


def test_email_settings_update_accepts_camel_case():
    payload = EmailSettingsUpdate(
        resendApiKey="re_x",
        emailFrom="noreply@example.com",
        clearResendKey=True,
    )
    assert payload.resend_api_key == "re_x"
    assert payload.email_from == "noreply@example.com"
    assert payload.clear_resend_key is True
