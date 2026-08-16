import uuid

from app.schemas.sermon import SermonRead
from app.services.youtube import (
    detect_scripture_reference,
    fetch_auto_captions,
    parse_youtube_video_id,
)


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


class FakeFetchedTranscript:
    def to_raw_data(self):
        return [
            {"text": "Hello church,", "start": 0.0, "duration": 2.0},
            {"text": "please open with me to Psalm 23.", "start": 2.0, "duration": 3.0},
        ]


class FakeYouTubeTranscriptApi:
    def fetch(self, video_id, languages):
        assert video_id == "dQw4w9WgXcQ"
        assert languages == ["en", "en-US", "en-GB"]
        return FakeFetchedTranscript()


import asyncio


def test_fetch_auto_captions_returns_paragraphized_text(monkeypatch):
    monkeypatch.setattr(
        "app.services.youtube.YouTubeTranscriptApi", FakeYouTubeTranscriptApi
    )
    text = asyncio.run(fetch_auto_captions("dQw4w9WgXcQ"))
    assert "Hello church, please open with me to Psalm 23." in text


def test_fetch_auto_captions_raises_when_missing(monkeypatch):
    class FakeApiNoTranscripts:
        def fetch(self, video_id, languages):
            raise RuntimeError("none")

    monkeypatch.setattr(
        "app.services.youtube.YouTubeTranscriptApi", FakeApiNoTranscripts
    )
    try:
        asyncio.run(fetch_auto_captions("dQw4w9WgXcQ"))
        assert False, "expected RuntimeError"
    except RuntimeError as exc:
        assert "No English captions" in str(exc)
