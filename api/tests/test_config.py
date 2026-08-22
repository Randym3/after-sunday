from app.config import get_settings


def test_web_origin_can_be_configured(monkeypatch):
    monkeypatch.setenv("WEB_ORIGIN", "https://app.example.com")
    get_settings.cache_clear()
    try:
        assert get_settings().web_origin == "https://app.example.com"
    finally:
        get_settings.cache_clear()


def test_web_origin_defaults_to_localhost():
    get_settings.cache_clear()
    try:
        assert get_settings().web_origin == "http://localhost:3000"
    finally:
        get_settings.cache_clear()
