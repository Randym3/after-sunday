import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import get_current_user_uuid
from app.db import get_db
from app.main import app
from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob


@pytest.fixture
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_uuid] = lambda: uuid.uuid4()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_channel_sync_adds_missing_videos_without_transcription(
    client, db_session, monkeypatch
):
    import app.routers.youtube as youtube_router

    items = [
        {
            "video_id": "aaa111bbb22",
            "title": "Sunday Service — Psalm 23",
            "upload_date": "20260809",
            "thumbnail": "https://img.example/aaa.jpg",
        },
        {
            "video_id": "ccc333ddd44",
            "title": "Church Update",
            "upload_date": None,
            "thumbnail": None,
        },
    ]
    monkeypatch.setattr(
        youtube_router.youtube_archive,
        "iter_channel_uploads",
        lambda channel_url, limit=None: iter(items[:limit] if limit else items),
    )

    response = client.post(
        "/youtube/channel-sync",
        json={"channelUrl": "https://www.youtube.com/@GraceChurch"},
    )
    assert response.status_code == 200
    assert response.json() == {"videosFound": 2, "created": 2, "skipped": 0}

    sermons = db_session.scalars(
        select(Sermon).order_by(Sermon.youtube_video_id)
    ).all()
    assert [sermon.youtube_video_id for sermon in sermons] == [
        "aaa111bbb22",
        "ccc333ddd44",
    ]
    assert all(sermon.transcript_status == "not_started" for sermon in sermons)
    assert db_session.scalars(select(TranscriptionJob)).all() == []
    assert sermons[0].youtube_title == "Sunday Service — Psalm 23"
    assert sermons[0].youtube_thumbnail_url == "https://img.example/aaa.jpg"

    # A second sync sees the same video ids and creates nothing new.
    response = client.post(
        "/youtube/channel-sync",
        json={"channelUrl": "https://www.youtube.com/@GraceChurch"},
    )
    assert response.status_code == 200
    assert response.json() == {"videosFound": 2, "created": 0, "skipped": 2}


def test_channel_sync_respects_limit(client, monkeypatch):
    import app.routers.youtube as youtube_router

    monkeypatch.setattr(
        youtube_router.youtube_archive,
        "iter_channel_uploads",
        lambda channel_url, limit=None: iter(
            [
                {
                    "video_id": "aaa111bbb22",
                    "title": "Sermon",
                    "upload_date": None,
                }
            ]
        ),
    )

    response = client.post(
        "/youtube/channel-sync",
        json={
            "channelUrl": "https://www.youtube.com/@GraceChurch",
            "limit": 1,
        },
    )
    assert response.status_code == 200
    assert response.json()["videosFound"] == 1


def test_channel_setting_is_saved_and_returned(client, monkeypatch):
    import app.routers.youtube as youtube_router

    monkeypatch.setattr(
        youtube_router.youtube_archive,
        "iter_channel_uploads",
        lambda channel_url, limit=None: iter([]),
    )

    sync_response = client.post(
        "/youtube/channel-sync",
        json={"channelUrl": " https://www.youtube.com/@GraceChurch "},
    )
    assert sync_response.status_code == 200

    response = client.get("/youtube/channel")
    assert response.status_code == 200
    assert response.json() == {"channelUrl": "https://www.youtube.com/@GraceChurch"}


def test_preview_returns_metadata(client, monkeypatch):
    from datetime import date

    from app.services.youtube import VideoMetadata

    fake = VideoMetadata(
        video_id="dQw4w9WgXcQ",
        title="Sunday Service — Psalm 23",
        upload_date=date(2026, 8, 9),
        channel_name="Grace Church",
        thumbnail_url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        description="Join us for worship.",
        duration_seconds=2760,
        scripture_reference="Psalm 23",
    )

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


def test_preview_reports_fetch_failure(client, monkeypatch):
    import yt_dlp

    def boom(url):
        raise yt_dlp.utils.DownloadError("Video unavailable")

    monkeypatch.setattr("app.routers.youtube.fetch_video_metadata", boom)

    response = client.post(
        "/youtube/preview", json={"url": "https://youtu.be/aaaaaaaaaaa"}
    )
    assert response.status_code == 422
