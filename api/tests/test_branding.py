import pytest

from app.services import branding
from app.storage import LocalDiskBackend


@pytest.fixture
def tmp_storage(tmp_path, monkeypatch):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    monkeypatch.setattr(branding, "get_storage", lambda: backend)
    return backend


def test_is_supported_logo():
    assert branding.is_supported_logo("image/png")
    assert branding.is_supported_logo("image/svg+xml")
    assert not branding.is_supported_logo("text/html")
    assert not branding.is_supported_logo(None)


def test_set_and_get_organization_name(db_session, tmp_storage):
    branding.set_organization_name(db_session, "  Grace Church  ")
    assert branding.get_organization_name(db_session) == "Grace Church"
    branding.set_organization_name(db_session, "")
    assert branding.get_organization_name(db_session) is None


def test_save_logo_stores_file_and_keys(db_session, tmp_storage):
    branding.save_logo(db_session, b"\x89PNG fake", "image/png")
    assert (
        tmp_storage.retrieve("organization_logo").read_bytes() == b"\x89PNG fake"
    )
    info = branding.get_branding(db_session)
    assert info["logo_url"] == "/media/organization_logo"
    assert info["logo_content_type"] == "image/png"


def test_clear_logo_removes_file_and_keys(db_session, tmp_storage):
    branding.save_logo(db_session, b"\x89PNG fake", "image/png")
    branding.clear_logo(db_session)
    info = branding.get_branding(db_session)
    assert info["logo_url"] is None
    assert info["logo_content_type"] is None
    assert tmp_storage.retrieve("organization_logo") is None
