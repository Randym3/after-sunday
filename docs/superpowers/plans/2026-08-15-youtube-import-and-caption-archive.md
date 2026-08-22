# YouTube Import and Caption Archive Implementation Plan

> **STATUS NOTE (2026-08-15):** Execution of this plan was started by mistake —
> the user asked to "start the project", meaning *spin up the dev servers*, not
> execute the plan. Tasks 1–4 (service, deps, preview endpoint, migration 0014)
> were implemented and committed, then fully reverted: git reset to `7d1a370`,
> DB downgraded from `0014` back to `0013_create_app_settings`, and the
> `yt-dlp` / `youtube-transcript-api` pip packages removed. The plan is
> **unstarted** as of this note; nothing in it is on disk. Execution should
> begin at Task 1 when the user actually asks for it.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let church staff paste YouTube links instead of uploading recordings, prefill sermon fields from the video's public metadata, and import the video's auto-captions in the background so the app builds a searchable archive of past sermons with zero transcription cost.

**Architecture:** Two new backend services behind the existing service-boundary pattern — `api/app/services/youtube.py` for metadata + caption retrieval, plus a `POST /youtube/preview` endpoint for the form — and a caption-import path that reuses the existing `transcription_jobs` table and background worker (`job.provider == "youtube_captions"`). A CLI script (`api/scripts/import_youtube_archive.py`) bulk-imports a whole channel through the same helpers. The frontend create form calls the preview endpoint when a URL is pasted, prefills title/date/scripture, and shows a video preview card; the workspace already polls transcript status, so a finished caption import appears with no new UI plumbing.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (existing), `yt-dlp` for public metadata (no API key), `youtube-transcript-api` for auto-captions, React/Next.js create form (existing). No new frontend dependencies, no new API keys.

## Global Constraints

- Backend-only dependency additions: `yt-dlp` and `youtube-transcript-api`, pinned to the resolved versions in `api/requirements.txt` (match existing `name==version` style).
- No new frontend dependencies; the preview call reuses `apiFetch` from `web/src/lib/api/client.ts`.
- No new API keys: metadata comes from `yt-dlp`, captions from `youtube-transcript-api`. The services keep the swap to YouTube Data API v3 (an `api_key`/OAuth path) possible without touching routers or the worker.
- Import only from the church's own channel (the user's stated use case). Note in docs that automated caption scraping sits in a gray area of YouTube ToS; captions are imported as-is and never auto-sent.
- Caption import is background-only (`transcription_jobs` worker). Request handlers never block on YouTube network calls except `POST /youtube/preview`, which is user-initiated.
- Tests never hit the network: all `yt-dlp` / `youtube-transcript-api` calls are monkeypatched.
- No DB migrations beyond `0014`; existing tables (`sermons`, `transcription_jobs`) are reused.

---

## Part A — Metadata service and preview endpoint

### Task 1: YouTube URL parsing and scripture detection

**Files:**
- Create: `api/app/services/youtube.py`
- Modify: `api/tests/conftest.py` (register sermon + transcription_job models)
- Test: `api/tests/test_youtube.py`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces:
  - `parse_youtube_video_id(url: str) -> str | None` — 11-char video id from `watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `live/` URLs.
  - `detect_scripture_reference(text: str) -> str | None` — e.g. `"Psalm 23"`, `"John 3:16"`, `"1 John 1:9"`, or `None`.
  - Module-level `YOUTUBE_URL_RE`, `_BOOK_RE`, `_BOOKS` (used by later tasks).

- [ ] **Step 1: Update conftest so sermon/job tables exist in the test DB**

Replace the model registration in `api/tests/conftest.py`:

```python
from app.models import setting  # noqa: F401 — registers app_settings in metadata
from app.models import sermon  # noqa: F401 — registers sermons in metadata
from app.models import transcription_job  # noqa: F401 — registers jobs in metadata
```

- [ ] **Step 2: Write the failing tests**

Create `api/tests/test_youtube.py`:

```python
from app.services.youtube import detect_scripture_reference, parse_youtube_video_id


def test_parse_watch_url():
    assert (
        parse_youtube_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        == "dQw4w9WgXcQ"
    )


def test_parse_watch_url_with_extra_params():
    assert (
        parse_youtube_video_id(
            "https://www.youtube.com/watch?t=30&v=dQw4w9WgXcQ&feature=share"
        )
        == "dQw4w9WgXcQ"
    )


def test_parse_short_url():
    assert parse_youtube_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_parse_shorts_embed_live():
    assert (
        parse_youtube_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ")
        == "dQw4w9WgXcQ"
    )
    assert (
        parse_youtube_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ")
        == "dQw4w9WgXcQ"
    )
    assert (
        parse_youtube_video_id("https://www.youtube.com/live/dQw4w9WgXcQ")
        == "dQw4w9WgXcQ"
    )


def test_parse_rejects_non_youtube():
    assert parse_youtube_video_id("https://example.com/video?id=1") is None
    assert parse_youtube_video_id("") is None
    assert parse_youtube_video_id(None) is None


def test_detect_scripture_reference():
    assert (
        detect_scripture_reference("Sunday service — Psalm 23, the Lord is my shepherd")
        == "Psalm 23"
    )
    assert detect_scripture_reference("John 3:16 — For God so loved the world") == "John 3:16"
    assert detect_scripture_reference("1 John 1:9 sermon") == "1 John 1:9"
    assert detect_scripture_reference("Church announcements and testimonies") is None
    assert detect_scripture_reference("") is None
```

- [ ] **Step 3: Run to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.youtube'`.

- [ ] **Step 4: Implement the service**

Create `api/app/services/youtube.py`:

```python
"""YouTube import services: metadata + auto-caption retrieval.

Kept behind small functions so an official YouTube Data API implementation
can replace yt-dlp / youtube-transcript-api later without touching routers
or the transcription worker.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timezone

import yt_dlp
from sqlalchemy import select
from sqlalchemy.orm import Session
from youtube_transcript_api import YouTubeTranscriptApi

from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob
from app.services.transcription import _paragraphize_text

# watch?v= (params may precede v=), youtu.be/ID, shorts/, embed/, live/.
YOUTUBE_URL_RE = re.compile(
    r"(?:youtube\.com/watch\?[^#]*v=|youtube\.com/(?:shorts|embed|live)/|youtu\.be/)([\w-]{11})"
)

_BOOKS = (
    "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|"
    "1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|"
    "Nehemiah|Esther|Job|Psalms|Psalm|Proverbs|Ecclesiastes|Song of Solomon|"
    "Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|"
    "Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|"
    "Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|"
    "Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|"
    "1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|"
    "1 John|2 John|3 John|Jude|Revelation"
)
_BOOK_RE = re.compile(
    rf"\b(?:1|2|3)\s?({_BOOKS})\s+(\d{{1,3}})(?::(\d{{1,3}}))?\b",
    re.IGNORECASE,
)


def parse_youtube_video_id(url: str | None) -> str | None:
    """Return the 11-char YouTube video id from a URL, or None."""
    if not url:
        return None
    match = YOUTUBE_URL_RE.search(url.strip())
    return match.group(1) if match else None


def detect_scripture_reference(text: str | None) -> str | None:
    """Return a bible reference (e.g. ``Psalm 23``) found in *text*, or None."""
    if not text:
        return None
    match = _BOOK_RE.search(text)
    if not match:
        return None
    book = match.group(1)
    # Normalize the matched book casing, then re-apply the ordinal prefix.
    normalized = next(
        (b for b in _BOOKS.split("|") if b.lower() == book.lower()), book
    )
    reference = f"{normalized} {match.group(2)}"
    if match.group(3):
        reference += f":{match.group(3)}"
    return reference


@dataclass
class VideoMetadata:
    video_id: str
    title: str
    upload_date: date | None
    channel_name: str | None
    thumbnail_url: str | None
    description: str | None
    duration_seconds: int | None
    scripture_reference: str | None


def fetch_video_metadata(url: str) -> VideoMetadata:
    """Fetch public metadata for a YouTube video via yt-dlp."""
    opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url.strip(), download=False)

    video_id = info.get("id") or parse_youtube_video_id(url) or ""
    upload = info.get("upload_date")  # YYYYMMDD
    try:
        upload_date = datetime.strptime(upload, "%Y%m%d").date() if upload else None
    except ValueError:
        upload_date = None

    title = str(info.get("title") or "").strip()
    description = info.get("description")
    scripture = detect_scripture_reference(f"{title}\n{description or ''}")

    return VideoMetadata(
        video_id=video_id,
        title=title,
        upload_date=upload_date,
        channel_name=info.get("channel") or info.get("uploader"),
        thumbnail_url=info.get("thumbnail"),
        description=description,
        duration_seconds=info.get("duration"),
        scripture_reference=scripture,
    )
```

- [ ] **Step 5: Run to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube.py -q`
Expected: PASS (note: importing `app.services.youtube` requires `yt-dlp` and `youtube-transcript-api` — Task 2 pins them, so if this fails on import, install them now with `pip install yt-dlp youtube-transcript-api` and continue).

- [ ] **Step 6: Commit**

```bash
git add api/app/services/youtube.py api/tests/conftest.py api/tests/test_youtube.py
git commit -m "feat: add youtube url parsing and scripture detection"
```

---

### Task 2: Pin the new dependencies

**Files:**
- Modify: `api/requirements.txt`

- [ ] **Step 1: Install and pin**

Run: `source .venv/bin/activate && pip install yt-dlp youtube-transcript-api`
Run: `source .venv/bin/activate && pip freeze | grep -iE '^(yt-dlp|youtube-transcript-api)=='

Then add both lines (with the resolved versions) to `api/requirements.txt`, keeping the existing alphabetical `name==version` style:

```txt
youtube-transcript-api==<resolved-version>
yt-dlp==<resolved-version>
```

- [ ] **Step 2: Verify the suite still imports**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube.py -q`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/requirements.txt
git commit -m "chore: add yt-dlp and youtube-transcript-api"
```

---

### Task 3: POST /youtube/preview endpoint

**Files:**
- Create: `api/app/routers/youtube.py`
- Modify: `api/app/main.py`
- Test: `api/tests/test_youtube_api.py`

**Interfaces:**
- Consumes: `fetch_video_metadata(url) -> VideoMetadata`, `parse_youtube_video_id(url)` from Task 1; `get_current_user_uuid` from `app.auth`.
- Produces: `POST /youtube/preview` — request `{"url": str}`, response fields (camelCase): `videoId`, `title`, `uploadDate`, `channelName`, `thumbnailUrl`, `description`, `durationSeconds`, `scriptureReference`. Errors: 422 for a non-YouTube URL or a fetch failure.

- [ ] **Step 1: Write the failing tests**

Create `api/tests/test_youtube_api.py`:

```python
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user_uuid
from app.db import get_db
from app.main import app


@pytest.fixture
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_uuid] = lambda: uuid.uuid4()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_preview_returns_metadata(client, monkeypatch):
    from app.services.youtube import VideoMetadata

    fake = VideoMetadata(
        video_id="dQw4w9WgXcQ",
        title="Sunday Service — Psalm 23",
        upload_date=None,  # set below via strptime-free literal date
        channel_name="Grace Church",
        thumbnail_url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        description="Join us for worship.",
        duration_seconds=2760,
        scripture_reference="Psalm 23",
    )
    # upload_date is a date, not a string — build it here to avoid imports in the dataclass default.
    from datetime import date

    fake.upload_date = date(2026, 8, 9)

    monkeypatch.setattr(
        "app.routers.youtube.fetch_video_metadata", lambda url: fake
    )

    response = client.post("/youtube/preview", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
    assert response.status_code == 200
    body = response.json()
    assert body["videoId"] == "dQw4w9WgXcQ"
    assert body["title"] == "Sunday Service — Psalm 23"
    assert body["uploadDate"] == "2026-08-09"
    assert body["channelName"] == "Grace Church"
    assert body["scriptureReference"] == "Psalm 23"


def test_preview_rejects_non_youtube_url(client):
    response = client.post(
        "/youtube/preview", json={"url": "https://example.com/not-a-video"}
    )
    assert response.status_code == 422


def test_preview_reports_fetch_failure(client, monkeypatch):
    def boom(url):
        raise yt_dlp.utils.DownloadError("Video unavailable")

    import yt_dlp

    monkeypatch.setattr("app.routers.youtube.fetch_video_metadata", boom)

    response = client.post(
        "/youtube/preview", json={"url": "https://youtu.be/aaaaaaaaaaa"}
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube_api.py -q`
Expected: FAIL with 404 (router not mounted).

- [ ] **Step 3: Implement the router**

Create `api/app/routers/youtube.py`:

```python
import uuid
from dataclasses import asdict
from datetime import date

import yt_dlp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from app.auth import get_current_user_uuid
from app.schemas.aliases import to_camel
from app.services.youtube import fetch_video_metadata, parse_youtube_video_id

router = APIRouter(prefix="/youtube", tags=["youtube"])


class YoutubePreviewRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    url: str


class YoutubePreviewRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    video_id: str
    title: str
    upload_date: date | None
    channel_name: str | None
    thumbnail_url: str | None
    description: str | None
    duration_seconds: int | None
    scripture_reference: str | None


@router.post("/preview", response_model=YoutubePreviewRead)
def preview_youtube_video(
    payload: YoutubePreviewRequest,
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    """Fetch public metadata for a YouTube URL (used to prefill the form)."""
    if not parse_youtube_video_id(payload.url):
        raise HTTPException(
            status_code=422, detail="That doesn't look like a YouTube video URL."
        )
    try:
        meta = fetch_video_metadata(payload.url)
    except yt_dlp.utils.DownloadError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not load that video — check the URL and try again.",
        ) from exc
    return YoutubePreviewRead(**asdict(meta))
```

Mount it in `api/app/main.py` — add `youtube` to the router import and include it:

```python
from app.routers import campaigns, groups, members, sermons, settings, youtube
```

```python
app.include_router(youtube.router)
```

- [ ] **Step 4: Run to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube_api.py -q`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/app/routers/youtube.py api/app/main.py api/tests/test_youtube_api.py
git commit -m "feat: add youtube metadata preview endpoint"
```

---

## Part B — Caption import through the worker

### Task 4: Sermon model columns + migration 0014

**Files:**
- Modify: `api/app/models/sermon.py`
- Create: `api/alembic/versions/0014_add_youtube_metadata.py`
- Modify: `api/app/schemas/sermon.py`
- Test: `api/tests/test_youtube.py` (add a schema round-trip test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Sermon.youtube_video_id: str | None`, `Sermon.youtube_thumbnail_url: str | None`, `Sermon.youtube_fetched_at: datetime | None`; `SermonRead` exposes `youtube_video_id`, `youtube_thumbnail_url`, `youtube_fetched_at`.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/test_youtube.py`:

```python
import uuid

from app.schemas.sermon import SermonRead


def test_sermon_read_includes_youtube_fields(db_session):
    from app.models.sermon import Sermon

    sermon = Sermon(
        created_by_user_id=uuid.uuid4(),
        title="Psalm 23",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_video_id="dQw4w9WgXcQ",
        youtube_thumbnail_url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    )
    db_session.add(sermon)
    db_session.commit()

    read = SermonRead.model_validate(sermon)
    assert read.youtube_video_id == "dQw4w9WgXcQ"
    assert read.youtube_thumbnail_url is not None
```

- [ ] **Step 2: Run to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube.py -q`
Expected: FAIL (`AttributeError: youtube_video_id`).

- [ ] **Step 3: Add the model columns**

In `api/app/models/sermon.py`, after the `media_content_type` column:

```python
    youtube_video_id: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True
    )
    youtube_thumbnail_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    youtube_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

- [ ] **Step 4: Add the migration**

Create `api/alembic/versions/0014_add_youtube_metadata.py`:

```python
"""add youtube metadata columns to sermons

Revision ID: 0014_add_youtube_metadata
Revises: 0013_create_app_settings
Create Date: 2026-08-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_add_youtube_metadata"
down_revision = "0013_create_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sermons", sa.Column("youtube_video_id", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "sermons",
        sa.Column("youtube_thumbnail_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "sermons",
        sa.Column("youtube_fetched_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_sermons_youtube_video_id", "sermons", ["youtube_video_id"])


def downgrade() -> None:
    op.drop_index("ix_sermons_youtube_video_id", table_name="sermons")
    op.drop_column("sermons", "youtube_fetched_at")
    op.drop_column("sermons", "youtube_thumbnail_url")
    op.drop_column("sermons", "youtube_video_id")
```

- [ ] **Step 5: Update the read schema**

In `api/app/schemas/sermon.py` `SermonRead`, after `media_content_type`:

```python
    youtube_video_id: str | None
    youtube_thumbnail_url: str | None
    youtube_fetched_at: datetime | None
```

- [ ] **Step 6: Apply the migration and run the tests**

Run: `source .venv/bin/activate && alembic upgrade head && python -m pytest tests/test_youtube.py -q`
Expected: migration applies; PASS.

- [ ] **Step 7: Commit**

```bash
git add api/app/models/sermon.py api/alembic/versions/0014_add_youtube_metadata.py api/app/schemas/sermon.py api/tests/test_youtube.py
git commit -m "feat: store youtube video metadata on sermons"
```

---

### Task 5: Auto-caption fetch

**Files:**
- Modify: `api/app/services/youtube.py`
- Test: `api/tests/test_youtube.py` (append)

**Interfaces:**
- Consumes: `_paragraphize_text` from `app.services.transcription` (already imported in Task 1).
- Produces: `fetch_auto_captions(video_id: str, preferred_languages: tuple[str, ...] = ("en", "en-US", "en-GB")) -> str` — raises `RuntimeError` when no captions exist.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/test_youtube.py`:

```python
from app.services.youtube import fetch_auto_captions


class FakeTranscript:
    def fetch(self):
        return [
            {"text": "Hello church,", "start": 0.0, "duration": 2.0},
            {"text": "please open with me to Psalm 23.", "start": 2.0, "duration": 3.0},
        ]


class FakeTranscriptList:
    def find_manually_created_transcript(self, languages):
        raise RuntimeError("no manual transcript")

    def find_generated_transcript(self, languages):
        assert languages == ["en", "en-US", "en-GB"]
        return FakeTranscript()


class FakeYouTubeTranscriptApi:
    @staticmethod
    def list_transcripts(video_id):
        assert video_id == "dQw4w9WgXcQ"
        return FakeTranscriptList()


def test_fetch_auto_captions_returns_paragraphized_text(monkeypatch):
    monkeypatch.setattr(
        "app.services.youtube.YouTubeTranscriptApi", FakeYouTubeTranscriptApi
    )
    text = fetch_auto_captions("dQw4w9WgXcQ")
    assert "Hello church, please open with me to Psalm 23." in text


def test_fetch_auto_captions_raises_when_missing(monkeypatch):
    class NoTranscripts:
        def find_manually_created_transcript(self, languages):
            raise RuntimeError("none")

        def find_generated_transcript(self, languages):
            raise RuntimeError("none")

    class FakeApiNoTranscripts:
        @staticmethod
        def list_transcripts(video_id):
            return NoTranscripts()

    monkeypatch.setattr(
        "app.services.youtube.YouTubeTranscriptApi", FakeApiNoTranscripts
    )
    try:
        fetch_auto_captions("dQw4w9WgXcQ")
        assert False, "expected RuntimeError"
    except RuntimeError as exc:
        assert "No English captions" in str(exc)
```

- [ ] **Step 2: Run to verify it fails**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube.py -q`
Expected: FAIL (`ImportError` / `AttributeError: fetch_auto_captions`).

- [ ] **Step 3: Implement**

Append to `api/app/services/youtube.py`:

```python
def fetch_auto_captions(
    video_id: str,
    preferred_languages: tuple[str, ...] = ("en", "en-US", "en-GB"),
) -> str:
    """Fetch the video's captions (manual preferred, then auto-generated)."""
    transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
    languages = list(preferred_languages)

    try:
        transcript = transcript_list.find_manually_created_transcript(languages)
    except Exception:
        try:
            transcript = transcript_list.find_generated_transcript(languages)
        except Exception as exc:
            raise RuntimeError(
                f"No English captions available for video {video_id}."
            ) from exc

    lines = transcript.fetch()
    text = " ".join(
        (line.get("text") or "").strip()
        for line in lines
        if line.get("text", "").strip()
    )
    if not text.strip():
        raise RuntimeError(f"Captions for video {video_id} were empty.")
    return _paragraphize_text(text)
```

- [ ] **Step 4: Run to verify it passes**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/services/youtube.py api/tests/test_youtube.py
git commit -m "feat: fetch youtube auto-captions as transcripts"
```

---

### Task 6: Queue caption import on sermon create (+ retry endpoint)

**Files:**
- Modify: `api/app/services/youtube.py` (queue helper)
- Modify: `api/app/routers/sermons.py` (create + transcribe branches)
- Test: `api/tests/test_youtube_api.py` (append)

**Interfaces:**
- Consumes: `parse_youtube_video_id` (Task 1), `TranscriptionJob`, `Sermon`.
- Produces:
  - `queue_youtube_caption_import(db: Session, sermon: Sermon) -> TranscriptionJob` — sets `transcript_status="queued"`, clears prior transcript/draft, upserts the sermon's `TranscriptionJob` with `provider="youtube_captions"`.
  - `apply_youtube_source(db: Session, sermon: Sermon, url: str) -> None` — parses the id, sets `youtube_video_id` + `youtube_fetched_at`, then queues caption import. Raises `ValueError` for a bad URL.
  - Create endpoint now parses `youtube_url` server-side and queues captions (unless a transcript was supplied).
  - `POST /sermons/{id}/transcribe` re-queues captions when `source_type == "youtube"`.

- [ ] **Step 1: Write the failing tests**

Append to `api/tests/test_youtube_api.py`:

```python
from sqlalchemy import select

from app.models.transcription_job import TranscriptionJob


def test_create_youtube_sermon_queues_caption_job(client, db_session):
    response = client.post(
        "/sermons",
        json={
            "title": "Psalm 23",
            "sourceType": "youtube",
            "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["youtubeVideoId"] == "dQw4w9WgXcQ"
    assert body["transcriptStatus"] == "queued"

    job = db_session.scalars(select(TranscriptionJob)).first()
    assert job is not None
    assert job.provider == "youtube_captions"
    assert job.status == "queued"


def test_create_youtube_sermon_with_transcript_skips_captions(client, db_session):
    response = client.post(
        "/sermons",
        json={
            "title": "Psalm 23",
            "sourceType": "youtube",
            "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
            "transcript": "A provided transcript.",
        },
    )
    assert response.status_code == 201
    assert response.json()["transcriptStatus"] == "ready"
    assert db_session.scalars(select(TranscriptionJob)).first() is None


def test_create_youtube_sermon_rejects_bad_url(client):
    response = client.post(
        "/sermons",
        json={
            "title": "Bad",
            "sourceType": "youtube",
            "youtubeUrl": "https://example.com/not-youtube",
        },
    )
    assert response.status_code == 422


def test_transcribe_youtube_sermon_requeues_captions(client, db_session):
    created = client.post(
        "/sermons",
        json={
            "title": "Retry me",
            "sourceType": "youtube",
            "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
        },
    ).json()
    sermon_id = created["id"]

    response = client.post(f"/sermons/{sermon_id}/transcribe")
    assert response.status_code == 200
    assert response.json()["transcriptStatus"] == "queued"
```

- [ ] **Step 2: Run to verify they fail**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube_api.py -q`
Expected: FAIL (create returns 201 but `youtubeVideoId` is null / no job row).

- [ ] **Step 3: Implement the queue helpers**

Append to `api/app/services/youtube.py`:

```python
def queue_youtube_caption_import(db: Session, sermon: Sermon) -> TranscriptionJob:
    """Create/reuse the sermon's transcription job for caption import."""
    job = db.scalars(
        select(TranscriptionJob).where(TranscriptionJob.sermon_id == sermon.id)
    ).first()
    if job is None:
        job = TranscriptionJob(
            id=sermon.id,
            sermon_id=sermon.id,
            provider="youtube_captions",
            status="queued",
        )
        db.add(job)
    else:
        job.provider = "youtube_captions"
        job.status = "queued"
        job.result_text = None
        job.error_message = None
        job.started_at = None
        job.completed_at = None

    # A fresh caption import replaces the old transcript + draft.
    sermon.transcript = None
    sermon.transcript_error = None
    sermon.transcript_status = "queued"
    sermon.follow_up_subject = None
    sermon.follow_up_body = None
    sermon.ai_draft_status = "not_started"
    sermon.email_status = "not_started"
    return job


def apply_youtube_source(db: Session, sermon: Sermon, url: str) -> None:
    """Resolve the video id from *url* and queue caption import.

    Raises ValueError when the URL is not a YouTube video URL.
    """
    video_id = parse_youtube_video_id(url)
    if not video_id:
        raise ValueError("That doesn't look like a YouTube video URL.")
    sermon.youtube_video_id = video_id
    sermon.youtube_fetched_at = datetime.now(timezone.utc)
    queue_youtube_caption_import(db, sermon)
```

- [ ] **Step 4: Wire the create endpoint**

In `api/app/routers/sermons.py`:

- Add the import next to the other service imports:

```python
from app.services.youtube import apply_youtube_source
```

- Replace the body of `create_sermon` from `db.add(sermon)` onward:

```python
    db.add(sermon)
    db.flush()

    # YouTube sermons get their captions imported in the background; skip
    # when the user already supplied a transcript.
    if (
        payload.source_type == "youtube"
        and not (payload.transcript and payload.transcript.strip())
    ):
        if not payload.youtube_url:
            raise HTTPException(
                status_code=422, detail="A YouTube URL is required."
            )
        try:
            apply_youtube_source(db, sermon, payload.youtube_url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    db.commit()
    db.refresh(sermon)
    return sermon
```

- [ ] **Step 5: Wire the retry branch in `transcribe_sermon`**

Insert at the top of the `transcribe_sermon` function body (before the `media_storage_key` check):

```python
    if sermon.source_type == "youtube":
        # Re-queue the caption import (e.g. after a failed fetch).
        if not sermon.source_url:
            raise HTTPException(
                status_code=400,
                detail="This sermon has no YouTube URL.",
            )
        apply_youtube_source(db, sermon, sermon.source_url)
        db.commit()
        db.refresh(sermon)
        return sermon
```

- [ ] **Step 6: Run to verify they pass**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube_api.py -q`
Expected: PASS (all 4 new tests + 3 preview tests).

- [ ] **Step 7: Commit**

```bash
git add api/app/services/youtube.py api/app/routers/sermons.py api/tests/test_youtube_api.py
git commit -m "feat: queue youtube caption import on sermon create"
```

---

### Task 7: Worker branch for caption jobs

**Files:**
- Modify: `api/app/services/transcription.py`
- Test: `api/tests/test_transcription_worker.py` (create)

**Interfaces:**
- Consumes: `fetch_auto_captions`, `parse_youtube_video_id` from `app.services.youtube` (imported lazily inside the branch).
- Produces: `_process_transcription_job(db: Session, job: TranscriptionJob, provider: TranscriptionProvider) -> None` — the per-job body extracted from the worker loop, now branching on `job.provider == "youtube_captions"`. `run_transcription_worker` keeps its signature.

- [ ] **Step 1: Write the failing tests**

Create `api/tests/test_transcription_worker.py`:

```python
import asyncio
import uuid

from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob
from app.services.transcription import _process_transcription_job, build_provider


def test_youtube_caption_job_writes_transcript(db_session, monkeypatch):
    sermon = Sermon(
        created_by_user_id=uuid.uuid4(),
        title="Psalm 23",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_video_id="dQw4w9WgXcQ",
        transcript_status="processing",
    )
    db_session.add(sermon)
    db_session.commit()

    job = TranscriptionJob(
        id=sermon.id,
        sermon_id=sermon.id,
        provider="youtube_captions",
        status="processing",
    )
    db_session.add(job)
    db_session.commit()

    async def fake_fetch(video_id: str) -> str:
        assert video_id == "dQw4w9WgXcQ"
        return "Caption line one. Caption line two."

    monkeypatch.setattr("app.services.youtube.fetch_auto_captions", fake_fetch)

    asyncio.run(_process_transcription_job(db_session, job, build_provider()))

    db_session.refresh(sermon)
    db_session.refresh(job)
    assert sermon.transcript_status == "ready"
    assert "Caption line one." in sermon.transcript
    assert job.status == "completed"


def test_youtube_caption_job_failure_records_error(db_session, monkeypatch):
    sermon = Sermon(
        created_by_user_id=uuid.uuid4(),
        title="No captions",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=abcdefghijk",
        youtube_video_id="abcdefghijk",
        transcript_status="processing",
    )
    db_session.add(sermon)
    db_session.commit()

    job = TranscriptionJob(
        id=sermon.id,
        sermon_id=sermon.id,
        provider="youtube_captions",
        status="processing",
    )
    db_session.add(job)
    db_session.commit()

    async def bad_fetch(video_id: str) -> str:
        raise RuntimeError("No English captions available for video abcdefghijk")

    monkeypatch.setattr("app.services.youtube.fetch_auto_captions", bad_fetch)

    asyncio.run(_process_transcription_job(db_session, job, build_provider()))

    db_session.refresh(sermon)
    db_session.refresh(job)
    assert sermon.transcript_status == "failed"
    assert "No English captions" in sermon.transcript_error
    assert job.status == "failed"
```

- [ ] **Step 2: Run to verify they fail**

Run: `source .venv/bin/activate && python -m pytest tests/test_transcription_worker.py -q`
Expected: FAIL with `ImportError: cannot import name '_process_transcription_job'`.

- [ ] **Step 3: Extract the per-job body and add the branch**

In `api/app/services/transcription.py`, replace the whole `run_transcription_worker` function (and add `_process_transcription_job` above it) with:

```python
async def _process_transcription_job(
    db: Session,
    job: TranscriptionJob,
    provider: TranscriptionProvider,
) -> None:
    """Run one queued job to completion (or failure).

    Extracted from the worker loop so tests can drive a single job without
    an infinite poll loop. Branches on job.provider: ``youtube_captions``
    imports a YouTube transcript instead of transcribing a media file.
    """
    sermon = db.get(Sermon, job.sermon_id)
    if sermon is None:
        job.status = "failed"
        job.error_message = "Sermon row deleted before transcription started."
        db.commit()
        return

    sermon.transcript_status = "processing"
    db.commit()

    try:
        if job.provider == "youtube_captions":
            from app.services.youtube import (
                fetch_auto_captions,
                parse_youtube_video_id,
            )

            video_id = sermon.youtube_video_id
            if not video_id and sermon.source_url:
                video_id = parse_youtube_video_id(sermon.source_url)
            if not video_id:
                raise RuntimeError(
                    "No YouTube video id available for caption import."
                )
            transcript = await fetch_auto_captions(video_id)
        else:
            from app.storage import get_storage

            path = get_storage().retrieve(sermon.media_storage_key)
            if path is None or isinstance(path, bytes):
                raise FileNotFoundError(
                    f"Media file not found for key {sermon.media_storage_key}"
                )
            transcript = await provider.transcribe(
                path, original_filename=sermon.media_file_name
            )

        job.result_text = transcript
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)

        sermon.transcript = transcript
        sermon.transcript_status = "ready"
        db.commit()
        print(f"[transcribe] Job {job.id} completed")

    except Exception as exc:
        import traceback

        tb = traceback.format_exc()
        print(f"[transcribe] Job failed: {tb}")
        err_msg = str(exc) or type(exc).__name__
        job.status = "failed"
        job.error_message = tb
        sermon.transcript_status = "failed"
        sermon.transcript_error = err_msg
        db.commit()


async def run_transcription_worker(
    provider: TranscriptionProvider,
    poll_interval: float = 2.0,
) -> None:
    """Poll for queued transcription jobs and process them.

    Intended to run as a background asyncio task for the lifetime of the
    server. Each job gets its own database session and is committed
    independently so a single failure doesn't block the queue.
    """
    print(f"[transcribe] Worker started (provider={type(provider).__name__})")

    while True:
        try:
            await asyncio.sleep(poll_interval)

            db = SessionLocal()
            try:
                job = db.scalars(
                    select(TranscriptionJob)
                    .where(TranscriptionJob.status == "queued")
                    .limit(1)
                ).first()

                if job is None:
                    continue

                # Mark processing.
                job.status = "processing"
                job.started_at = datetime.now(timezone.utc)
                db.commit()

                await _process_transcription_job(db, job, provider)
            finally:
                db.close()

        except Exception:
            import traceback

            print(f"[transcribe] Worker loop error: {traceback.format_exc()}")
            await asyncio.sleep(poll_interval)
```

- [ ] **Step 4: Run to verify they pass**

Run: `source .venv/bin/activate && python -m pytest tests/test_transcription_worker.py -q`
Expected: PASS.

- [ ] **Step 5: Run the full suite (worker refactor regression)**

Run: `source .venv/bin/activate && python -m pytest -q`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add api/app/services/transcription.py api/tests/test_transcription_worker.py
git commit -m "feat: import youtube captions through the transcription worker"
```

---

## Part C — Frontend: paste → prefill

### Task 8: Frontend types and API client

**Files:**
- Modify: `web/src/types/sermon.ts`
- Create: `web/src/lib/api/youtube.ts`

**Interfaces:**
- Consumes: `apiFetch` from `web/src/lib/api/client.ts`.
- Produces:
  - `Sermon` gains `youtubeVideoId?: string | null`, `youtubeThumbnailUrl?: string | null`, `youtubeFetchedAt?: string | null`.
  - `previewYoutubeVideo(url: string): Promise<YoutubePreview>` and `interface YoutubePreview { videoId; title; uploadDate; channelName; thumbnailUrl; description; durationSeconds; scriptureReference }`.

- [ ] **Step 1: Update the sermon type**

In `web/src/types/sermon.ts` `Sermon` interface, after `sourceUrl`:

```ts
  youtubeVideoId?: string | null;
  youtubeThumbnailUrl?: string | null;
  youtubeFetchedAt?: string | null;
```

- [ ] **Step 2: Create the API client**

Create `web/src/lib/api/youtube.ts`:

```ts
import { apiFetch } from "@/lib/api/client";

export interface YoutubePreview {
  videoId: string;
  title: string;
  uploadDate: string | null;
  channelName: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  durationSeconds: number | null;
  scriptureReference: string | null;
}

export function previewYoutubeVideo(url: string): Promise<YoutubePreview> {
  return apiFetch<YoutubePreview>("/youtube/preview", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
```

- [ ] **Step 3: Verify**

Run: `cd web && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/types/sermon.ts web/src/lib/api/youtube.ts
git commit -m "feat: add youtube preview api client and sermon fields"
```

---

### Task 9: Create form prefill + preview card

**Files:**
- Modify: `web/src/components/sermons/SermonForm.tsx`

**Interfaces:**
- Consumes: `previewYoutubeVideo` + `YoutubePreview` from Task 8; the existing `flash`/`flashTimeoutRef` state already in `SermonForm`.
- Produces: when the YouTube source is selected and a URL is entered, the form (debounced 600ms) fetches metadata, prefills only empty `title` / `preachedAt` / `scriptureReference` fields (flashing them), and renders a video preview card (thumbnail, channel, date, description).

- [ ] **Step 1: Add preview state**

In `SermonForm`, next to the existing `flash` state:

```ts
  const [youtubePreview, setYoutubePreview] = useState<{
    loading: boolean;
    error: string | null;
    data: YoutubePreview | null;
  }>({ loading: false, error: null, data: null });
```

- [ ] **Step 2: Add the debounced preview effect**

After the `useEffect` that loads members (before `handleFileDropped`):

```ts
  // When a YouTube URL is pasted, fetch metadata and prefill empty fields.
  useEffect(() => {
    const url = values.youtubeUrl?.trim() ?? "";
    if (values.sourceType !== "youtube" || !url) {
      setYoutubePreview({ loading: false, error: null, data: null });
      return;
    }

    setYoutubePreview((current) => ({ ...current, loading: true, error: null }));
    const handle = window.setTimeout(async () => {
      try {
        const { previewYoutubeVideo } = await import("@/lib/api/youtube");
        const preview = await previewYoutubeVideo(url);

        setYoutubePreview({ loading: false, error: null, data: preview });

        // Prefill only empty fields; never clobber what the user typed.
        const next = { ...values };
        if (!next.title?.trim() && preview.title) {
          next.title = preview.title;
        }
        if (!next.preachedAt && preview.uploadDate) {
          next.preachedAt = preview.uploadDate;
        }
        if (!next.scriptureReference?.trim() && preview.scriptureReference) {
          next.scriptureReference = preview.scriptureReference;
        }
        setValues(next);

        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
        }
        setFlash({ title: true, date: true });
        flashTimeoutRef.current = setTimeout(() => {
          setFlash({ title: false, date: false });
        }, 250);
      } catch {
        setYoutubePreview({
          loading: false,
          error: "Couldn't load that video — check the URL and try again.",
          data: null,
        });
      }
    }, 600);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.sourceType, values.youtubeUrl]);
```

- [ ] **Step 3: Render the preview card and update the helper copy**

Replace the YouTube block inside the source card (`{values.sourceType === "youtube" ? ( <div> ... ) : null}`) with:

```tsx
          {values.sourceType === "youtube" ? (
            <div>
              <label
                htmlFor="youtubeUrl"
                className="block text-sm font-semibold text-ink"
              >
                YouTube video URL
              </label>

              <input
                id="youtubeUrl"
                type="url"
                value={values.youtubeUrl ?? ""}
                onChange={(event) =>
                  updateField("youtubeUrl", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                placeholder="https://www.youtube.com/watch?v=..."
                required={values.sourceType === "youtube"}
              />

              <p className="mt-2 text-xs leading-5 text-ink-soft">
                We&apos;ll pull the title and date from the video, then fetch
                the transcript automatically.
              </p>

              {youtubePreview.loading ? (
                <p
                  role="status"
                  className="mt-3 text-xs font-medium text-primary"
                >
                  Loading video details…
                </p>
              ) : null}

              {youtubePreview.error ? (
                <p
                  role="status"
                  className="mt-3 text-xs font-medium text-red-400"
                >
                  {youtubePreview.error}
                </p>
              ) : null}

              {youtubePreview.data ? (
                <div className="mt-4 flex gap-4 rounded-2xl border border-edge bg-panel-2 p-4">
                  {youtubePreview.data.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={youtubePreview.data.thumbnailUrl}
                      alt=""
                      className="h-20 w-32 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {youtubePreview.data.title}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {[
                        youtubePreview.data.channelName,
                        youtubePreview.data.uploadDate,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {youtubePreview.data.description ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-soft">
                        {youtubePreview.data.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
```

- [ ] **Step 4: Verify**

Run: `cd web && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/sermons/SermonForm.tsx
git commit -m "feat: prefill sermon form from youtube metadata"
```

---

## Part D — Channel archive import script

### Task 10: Archive import script

**Files:**
- Create: `api/scripts/__init__.py`
- Create: `api/scripts/import_youtube_archive.py`

**Interfaces:**
- Consumes: `apply_youtube_source`, `parse_youtube_video_id` from `app.services.youtube`; `SessionLocal` from `app.db`.
- Produces:
  - `iter_channel_uploads(channel_url: str, limit: int | None = None) -> Iterator[dict]` — yields `{"video_id", "title", "upload_date"}` per upload (skips playlist entries).
  - `import_videos(db: Session, user_id: uuid.UUID, items: list[dict], dry_run: bool = False) -> dict` — returns `{"created": int, "skipped": int}`; skips sermons whose `youtube_video_id` already exists; queues caption import via `apply_youtube_source`.
  - CLI: `python -m scripts.import_youtube_archive --channel <url> [--limit N] [--dry-run] [--user-id <uuid>]`.

- [ ] **Step 1: Implement the script**

Create `api/scripts/__init__.py` (empty file).

Create `api/scripts/import_youtube_archive.py`:

```python
"""Bulk-import a church YouTube channel as After Sunday sermons.

For each upload it creates a sermon row (source_type=youtube) and queues
auto-caption import through the normal background transcription worker.

Usage:
    python -m scripts.import_youtube_archive \
        --channel "https://www.youtube.com/@GraceChurch" \
        --limit 50 \
        --user-id <uuid>

--dry-run lists what would be imported without touching the database.
The user id defaults to AFTER_SUNDAY_USER_ID, then the first existing
sermon's creator.
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from typing import Iterator

import yt_dlp
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.sermon import Sermon
from app.services.youtube import apply_youtube_source, parse_youtube_video_id


def iter_channel_uploads(
    channel_url: str,
    limit: int | None = None,
) -> Iterator[dict]:
    """Yield ``{"video_id", "title", "upload_date"}`` for channel uploads."""
    opts = {
        "extract_flat": True,
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(channel_url.strip(), download=False)

    entries = info.get("entries") or []
    count = 0
    for entry in entries:
        if entry is None:
            continue
        video_id = entry.get("id") or parse_youtube_video_id(entry.get("url") or "")
        if not video_id:
            continue
        yield {
            "video_id": video_id,
            "title": str(entry.get("title") or "").strip(),
            "upload_date": entry.get("upload_date"),  # YYYYMMDD or None
        }
        count += 1
        if limit is not None and count >= limit:
            return


def import_videos(
    db: Session,
    user_id: uuid.UUID,
    items: list[dict],
    dry_run: bool = False,
) -> dict:
    """Create sermons for *items*, skipping existing youtube_video_ids."""
    created = 0
    skipped = 0
    for item in items:
        video_id = item["video_id"]
        exists = db.scalars(
            select(Sermon).where(Sermon.youtube_video_id == video_id)
        ).first()
        if exists is not None:
            skipped += 1
            continue

        title = item["title"] or f"YouTube {video_id}"
        url = f"https://www.youtube.com/watch?v={video_id}"
        if dry_run:
            print(f"[dry-run] would import: {title} ({video_id})")
            continue

        sermon = Sermon(
            created_by_user_id=user_id,
            title=title,
            source_type="youtube",
            source_url=url,
        )
        db.add(sermon)
        db.flush()
        apply_youtube_source(db, sermon, url)
        db.commit()
        created += 1
        print(f"[import] {title} — transcript queued")

    return {"created": created, "skipped": skipped}


def _resolve_user_id(db: Session, flag_value: str | None) -> uuid.UUID | None:
    if flag_value:
        return uuid.UUID(flag_value)
    env_value = os.environ.get("AFTER_SUNDAY_USER_ID")
    if env_value:
        return uuid.UUID(env_value)
    first = db.scalars(select(Sermon.created_by_user_id).limit(1)).first()
    return first


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import a church YouTube channel into After Sunday."
    )
    parser.add_argument(
        "--channel",
        required=True,
        help="Channel URL or handle, e.g. https://www.youtube.com/@GraceChurch",
    )
    parser.add_argument(
        "--limit", type=int, default=None, help="Import at most N videos (newest first)."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="List what would be imported."
    )
    parser.add_argument(
        "--user-id", default=None, help="UUID for created_by_user_id."
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user_id = _resolve_user_id(db, args.user_id)
        if user_id is None:
            print(
                "No user found. Pass --user-id <uuid> or set AFTER_SUNDAY_USER_ID."
            )
            sys.exit(1)

        items = list(iter_channel_uploads(args.channel, limit=args.limit))
        if not items:
            print("No uploads found for that channel URL.")
            sys.exit(1)

        result = import_videos(db, user_id, items, dry_run=args.dry_run)
        print(
            f"Done. created={result['created']} skipped={result['skipped']} "
            f"({len(items)} total)"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify it runs**

Run: `source .venv/bin/activate && python -m scripts.import_youtube_archive --help`
Expected: argparse help prints (no DB/network touched).

- [ ] **Step 3: Commit**

```bash
git add api/scripts/__init__.py api/scripts/import_youtube_archive.py
git commit -m "feat: add youtube channel archive import script"
```

---

### Task 11: Archive script tests

**Files:**
- Test: `api/tests/test_youtube_archive.py` (create)

**Interfaces:**
- Consumes: `iter_channel_uploads`, `import_videos` from Task 10; `db_session` fixture; `Sermon` model.

- [ ] **Step 1: Write the tests**

Create `api/tests/test_youtube_archive.py`:

```python
import uuid

from sqlalchemy import select

from app.models.sermon import Sermon
from scripts.import_youtube_archive import import_videos, iter_channel_uploads


class FakeYDL:
    def __init__(self, opts):
        self.opts = opts

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def extract_info(self, url, download=False):
        return {
            "entries": [
                {"id": "aaa111bbb22", "title": "Sermon 1", "upload_date": "20260802"},
                {"id": "ccc333ddd44", "title": "Sermon 2", "upload_date": None},
                {"_type": "playlist", "id": "PL1234", "title": "Playlist"},
            ]
        }


def test_iter_channel_uploads(monkeypatch):
    monkeypatch.setattr("scripts.import_youtube_archive.yt_dlp.YoutubeDL", FakeYDL)
    items = list(iter_channel_uploads("https://www.youtube.com/@GraceChurch"))
    assert len(items) == 2
    assert items[0]["video_id"] == "aaa111bbb22"
    assert items[1]["upload_date"] is None


def test_iter_channel_uploads_respects_limit(monkeypatch):
    monkeypatch.setattr("scripts.import_youtube_archive.yt_dlp.YoutubeDL", FakeYDL)
    items = list(
        iter_channel_uploads("https://www.youtube.com/@GraceChurch", limit=1)
    )
    assert len(items) == 1


def test_import_videos_dedupes_and_creates(db_session):
    user_id = uuid.uuid4()
    existing = Sermon(
        created_by_user_id=user_id,
        title="Sermon 1",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=aaa111bbb22",
        youtube_video_id="aaa111bbb22",
    )
    db_session.add(existing)
    db_session.commit()

    items = [
        {"video_id": "aaa111bbb22", "title": "Sermon 1", "upload_date": "20260802"},
        {"video_id": "ccc333ddd44", "title": "Sermon 2", "upload_date": None},
    ]
    result = import_videos(db_session, user_id, items)
    assert result == {"created": 1, "skipped": 1}

    sermons = db_session.scalars(select(Sermon)).all()
    assert len(sermons) == 2
    new_one = next(s for s in sermons if s.youtube_video_id == "ccc333ddd44")
    assert new_one.source_type == "youtube"
    assert new_one.transcript_status == "queued"


def test_import_videos_dry_run_touches_nothing(db_session):
    user_id = uuid.uuid4()
    items = [{"video_id": "aaa111bbb22", "title": "Sermon 1", "upload_date": None}]
    result = import_videos(db_session, user_id, items, dry_run=True)
    assert result == {"created": 0, "skipped": 0}
    assert len(db_session.scalars(select(Sermon)).all()) == 0
```

- [ ] **Step 2: Run to verify they pass**

Run: `source .venv/bin/activate && python -m pytest tests/test_youtube_archive.py -q`
Expected: PASS (4 tests).

- [ ] **Step 3: Run the full suite**

Run: `source .venv/bin/activate && python -m pytest -q`
Expected: all tests pass (previous 45 + new ones).

- [ ] **Step 4: Commit**

```bash
git add api/tests/test_youtube_archive.py
git commit -m "test: cover youtube archive import helpers"
```

---

## Part E — Verification and docs

### Task 12: Full verification + docs

**Files:**
- Modify: `docs/agent/04_ROADMAP.md` (Phase 8 → complete with notes)
- Modify: `docs/agent/02_CURRENT_STATE.md`

- [ ] **Step 1: Backend checks**

Run: `source .venv/bin/activate && alembic upgrade head`
Run: `source .venv/bin/activate && python -m pytest -q`
Expected: all green; migration at `0014_add_youtube_metadata`.

- [ ] **Step 2: Frontend checks**

Run: `cd web && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Manual smoke test**

With the API + web dev servers running (and a valid session token):
1. Open `http://localhost:3000/app/sermons/new`, pick **YouTube**, paste any real YouTube URL (e.g. `https://www.youtube.com/watch?v=dQw4w9WgXcQ`).
2. Expect: title/date prefilled, thumbnail + channel preview card, no console errors.
3. Create the sermon → workspace shows transcript status `Queued → Transcribing → Transcript ready` via the existing poll.
4. AI Draft tab: generate a follow-up from the caption transcript.

If the network is unavailable, note it and rely on the mocked tests; do not block the task on a live video.

- [ ] **Step 4: Update docs**

In `docs/agent/04_ROADMAP.md`, replace the Phase 8 stub:

```markdown
## Phase 8 — YouTube Integration

Status: complete (2026-08-15).

- paste a YouTube URL → `POST /youtube/preview` fetches public metadata
  (title, upload date, channel, thumbnail, description, scripture reference)
  and the create form prefills empty fields + shows a preview card
- auto-captions are imported through the existing `transcription_jobs`
  worker (`provider="youtube_captions"`) — no storage or transcription cost
- `api/scripts/import_youtube_archive.py` bulk-imports a channel
  (`--channel URL [--limit N] [--dry-run] [--user-id UUID]`), deduping on
  `youtube_video_id`
- metadata/captions use yt-dlp + youtube-transcript-api (no API key); a
  YouTube Data API v3 swap is possible behind `api/app/services/youtube.py`
- note: import only from the church's own channel; automated caption
  scraping is a YouTube ToS gray area
```

In `docs/agent/02_CURRENT_STATE.md`, add a short paragraph under the sermon/transcript area:

```markdown
**YouTube import (2026-08-15):** sermons can be created by pasting a YouTube
URL; the form prefills title/date/scripture from the video's public metadata,
and the background worker imports auto-captions as the transcript
(`youtube_captions` job provider). A CLI script imports a whole channel.
```

- [ ] **Step 5: Final check + commit**

Run: `git diff --check && git status --short`
Commit:

```bash
git add docs/agent/04_ROADMAP.md docs/agent/02_CURRENT_STATE.md
git commit -m "docs: record youtube import + caption archive"
```

---

## Self-Review

**1. Spec coverage:**
- "Do we support youtube yet?" → answered in reply; plan makes it real (Parts A–C).
- "Use metadata to prefill things" → Task 3 (preview endpoint) + Task 9 (prefill title/date/scripture, preview card). ✔
- "Script that scrapes each youtube video's transcript → database of sermons" → Task 5 (captions) + Task 7 (worker) + Tasks 10–11 (channel archive script). ✔

**2. Placeholder scan:** no TBD/"implement later" steps; every task has real test + implementation code. The only environment-dependent values are the pip-resolved dependency versions, which Task 2 instructs to pin from `pip freeze` output.

**3. Type consistency:** `parse_youtube_video_id`, `detect_scripture_reference`, `fetch_video_metadata`, `fetch_auto_captions`, `queue_youtube_caption_import`, `apply_youtube_source`, `iter_channel_uploads`, `import_videos`, `_process_transcription_job` are defined once and referenced with identical signatures everywhere; `VideoMetadata` fields match `YoutubePreviewRead`; `youtube_video_id` / `youtube_thumbnail_url` / `youtube_fetched_at` match across model, schema, migration, frontend type, and tests. The `find_generated_transcript(languages)` assertion in the Task 5 test matches the implementation's `list(preferred_languages)` call.
