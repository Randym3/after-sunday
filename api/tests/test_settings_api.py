import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user_uuid
from app.db import get_db
from app.main import app
from app.services import branding
from app.storage import LocalDiskBackend


@pytest.fixture
def client(db_session, tmp_path, monkeypatch):
    def override_db():
        yield db_session

    backend = LocalDiskBackend(root_dir=str(tmp_path))
    monkeypatch.setattr(branding, "get_storage", lambda: backend)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_uuid] = lambda: uuid.uuid4()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_branding_defaults(client):
    response = client.get("/settings/branding")
    assert response.status_code == 200
    assert response.json() == {
        "organizationName": None,
        "logoUrl": None,
        "logoContentType": None,
    }


def test_update_organization_name_persists(client):
    response = client.put(
        "/settings/branding", json={"organizationName": "Grace Church"}
    )
    assert response.status_code == 200
    assert response.json()["organizationName"] == "Grace Church"
    assert (
        client.get("/settings/branding").json()["organizationName"]
        == "Grace Church"
    )


def test_logo_upload_and_remove(client):
    upload = client.put(
        "/settings/branding/logo",
        files={"file": ("logo.png", b"\x89PNG fake", "image/png")},
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["logoUrl"] == "/media/organization_logo"
    assert body["logoContentType"] == "image/png"

    removed = client.delete("/settings/branding/logo")
    assert removed.status_code == 200
    assert removed.json()["logoUrl"] is None


def test_logo_rejects_unsupported_type(client):
    response = client.put(
        "/settings/branding/logo",
        files={"file": ("logo.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 415
