import uuid
from datetime import date

from sqlalchemy import select

from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob
from scripts.import_youtube_archive import (
    backfill_upload_dates,
    import_videos,
    iter_channel_uploads,
    reparse_videos,
    _videos_tab_url,
)


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


class FakeParser:
    """Deterministic test double for SermonTitleParser."""

    def __init__(self, results=None):
        self.results = results or {}

    async def parse(self, title):
        if title in self.results:
            return self.results[title]
        return {
            "title": title,
            "preacher": None,
            "scripture_reference": None,
            "is_sermon": True,
        }


def test_channel_url_uses_videos_tab():
    assert (
        _videos_tab_url("https://www.youtube.com/@GraceChurch")
        == "https://www.youtube.com/@GraceChurch/videos"
    )
    assert (
        _videos_tab_url("https://www.youtube.com/@GraceChurch/")
        == "https://www.youtube.com/@GraceChurch/videos"
    )
    assert (
        _videos_tab_url("https://www.youtube.com/@GraceChurch/videos")
        == "https://www.youtube.com/@GraceChurch/videos"
    )
    assert (
        _videos_tab_url("https://www.youtube.com/@GraceChurch/videos?view=0")
        == "https://www.youtube.com/@GraceChurch/videos?view=0"
    )


def test_iter_channel_uploads(monkeypatch):
    monkeypatch.setattr("scripts.import_youtube_archive.yt_dlp.YoutubeDL", FakeYDL)
    items = list(iter_channel_uploads("https://www.youtube.com/@GraceChurch"))
    assert len(items) == 2
    assert items[0]["video_id"] == "aaa111bbb22"
    assert items[1]["upload_date"] is None
    assert "thumbnail" in items[0]


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
    assert result == {"created": 1, "skipped": 1, "skipped_non_sermons": 0}

    sermons = db_session.scalars(select(Sermon)).all()
    assert len(sermons) == 2
    new_one = next(s for s in sermons if s.youtube_video_id == "ccc333ddd44")
    assert new_one.source_type == "youtube"
    assert new_one.transcript_status == "queued"


def test_import_videos_dry_run_touches_nothing(db_session):
    user_id = uuid.uuid4()
    items = [{"video_id": "aaa111bbb22", "title": "Sermon 1", "upload_date": None}]
    result = import_videos(db_session, user_id, items, dry_run=True)
    assert result == {"created": 0, "skipped": 0, "skipped_non_sermons": 0}
    assert len(db_session.scalars(select(Sermon)).all()) == 0


def test_import_videos_applies_ai_parse(db_session):
    user_id = uuid.uuid4()
    parser = FakeParser(
        {
            "Philippians 1:12-18 - DJ Jansson": {
                "title": "Philippians 1:12-18",
                "preacher": "Pastor DJ Jansson",
                "scripture_reference": "Philippians 1:12-18",
                "is_sermon": True,
            }
        }
    )
    items = [
        {
            "video_id": "aaa111bbb22",
            "title": "Philippians 1:12-18 - DJ Jansson",
            "upload_date": "20260802",
            "thumbnail": "https://img.example/th.jpg",
        }
    ]
    result = import_videos(db_session, user_id, items, parser=parser)
    assert result["created"] == 1

    sermon = db_session.scalars(select(Sermon)).one()
    assert sermon.title == "Philippians 1:12-18"
    assert sermon.preacher == "DJ Jansson"  # honorific stripped
    assert sermon.scripture_reference == "Philippians 1:12-18"
    assert sermon.youtube_title == "Philippians 1:12-18 - DJ Jansson"
    assert sermon.youtube_thumbnail_url == "https://img.example/th.jpg"
    assert sermon.preached_at == date(2026, 8, 2)
    assert sermon.transcript_status == "queued"


def test_import_videos_skips_non_sermons(db_session):
    user_id = uuid.uuid4()
    parser = FakeParser(
        {
            "Church Picnic Announcement": {
                "title": "Church Picnic Announcement",
                "preacher": None,
                "scripture_reference": None,
                "is_sermon": False,
            }
        }
    )
    items = [
        {"video_id": "aaa111bbb22", "title": "Church Picnic Announcement", "upload_date": None}
    ]
    result = import_videos(db_session, user_id, items, parser=parser)
    assert result == {"created": 0, "skipped": 0, "skipped_non_sermons": 1}
    assert len(db_session.scalars(select(Sermon)).all()) == 0


def test_import_videos_include_all_imports_non_sermons(db_session):
    user_id = uuid.uuid4()
    parser = FakeParser(
        {
            "Church Picnic Announcement": {
                "title": "Church Picnic Announcement",
                "preacher": None,
                "scripture_reference": None,
                "is_sermon": False,
            }
        }
    )
    items = [
        {"video_id": "aaa111bbb22", "title": "Church Picnic Announcement", "upload_date": None}
    ]
    result = import_videos(db_session, user_id, items, parser=parser, include_all=True)
    assert result["created"] == 1


def test_import_videos_no_transcripts_skips_queue(db_session):
    user_id = uuid.uuid4()
    items = [{"video_id": "aaa111bbb22", "title": "Sermon 1", "upload_date": "20260802"}]
    result = import_videos(db_session, user_id, items, no_transcripts=True)
    assert result["created"] == 1

    sermon = db_session.scalars(select(Sermon)).one()
    assert sermon.youtube_video_id == "aaa111bbb22"
    assert sermon.transcript_status == "not_started"
    jobs = db_session.scalars(select(TranscriptionJob)).all()
    assert len(jobs) == 0


def test_reparse_fills_empty_preacher(db_session):
    user_id = uuid.uuid4()
    sermon = Sermon(
        created_by_user_id=user_id,
        title="Philippians 1:12-18",
        youtube_title="Philippians 1:12-18 - DJ Jansson",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=aaa111bbb22",
        youtube_video_id="aaa111bbb22",
        preacher=None,
        scripture_reference=None,
    )
    db_session.add(sermon)
    db_session.commit()

    parser = FakeParser(
        {
            "Philippians 1:12-18 - DJ Jansson": {
                "title": "Philippians 1:12-18",
                "preacher": "DJ Jansson",
                "scripture_reference": "Philippians 1:12-18",
                "is_sermon": True,
            }
        }
    )
    result = reparse_videos(db_session, parser=parser)
    assert result == {"updated": 1, "unchanged": 0}
    assert sermon.preacher == "DJ Jansson"
    assert sermon.scripture_reference == "Philippians 1:12-18"


def test_reparse_skips_unchanged(db_session):
    user_id = uuid.uuid4()
    # Preacher is still unknown, but the parse agrees with the stored metadata
    # (title + scripture already correct) → nothing to update.
    sermon = Sermon(
        created_by_user_id=user_id,
        title="The Good News",
        youtube_title="The Good News, Isaiah40:1-11",
        preacher=None,
        scripture_reference="Isaiah 40:1-11",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=aaa111bbb22",
        youtube_video_id="aaa111bbb22",
    )
    db_session.add(sermon)
    db_session.commit()

    parser = FakeParser(
        {
            "The Good News, Isaiah40:1-11": {
                "title": "The Good News",
                "preacher": None,
                "scripture_reference": "Isaiah 40:1-11",
                "is_sermon": True,
            }
        }
    )
    result = reparse_videos(db_session, parser=parser)
    assert result == {"updated": 0, "unchanged": 1}


def test_backfill_upload_dates(db_session, monkeypatch):
    user_id = uuid.uuid4()
    sermon = Sermon(
        created_by_user_id=user_id,
        title="Psalm 23",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=aaa111bbb22",
        youtube_video_id="aaa111bbb22",
        preached_at=None,
    )
    db_session.add(sermon)
    db_session.commit()

    class Metadata:
        upload_date = date(2026, 8, 9)
        thumbnail_url = "https://img.example/thumb.jpg"

    monkeypatch.setattr(
        "scripts.import_youtube_archive.fetch_video_metadata",
        lambda url: Metadata(),
    )
    result = backfill_upload_dates(db_session)
    assert result == {"updated": 1, "failed": 0}
    assert sermon.preached_at == date(2026, 8, 9)
    assert sermon.youtube_thumbnail_url == "https://img.example/thumb.jpg"


def test_backfill_upload_dates_dry_run_touches_nothing(db_session, monkeypatch):
    user_id = uuid.uuid4()
    sermon = Sermon(
        created_by_user_id=user_id,
        title="Psalm 23",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=aaa111bbb22",
        youtube_video_id="aaa111bbb22",
        preached_at=None,
    )
    db_session.add(sermon)
    db_session.commit()

    class Metadata:
        upload_date = date(2026, 8, 9)
        thumbnail_url = None

    monkeypatch.setattr(
        "scripts.import_youtube_archive.fetch_video_metadata",
        lambda url: Metadata(),
    )
    result = backfill_upload_dates(db_session, dry_run=True)
    assert result == {"updated": 0, "failed": 0}
    assert sermon.preached_at is None


def test_reparse_dry_run_touches_nothing(db_session):
    user_id = uuid.uuid4()
    sermon = Sermon(
        created_by_user_id=user_id,
        title="Philippians 1:12-18",
        youtube_title="Philippians 1:12-18 - DJ Jansson",
        source_type="youtube",
        source_url="https://www.youtube.com/watch?v=aaa111bbb22",
        youtube_video_id="aaa111bbb22",
        preacher=None,
    )
    db_session.add(sermon)
    db_session.commit()

    result = reparse_videos(
        db_session, parser=FakeParser(), dry_run=True
    )
    assert result == {"updated": 0, "unchanged": 0}
    assert sermon.preacher is None