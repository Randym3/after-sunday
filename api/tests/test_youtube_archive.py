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
