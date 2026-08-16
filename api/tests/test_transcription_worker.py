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
