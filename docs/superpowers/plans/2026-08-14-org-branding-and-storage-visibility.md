# Organization Branding + Upload Destination Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let church staff configure their organization name and logo in Settings (used in the app sidebar and test-email header), and make it obvious where uploaded sermon recordings are stored.

**Architecture:** Two independent parts sharing the existing `app_settings` key-value table and the `StorageBackend` interface. Part A adds a branding service + `/settings/branding*` endpoints; the logo is a small file stored via the storage backend under the single-segment key `organization_logo` and served by the existing `/media` StaticFiles mount in dev. Part B surfaces the storage backend/location in Settings and makes the local root configurable via a `STORAGE_ROOT` env var.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, Resend (email), Next.js App Router / React 19 / Tailwind v4.

## Global Constraints

- **No database migration is needed** — branding and storage-info settings reuse the existing `app_settings` table (migration 0013). Do not add one.
- **Storage keys are single path segments only** — `LocalDiskBackend._key_to_path` flattens via `os.path.basename`. The logo key is exactly `organization_logo`.
- **Secrets stay in `SECRET_SETTING_KEYS`** — org name and logo keys are NOT secrets; they are stored plaintext via the shared settings store.
- **Logo upload rules:** content types `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` only; max size 2 MB; empty file rejected.
- **Frontend visual style:** reuse the app's existing input class `"mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60"` and the `Card` component. No new design system.
- **Commit style:** lowercase, no conventional-commit prefix (e.g. `add organization branding settings`), matching `git log` history on this repo.
- **API responses use camelCase** via the existing `to_camel` alias generator.

---
---

# PART A — Organization branding (name + logo)

## Task A1: Extract a shared settings store

**Files:**
- Create: `api/app/services/settings_store.py`
- Modify: `api/app/services/email.py`
- Test: `api/tests/conftest.py` (new), `api/tests/test_settings_store.py` (new)

**Interfaces:**
- Consumes: `AppSetting` model, `app.services.crypto` (`decrypt_value`, `encrypt_value`, `DecryptionError`).
- Produces: `get_setting(db: Session, key: str) -> str | None`, `set_setting(db: Session, key: str, value: str) -> None`, constants `DB_RESEND_KEY`, `DB_EMAIL_FROM`, `SECRET_SETTING_KEYS`. Later tasks (A3) reuse these for branding keys.

- [ ] **Step 1: Write the failing test — DB fixture**

Create `api/tests/conftest.py`:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base


@pytest.fixture
def db_session():
    """Fresh in-memory SQLite session for settings-table tests."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
```

Create `api/tests/test_settings_store.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `api/`): `source .venv/bin/activate && python -m pytest tests/test_settings_store.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.settings_store'`

- [ ] **Step 3: Create the shared store**

Create `api/app/services/settings_store.py`:

```python
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
```

Refactor `api/app/services/email.py`:

- Remove the block defining `DB_RESEND_KEY`, `DB_EMAIL_FROM`, `SECRET_SETTING_KEYS`, `_get_setting`, and `_set_setting`.
- Remove `from app.services.crypto import DecryptionError, decrypt_value, encrypt_value`.
- Add `from app.services.settings_store import DB_EMAIL_FROM, DB_RESEND_KEY, get_setting, set_setting`.
- In `resolve_email_config`, replace `_get_setting(db, DB_RESEND_KEY)` → `get_setting(db, DB_RESEND_KEY)` and `_get_setting(db, DB_EMAIL_FROM)` → `get_setting(db, DB_EMAIL_FROM)`.
- In `apply_email_settings`, replace `_set_setting(...)` → `set_setting(...)` (same call shapes).

- [ ] **Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_settings_store.py tests/test_settings.py tests/test_crypto.py tests/test_sermon_email.py tests/test_campaign_schedule.py -q`
Expected: PASS (all existing tests still green after the refactor)

- [ ] **Step 5: Commit**

```bash
git add api/app/services/settings_store.py api/app/services/email.py api/tests/conftest.py api/tests/test_settings_store.py
git commit -m "extract shared settings store for app settings"
```

## Task A2: Add `save()` + `location` to the storage backend

**Files:**
- Modify: `api/app/storage.py`
- Test: `api/tests/test_storage.py` (new)

**Interfaces:**
- Consumes: `StorageBackend` (existing), `LocalDiskBackend(root_dir: str)` (existing).
- Produces: `StorageBackend.save(storage_key: str, data: bytes) -> None` (new abstract), `LocalDiskBackend.save(...)` (writes whole file), `LocalDiskBackend.backend_name = "local_disk"` (class attr), `LocalDiskBackend.location -> str` (property). Used by A3 (logo) and B2 (storage info).

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_storage.py`:

```python
from app.storage import LocalDiskBackend


def test_save_then_retrieve(tmp_path):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    backend.save("organization_logo", b"\x89PNG fake")
    assert backend.retrieve("organization_logo").read_bytes() == b"\x89PNG fake"


def test_save_overwrites_existing(tmp_path):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    backend.save("organization_logo", b"one")
    backend.save("organization_logo", b"two")
    assert backend.retrieve("organization_logo").read_bytes() == b"two"


def test_delete_removes_file(tmp_path):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    backend.save("organization_logo", b"data")
    backend.delete("organization_logo")
    assert backend.retrieve("organization_logo") is None


def test_location_points_at_root(tmp_path):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    assert backend.location == str(tmp_path)
    assert backend.backend_name == "local_disk"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_storage.py -q`
Expected: FAIL with `AttributeError: 'LocalDiskBackend' object has no attribute 'save'`

- [ ] **Step 3: Implement**

In `api/app/storage.py`:

- Add to `StorageBackend`:

```python
    @abc.abstractmethod
    def save(self, storage_key: str, data: bytes) -> None:
        """Write a complete file in one call (small files like the org logo)."""
```

- Add to `LocalDiskBackend` (after `write_chunk`):

```python
    def save(self, storage_key: str, data: bytes) -> None:
        path = self._key_to_path(storage_key)
        with path.open("wb") as f:
            f.write(data)
```

- Add to `LocalDiskBackend`:

```python
    backend_name = "local_disk"

    @property
    def location(self) -> str:
        return str(self._root)
```

- Add to the abstract `StorageBackend` (below `def public_url`):

```python
    @property
    def backend_name(self) -> str:
        """Short identifier for the backend (e.g. 'local_disk')."""
        return "unknown"

    @property
    def location(self) -> str:
        """Human-readable description of where files are stored."""
        return "unknown"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_storage.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/storage.py api/tests/test_storage.py
git commit -m "add save and location to the storage backend"
```

## Task A3: Branding service (name + logo persistence)

**Files:**
- Create: `api/app/services/branding.py`
- Test: `api/tests/test_branding.py` (new)

**Interfaces:**
- Consumes: `get_setting`/`set_setting` (A1), `get_storage()` with `save`/`delete`/`public_url` (A2).
- Produces: `get_branding(db) -> dict` (keys `organization_name`, `logo_url`, `logo_content_type`), `set_organization_name(db, name) -> None`, `save_logo(db, data, content_type) -> None`, `clear_logo(db) -> None`, `get_organization_name(db) -> str | None`, `is_supported_logo(content_type) -> bool`, constants `LOGO_MAX_BYTES`, `LOGO_STORAGE_KEY = "organization_logo"`, `DB_ORG_NAME`, `DB_LOGO_KEY`, `DB_LOGO_CONTENT_TYPE`. Used by A5 (router) and A6 (email org name).

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_branding.py`:

```python
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
    assert tmp_storage.retrieve("organization_logo").read_bytes() == b"\x89PNG fake"
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_branding.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.branding'`

- [ ] **Step 3: Implement**

Create `api/app/services/branding.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_branding.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/services/branding.py api/tests/test_branding.py
git commit -m "add branding service for org name and logo"
```

## Task A4: Branding schemas

**Files:**
- Modify: `api/app/schemas/setting.py`
- Test: `api/tests/test_settings.py` (modify)

**Interfaces:**
- Consumes: `to_camel` alias generator.
- Produces: `BrandingRead` (fields `organization_name: str | None`, `logo_url: str | None`, `logo_content_type: str | None`) and `BrandingUpdate` (field `organization_name: str | None = None`, where `None` = keep, `""` = clear). Used by A5.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/test_settings.py`:

```python
from app.schemas.setting import BrandingRead, BrandingUpdate


def test_branding_update_accepts_camel_case():
    payload = BrandingUpdate(organizationName="Grace Church")
    assert payload.organization_name == "Grace Church"


def test_branding_read_accepts_camel_case():
    payload = BrandingRead(
        organizationName="Grace Church",
        logoUrl="/media/organization_logo",
        logoContentType="image/png",
    )
    assert payload.organization_name == "Grace Church"
    assert payload.logo_url == "/media/organization_logo"
    assert payload.logo_content_type == "image/png"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_settings.py -q`
Expected: FAIL with `ImportError: cannot import name 'BrandingRead'`

- [ ] **Step 3: Implement**

Append to `api/app/schemas/setting.py`:

```python
class BrandingRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    organization_name: str | None
    logo_url: str | None
    logo_content_type: str | None


class BrandingUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    # None = keep current, "" = clear.
    organization_name: str | None = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_settings.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/schemas/setting.py api/tests/test_settings.py
git commit -m "add branding settings schemas"
```

## Task A5: Branding endpoints

**Files:**
- Modify: `api/app/routers/settings.py`
- Test: `api/tests/test_settings_api.py` (new)

**Interfaces:**
- Consumes: `BrandingRead`/`BrandingUpdate` (A4), branding service (A3), `get_current_user_uuid` (existing), `get_db` (existing).
- Produces: `GET /settings/branding`, `PUT /settings/branding`, `PUT /settings/branding/logo` (multipart, field name `file`), `DELETE /settings/branding/logo`. Used by A7–A9 (frontend).

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_settings_api.py`:

```python
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
    assert client.get("/settings/branding").json()["organizationName"] == "Grace Church"


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_settings_api.py -q`
Expected: FAIL with `404 Not Found` (route missing)

- [ ] **Step 3: Implement**

In `api/app/routers/settings.py`:

- Update imports:

```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
```

and

```python
from app.schemas.setting import (
    BrandingRead,
    BrandingUpdate,
    EmailSettingsRead,
    EmailSettingsUpdate,
)
from app.services.branding import (
    LOGO_MAX_BYTES,
    clear_logo,
    get_branding,
    is_supported_logo,
    save_logo,
    set_organization_name,
)
```

- Append the four endpoints (below `update_email_settings`):

```python
@router.get("/branding", response_model=BrandingRead)
def get_branding_settings(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    return get_branding(db)


@router.put("/branding", response_model=BrandingRead)
def update_branding_settings(
    payload: BrandingUpdate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    if payload.organization_name is not None:
        set_organization_name(db, payload.organization_name)
    return get_branding(db)


@router.put("/branding/logo", response_model=BrandingRead)
async def upload_branding_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    content_type = (file.content_type or "").lower()
    if not is_supported_logo(content_type):
        raise HTTPException(
            status_code=415,
            detail="Logo must be a PNG, JPEG, WebP, or SVG image.",
        )
    data = await file.read()
    if len(data) > LOGO_MAX_BYTES:
        raise HTTPException(
            status_code=413, detail="Logo must be 2 MB or smaller."
        )
    if not data:
        raise HTTPException(status_code=422, detail="Logo file is empty.")
    save_logo(db, data, content_type)
    return get_branding(db)


@router.delete("/branding/logo", response_model=BrandingRead)
def remove_branding_logo(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    clear_logo(db)
    return get_branding(db)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_settings_api.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/routers/settings.py api/tests/test_settings_api.py
git commit -m "add organization branding endpoints"
```

## Task A6: Use org name in the test-email header

**Files:**
- Modify: `api/app/services/email.py`, `api/app/routers/sermons.py`
- Test: `api/tests/test_email_render.py` (new)

**Interfaces:**
- Consumes: `get_organization_name(db)` (A3).
- Produces: `render_test_email_html(body: str, organization_name: str | None) -> str` (pure, exported for tests), `send_test_email(..., organization_name: str | None = None) -> None`. Used by the frontend indirectly via the existing test-email flow.

- [ ] **Step 1: Write the failing test**

Create `api/tests/test_email_render.py`:

```python
from app.services.email import render_test_email_html


def test_html_uses_org_name_escaped():
    html = render_test_email_html("Hello body", "Grace <Church>")
    assert "Grace &lt;Church&gt;" in html
    assert "Hello body" in html


def test_html_defaults_to_after_sunday():
    html = render_test_email_html("Hello body", None)
    assert "After Sunday" in html
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_email_render.py -q`
Expected: FAIL with `ImportError: cannot import name 'render_test_email_html'`

- [ ] **Step 3: Implement**

In `api/app/services/email.py`:

- Add the pure renderer (above `send_test_email`):

```python
def render_test_email_html(body: str, organization_name: str | None) -> str:
    org = escape(organization_name or "After Sunday")
    return (
        '<div style="font-family:Arial,sans-serif;color:#29283d;max-width:640px;">'
        f'<p style="font-size:18px;font-weight:700;color:#4f46e5;">{org}</p>'
        '<p style="color:#6b7280;font-size:12px;">Test email preview</p>'
        f"{_draft_to_html(body)}"
        '<p style="border-top:1px solid #e5e7eb;padding-top:16px;'
        f'color:#6b7280;font-size:12px;">This is a test email from {org}.</p>'
        "</div>"
    )
```

- Change `send_test_email` signature to add `organization_name: str | None = None` and replace the inline `html` dict value with `"html": render_test_email_html(body, organization_name)`.

In `api/app/routers/sermons.py`:

- Add `from app.services.branding import get_organization_name`.
- In `send_sermon_test_email`, add `organization_name=get_organization_name(db)` to the `send_test_email(...)` call.

- [ ] **Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_email_render.py tests/test_sermon_email.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/services/email.py api/app/routers/sermons.py api/tests/test_email_render.py
git commit -m "brand test emails with the organization name"
```

## Task A7: Frontend branding types + API client

**Files:**
- Modify: `web/src/types/settings.ts`, `web/src/lib/api/settings.ts`

**Interfaces:**
- Consumes: `apiFetch` (existing; skips Content-Type for FormData).
- Produces: types `BrandingSettings`, `BrandingUpdate`; functions `getBrandingSettings()`, `updateBrandingSettings(input)`, `uploadBrandingLogo(file)`, `deleteBrandingLogo()`. Used by A8 (form) and A9 (sidebar).

- [ ] **Step 1: Implement types**

Append to `web/src/types/settings.ts`:

```ts
export interface BrandingSettings {
  organizationName: string | null;
  logoUrl: string | null;
  logoContentType: string | null;
}

export interface BrandingUpdate {
  organizationName?: string;
}
```

- [ ] **Step 2: Implement the API client**

Append to `web/src/lib/api/settings.ts`:

```ts
import type {
  BrandingSettings,
  BrandingUpdate,
  EmailSettings,
  EmailSettingsUpdate,
} from "@/types/settings";

export function getBrandingSettings(): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/settings/branding");
}

export function updateBrandingSettings(
  input: BrandingUpdate,
): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/settings/branding", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function uploadBrandingLogo(file: File): Promise<BrandingSettings> {
  const body = new FormData();
  body.set("file", file);
  return apiFetch<BrandingSettings>("/settings/branding/logo", {
    method: "PUT",
    body,
  });
}

export function deleteBrandingLogo(): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/settings/branding/logo", {
    method: "DELETE",
  });
}
```

Note: merge the `EmailSettings`/`EmailSettingsUpdate` import with the existing one on line 2 of the file.

- [ ] **Step 3: Verify**

Run (from `web/`): `npm run lint && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/types/settings.ts web/src/lib/api/settings.ts
git commit -m "add branding api client and types"
```

## Task A8: Organization settings form + page wiring

**Files:**
- Create: `web/src/components/settings/OrganizationSettingsForm.tsx`
- Modify: `web/src/app/(protected)/app/settings/page.tsx`

**Interfaces:**
- Consumes: `getBrandingSettings`, `updateBrandingSettings`, `uploadBrandingLogo`, `deleteBrandingLogo` (A7); `Button`, `Card`, `useToast`.
- Produces: `OrganizationSettingsForm` — a Card with a name input, logo preview + upload + remove, and a Save button. The settings page renders it above the email card.

- [ ] **Step 1: Implement the component**

Create `web/src/components/settings/OrganizationSettingsForm.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import {
  deleteBrandingLogo,
  getBrandingSettings,
  updateBrandingSettings,
  uploadBrandingLogo,
} from "@/lib/api/settings";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { BrandingSettings } from "@/types/settings";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const inputClass =
  "mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60";

export function OrganizationSettingsForm() {
  const { toast } = useToast();
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBrandingSettings()
      .then((data) => {
        if (cancelled) return;
        setBranding(data);
        setName(data.organizationName ?? "");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load organization settings.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateBrandingSettings({
        organizationName: name.trim(),
      });
      setBranding(updated);
      toast("Organization settings saved.", "success");
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not save organization settings.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    setSaving(true);
    try {
      const updated = await uploadBrandingLogo(file);
      setBranding(updated);
      toast("Logo uploaded.", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not upload the logo.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveLogo() {
    setSaving(true);
    try {
      const updated = await deleteBrandingLogo();
      setBranding(updated);
      toast("Logo removed.", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not remove the logo.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div>
        <h2 className="text-lg font-semibold text-ink">Organization</h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Your church’s name and logo, shown in the app and used as the
          sender branding on follow-up emails.
        </p>
      </div>

      {loadError ? (
        <p role="alert" className="mt-5 text-sm font-medium text-red-600">
          {loadError}
        </p>
      ) : branding === null ? (
        <p className="mt-6 text-sm text-ink-soft">Loading settings…</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="organizationName"
              className="block text-sm font-semibold text-ink"
            >
              Organization name
            </label>
            <input
              id="organizationName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Grace Church"
              disabled={saving}
            />
          </div>

          <div>
            <span className="block text-sm font-semibold text-ink">Logo</span>
            <div className="mt-3 flex items-center gap-4">
              {branding.logoUrl ? (
                <img
                  src={`${API_BASE_URL}${branding.logoUrl}`}
                  alt="Organization logo"
                  className="h-14 w-14 rounded-full border border-edge object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-edge text-xs text-ink-soft">
                  No logo
                </span>
              )}

              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center rounded-full border border-edge bg-panel-2 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50">
                    {branding.logoUrl ? "Replace logo" : "Upload logo"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    disabled={saving}
                    onChange={(event) =>
                      handleLogoChange(event.target.files?.[0])
                    }
                  />
                </label>

                {branding.logoUrl ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRemoveLogo}
                    disabled={saving}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-soft">
              PNG, JPEG, WebP, or SVG — up to 2 MB.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Wire the page**

Replace the body of `web/src/app/(protected)/app/settings/page.tsx` with:

```tsx
import { EmailSettingsForm } from "@/components/settings/EmailSettingsForm";
import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure your church’s branding, email delivery, and storage."
      />
      <div className="max-w-2xl space-y-6">
        <OrganizationSettingsForm />
        <EmailSettingsForm />
      </div>
    </>
  );
}
```

Note: `EmailSettingsForm` already wraps itself in `max-w-2xl space-y-6`; after this change it renders inside the page wrapper, so remove the outer wrapper div inside `EmailSettingsForm` (return `<Card>…</Card>` directly) to avoid double spacing.

- [ ] **Step 3: Verify**

Run (from `web/`): `npm run lint && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/components/settings/OrganizationSettingsForm.tsx "web/src/app/(protected)/app/settings/page.tsx" web/src/components/settings/EmailSettingsForm.tsx
git commit -m "add organization settings form with logo upload"
```

## Task A9: Show org name + logo in the sidebar

**Files:**
- Modify: `web/src/components/layout/AppSidebar.tsx`

**Interfaces:**
- Consumes: `getBrandingSettings` (A7).
- Produces: sidebar header renders the org logo (if set) and org name (falling back to "After Sunday").

- [ ] **Step 1: Implement**

In `web/src/components/layout/AppSidebar.tsx`:

- Add imports:

```tsx
import { useEffect, useState } from "react";
import { getBrandingSettings } from "@/lib/api/settings";
import type { BrandingSettings } from "@/types/settings";
```

- Add state + fetch inside the component (before `return`):

```tsx
  const [branding, setBranding] = useState<BrandingSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBrandingSettings()
      .then((data) => {
        if (!cancelled) setBranding(data);
      })
      .catch(() => {
        // Branding is optional — keep the default name.
      });
    return () => {
      cancelled = true;
    };
  }, []);
```

- Replace the sidebar header block (`<Link href="/app/dashboard" className="block">…</Link>`) with:

```tsx
      <Link href="/app/dashboard" className="block">
        <div className="flex items-center gap-3">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}${branding.logoUrl}`}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <div>
            <div className="text-lg font-semibold tracking-tight text-[#34d399]">
              {branding?.organizationName || "After Sunday"}
            </div>
            <div className="mt-1 text-xs text-[#8b90ab]">
              Sermon follow-up for churches
            </div>
          </div>
        </div>
      </Link>
```

- [ ] **Step 2: Verify**

Run (from `web/`): `npm run lint && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/components/layout/AppSidebar.tsx
git commit -m "show organization name and logo in the sidebar"
```

---
---

# PART B — Upload destination visibility

## Task B1: Configurable storage root

**Files:**
- Modify: `api/app/config.py`, `api/app/storage.py`, `api/app/main.py`, `api/.env.example`
- Test: `api/tests/test_storage.py` (modify)

**Interfaces:**
- Consumes: `get_settings()` (existing).
- Produces: `Settings.storage_root: str = "storage"`; `get_storage()` builds `LocalDiskBackend(root_dir=get_settings().storage_root)`; the `/media` mount uses the same root. Used by B2.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/test_storage.py`:

```python
from app.config import Settings


def test_storage_root_default():
    assert Settings(storage_root="").storage_root == ""
```

Note: `Settings()` reads env; constructing with an explicit value avoids env interference. Also assert the default via `Settings(_env_file=None).storage_root == "storage"` (pydantic-settings allows `_env_file=None` to skip the file).

- [ ] **Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_storage.py -q`
Expected: PASS is acceptable here (the config field already has a default of `"storage"` conceptually — if it passes, verify the field exists; the real gate is Step 4 wiring). If `Settings(storage_root="")` fails because the field doesn't exist, that's the failure to confirm first.

- [ ] **Step 3: Implement**

In `api/app/config.py`, add after `secret_key`:

```python
    # Where the local-disk storage backend keeps uploaded files, relative to
    # the api/ directory. Production swaps in S3/R2 behind the same backend.
    storage_root: str = "storage"
```

In `api/app/storage.py`, change `get_storage()`:

```python
def get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        _storage = LocalDiskBackend(root_dir=get_settings().storage_root)
    return _storage
```

In `api/app/main.py`, change the `/media` mount root:

```python
from app.config import get_settings
...
_storage_root = Path(__file__).resolve().parent.parent / get_settings().storage_root
_storage_root.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_storage_root)), name="media")
```

In `api/.env.example`, add after `SECRET_KEY=`:

```env
# Where the local-disk storage backend keeps uploaded files (relative to api/).
STORAGE_ROOT=storage
```

- [ ] **Step 4: Run test + compile to verify**

Run: `source .venv/bin/activate && python -m pytest tests/test_storage.py -q && python -m compileall app`
Expected: PASS; compile clean

- [ ] **Step 5: Commit**

```bash
git add api/app/config.py api/app/storage.py api/app/main.py api/.env.example api/tests/test_storage.py
git commit -m "make the storage root configurable"
```

## Task B2: Storage info endpoint

**Files:**
- Modify: `api/app/schemas/setting.py`, `api/app/routers/settings.py`
- Test: `api/tests/test_settings_api.py` (modify)

**Interfaces:**
- Consumes: `get_storage()` with `backend_name`/`location` (A2, B1).
- Produces: `StorageRead` schema (fields `backend`, `location`, `public_base_url`); `GET /settings/storage`. Used by B3.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/test_settings_api.py`:

```python
from app.routers import settings as settings_router


def test_storage_settings(client, tmp_path, monkeypatch):
    from app.storage import LocalDiskBackend

    backend = LocalDiskBackend(root_dir=str(tmp_path))
    monkeypatch.setattr(settings_router, "get_storage", lambda: backend)

    response = client.get("/settings/storage")
    assert response.status_code == 200
    assert response.json() == {
        "backend": "local_disk",
        "location": str(tmp_path),
        "publicBaseUrl": "/media",
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_settings_api.py -q`
Expected: FAIL with `404 Not Found` (route missing)

- [ ] **Step 3: Implement**

In `api/app/schemas/setting.py`, append:

```python
class StorageRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    backend: str
    location: str
    public_base_url: str
```

In `api/app/routers/settings.py`:

- Import `StorageRead` and `get_storage`:

```python
from app.schemas.setting import StorageRead
from app.storage import get_storage
```

- Append the endpoint:

```python
@router.get("/storage", response_model=StorageRead)
def get_storage_settings(
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    storage = get_storage()
    return StorageRead(
        backend=storage.backend_name,
        location=storage.location,
        public_base_url="/media",
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_settings_api.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/schemas/setting.py api/app/routers/settings.py api/tests/test_settings_api.py
git commit -m "add storage info endpoint"
```

## Task B3: Storage info card + upload hint

**Files:**
- Create: `web/src/components/settings/StorageInfoCard.tsx`
- Modify: `web/src/types/settings.ts`, `web/src/lib/api/settings.ts`, `web/src/app/(protected)/app/settings/page.tsx`, `web/src/components/sermons/SermonForm.tsx`

**Interfaces:**
- Consumes: `get_storage_settings()` (new client fn), `StorageRead` type (new).
- Produces: `StorageInfoCard` (read-only card), `getStorageSettings()`, and an updated upload note in `SermonForm` (line ~987) pointing at Settings → Storage.

- [ ] **Step 1: Implement types + client**

Append to `web/src/types/settings.ts`:

```ts
export interface StorageSettings {
  backend: string;
  location: string;
  publicBaseUrl: string;
}
```

Append to `web/src/lib/api/settings.ts`:

```ts
import type { StorageSettings } from "@/types/settings";

export function getStorageSettings(): Promise<StorageSettings> {
  return apiFetch<StorageSettings>("/settings/storage");
}
```

- [ ] **Step 2: Implement the card**

Create `web/src/components/settings/StorageInfoCard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { getStorageSettings } from "@/lib/api/settings";
import { Card } from "@/components/ui/Card";
import type { StorageSettings } from "@/types/settings";

export function StorageInfoCard() {
  const [info, setInfo] = useState<StorageSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStorageSettings()
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load storage info.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Storage</h2>
      <p className="mt-1 text-sm leading-6 text-ink-soft">
        Where uploaded sermon recordings are stored.
      </p>

      {error ? (
        <p role="alert" className="mt-5 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : info === null ? (
        <p className="mt-6 text-sm text-ink-soft">Loading storage info…</p>
      ) : (
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-soft">Backend</dt>
            <dd className="font-medium text-ink">{info.backend}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-soft">Location</dt>
            <dd className="break-all font-mono text-xs leading-5 text-ink">
              {info.location}
            </dd>
          </div>
        </dl>
      )}

      <p className="mt-5 border-t border-edge pt-4 text-xs leading-5 text-ink-soft">
        Production deployments use cloud object storage (S3/R2) behind the
        same interface. The local location is set with the STORAGE_ROOT
        environment variable.
      </p>
    </Card>
  );
}
```

- [ ] **Step 3: Wire the page**

In `web/src/app/(protected)/app/settings/page.tsx`, import and render `<StorageInfoCard />` below `<EmailSettingsForm />`.

- [ ] **Step 4: Update the upload hint**

In `web/src/components/sermons/SermonForm.tsx` (the `MediaUploader` usage, line ~987), change the `note` string to:

```tsx
                  note="Keep this page open while your recording uploads. Files are stored on your After Sunday server — see Settings → Storage for the location."
```

- [ ] **Step 5: Verify**

Run (from `web/`): `npm run lint && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/components/settings/StorageInfoCard.tsx web/src/types/settings.ts web/src/lib/api/settings.ts "web/src/app/(protected)/app/settings/page.tsx" web/src/components/sermons/SermonForm.tsx
git commit -m "show storage destination in settings and upload flow"
```

---
---

## Task C1: Full verification + docs

**Files:**
- Modify: `docs/agent/04_ROADMAP.md`, `docs/agent/02_CURRENT_STATE.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run the full backend suite**

Run (from `api/`): `source .venv/bin/activate && alembic upgrade head && python -m pytest -q && python -m compileall app tests`
Expected: all tests PASS (existing 19 + new branding/storage/api tests); migration at head (no new migration).

- [ ] **Step 2: Run the full frontend checks**

Run (from `web/`): `npm run lint && npm run build`
Expected: PASS, with `/app/settings` still in the route list.

- [ ] **Step 3: Manual smoke test**

- Open `/app/settings` — Organization card shows name input + logo upload; Storage card shows backend `local_disk` and the absolute path; Email card unchanged.
- Set org name, upload a small PNG, confirm the sidebar shows the logo + name.
- From a sermon with a draft, send a test email and confirm the header shows the org name.

- [ ] **Step 4: Update docs**

In `docs/agent/04_ROADMAP.md`:

- Phase 10 status bullet: append `; test emails are branded with the organization name from Settings`.
- Add a Phase 5 note: `Storage destination is surfaced in Settings (backend + local path) and configurable via STORAGE_ROOT env; cloud swap-in remains future work.`

In `docs/agent/02_CURRENT_STATE.md`:

- Settings section: mention the Organization (name + logo) and Storage cards, `STORAGE_ROOT`, and that the logo is served via `/media` in dev.

- [ ] **Step 5: Commit**

```bash
git add docs/agent/04_ROADMAP.md docs/agent/02_CURRENT_STATE.md
git commit -m "document organization branding and storage visibility"
```

---
---

## Self-Review

**1. Spec coverage**
- "In settings, add organization name and logo" → A3 (service), A4 (schemas), A5 (endpoints), A8 (form), A9 (sidebar), A6 (email branding).
- "Easy to see where we are uploading to" → B1 (configurable root), B2 (endpoint), B3 (Storage card + upload hint).
- No gaps. The only deliberate omission: the logo is not embedded inside test emails (dev `/media` URLs aren't public); the email uses the org *name* only, which matches the ask ("organization name and logo" in Settings, not "logo in emails").

**2. Placeholder scan**
- Every code step contains full code blocks. The one judgment call — the `Settings(storage_root="")` test in B1 — is fully specified with its fallback expectation. No TBD/TODO anywhere.

**3. Type consistency**
- `get_setting`/`set_setting` names match across A1 → A3 → email refactor.
- `LOGO_STORAGE_KEY = "organization_logo"` is the single source of truth in A3 and matches the public URL asserted in A5/B2 tests (`/media/organization_logo`).
- Frontend: `BrandingSettings` fields (`organizationName`, `logoUrl`, `logoContentType`) match the camelCase `BrandingRead` output. `StorageSettings` (`backend`, `location`, `publicBaseUrl`) matches `StorageRead`.
- `send_test_email(..., organization_name=...)` — the only caller is `send_sermon_test_email` in sermons.py; both updated in A6.
- `backend_name` / `location` added to the abstract backend and implemented in `LocalDiskBackend` before B2 consumes them.

**4. Cross-cutting notes**
- No migration required — `app_settings` already exists (0013).
- TestClient tests override `get_db` and `get_current_user_uuid`; `TestClient(app)` is created without a context manager so the transcription-worker lifespan doesn't start.
