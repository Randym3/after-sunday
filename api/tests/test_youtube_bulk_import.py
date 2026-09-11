"""Tests for the YouTube bulk caption-import endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.main import app
from app.auth import get_current_user_uuid
from app.models.sermon import Sermon


@pytest.fixture
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_uuid] = lambda: uuid.uuid4()
    yield TestClient(app)
    app.dependency_overrides.clear()


def _create_youtube_sermon(db_session, **kwargs) -> Sermon:
    sermon = Sermon(
        created_by_user_id=uuid.uuid4(),
        title=kwargs.pop("title", "Psalm 23"),
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_video_id="dQw4w9WgXcQ",
        **kwargs,
    )
    db_session.add(sermon)
    db_session.commit()
    return sermon


def test_bulk_import_queues_failed_sermons(db_session, client):
    failed = _create_youtube_sermon(
        db_session, transcript_status="failed", title="Failed one"
    )
    ready = _create_youtube_sermon(
        db_session, transcript_status="ready", title="Already ready"
    )

    response = client.post("/youtube/bulk-import-transcripts")
    assert response.status_code == 200
    # Only the failed sermon is a candidate; ready sermons aren't counted.
    assert response.json() == {"queued": 1, "skipped": 0}

    db_session.refresh(failed)
    db_session.refresh(ready)
    assert failed.transcript_status == "queued"
    # Ready sermons are untouched — no transcript/draft clobbering.
    assert ready.transcript_status == "ready"


def test_bulk_import_skips_sermons_without_video_id(db_session, client):
    _create_youtube_sermon(db_session, transcript_status="failed")
    sermon = (
        db_session.query(Sermon).filter_by(title="Psalm 23").one()
    )
    sermon.youtube_video_id = None
    sermon.source_url = None
    db_session.commit()

    response = client.post("/youtube/bulk-import-transcripts")
    assert response.status_code == 200
    assert response.json() == {"queued": 0, "skipped": 1}


def test_bulk_import_is_idempotent_when_nothing_to_do(db_session, client):
    _create_youtube_sermon(db_session, transcript_status="ready")
    response = client.post("/youtube/bulk-import-transcripts")
    assert response.json() == {"queued": 0, "skipped": 0}


def test_bulk_import_cancel_resets_queued_jobs(db_session, client):
    from app.models.transcription_job import TranscriptionJob

    failed = _create_youtube_sermon(
        db_session, transcript_status="failed", title="Queued one"
    )
    ready = _create_youtube_sermon(
        db_session, transcript_status="ready", title="Ready one"
    )

    # Queue via the endpoint, then cancel.
    client.post("/youtube/bulk-import-transcripts")
    job = db_session.get(TranscriptionJob, failed.id)
    assert job is not None and job.status == "queued"

    response = client.post("/youtube/bulk-import-cancel")
    assert response.status_code == 200
    assert response.json() == {"cancelled": 1}

    db_session.refresh(failed)
    db_session.refresh(job)
    db_session.refresh(ready)
    assert job.status == "cancelled"
    assert failed.transcript_status == "failed"
    assert failed.transcript_error == "Import cancelled."
    # Ready sermons are untouched.
    assert ready.transcript_status == "ready"

    # With nothing queued, cancelling again is a no-op.
    response = client.post("/youtube/bulk-import-cancel")
    assert response.json() == {"cancelled": 0}


def test_bulk_import_sorts_no_caption_sermons_last(db_session, client, monkeypatch):
    """Sermons that failed for lack of English captions are queued after
    the recoverable ones."""
    from app.services.youtube import NO_CAPTIONS_MARKER
    import app.routers.youtube as youtube_router

    _create_youtube_sermon(
        db_session,
        transcript_status="failed",
        transcript_error=(
            f"{NO_CAPTIONS_MARKER} No English captions available."
        ),
        title="No captions",
    )
    recoverable = _create_youtube_sermon(
        db_session, transcript_status="failed", title="Recoverable"
    )

    enqueued: list[str] = []
    original = youtube_router.queue_youtube_caption_import

    def spy(db, sermon):
        enqueued.append(sermon.title)
        return original(db, sermon)

    monkeypatch.setattr(youtube_router, "queue_youtube_caption_import", spy)

    response = client.post("/youtube/bulk-import-transcripts")
    assert response.status_code == 200
    assert response.json() == {"queued": 2, "skipped": 0}
    assert enqueued == ["Recoverable", "No captions"]


def test_bulk_import_status_counts_youtube_sermons(db_session, client):
    _create_youtube_sermon(db_session, transcript_status="ready")
    _create_youtube_sermon(db_session, transcript_status="ready", title="Two")
    _create_youtube_sermon(db_session, transcript_status="failed", title="Three")

    response = client.get("/youtube/bulk-import-status")
    assert response.status_code == 200
    assert response.json() == {
        "total": 3,
        "ready": 2,
        "failed": 1,
        "queued": 0,
        "processing": 0,
    }
