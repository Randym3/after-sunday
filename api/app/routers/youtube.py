import uuid
from dataclasses import asdict
from datetime import date

import yt_dlp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user_uuid
from app.db import get_db
from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob
from app.schemas.aliases import to_camel
from app.services.youtube import (
    NO_CAPTIONS_MARKER,
    fetch_auto_captions,
    fetch_video_metadata,
    parse_youtube_video_id,
    queue_youtube_caption_import,
)

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


class YoutubeTranscriptRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    video_id: str
    transcript: str


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
            detail="Could not load that video — check the URL and try again.",
        ) from exc
    return YoutubePreviewRead(**asdict(meta))


@router.post("/bulk-import-transcripts")
def bulk_import_transcripts(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
) -> dict:
    """Queue caption imports for every YouTube sermon without a transcript.

    Reuses the sequential transcription worker, which already processes jobs
    one at a time with a pacing delay between YouTube requests. Only sermons
    that are not ready/queued/processing are re-queued; importing replaces
    the old transcript and any AI draft derived from it (intended — these
    sermons have no usable transcript).
    """
    sermons = db.scalars(
        select(Sermon).where(
            Sermon.source_type == "youtube",
            Sermon.transcript_status.in_(["failed", "not_started"]),
        )
    ).all()

    # Sermons that previously failed for lack of English captions go last:
    # retrying them is pointless, so process the recoverable ones first.
    sermons.sort(
        key=lambda s: NO_CAPTIONS_MARKER in (s.transcript_error or "")
    )

    skipped = 0
    queued = 0
    for sermon in sermons:
        if not (sermon.youtube_video_id or sermon.source_url):
            skipped += 1
            continue
        queue_youtube_caption_import(db, sermon)
        queued += 1
    db.commit()

    return {"queued": queued, "skipped": skipped}


@router.post("/bulk-import-cancel")
def bulk_import_cancel(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
) -> dict:
    """Cancel every queued YouTube caption import.

    The video currently being processed finishes (aborting mid-fetch is not
    safe), but nothing else is picked up afterwards. Queued sermons go back
    to 'failed' so the bulk-import button can be used again later.
    """
    jobs = db.scalars(
        select(TranscriptionJob).where(
            TranscriptionJob.status == "queued",
            TranscriptionJob.provider == "youtube_captions",
        )
    ).all()

    cancelled = 0
    for job in jobs:
        job.status = "cancelled"
        job.error_message = "Bulk import cancelled by user."
        sermon = db.get(Sermon, job.sermon_id)
        if sermon is not None and sermon.transcript_status == "queued":
            sermon.transcript_status = "failed"
            sermon.transcript_error = "Import cancelled."
        cancelled += 1
    db.commit()

    return {"cancelled": cancelled}


@router.get("/bulk-import-status")
def bulk_import_status(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
) -> dict:
    """Transcript-status counts across all YouTube sermons.

    The dashboard progress bar plots ready/total, which monotonically
    increases while the bulk import runs.
    """
    rows = db.execute(
        select(Sermon.transcript_status, func.count())
        .where(Sermon.source_type == "youtube")
        .group_by(Sermon.transcript_status)
    ).all()
    counts = {status: count for status, count in rows}

    return {
        "total": sum(counts.values()),
        "ready": counts.get("ready", 0),
        "failed": counts.get("failed", 0),
        "queued": counts.get("queued", 0),
        "processing": counts.get("processing", 0),
    }


@router.post("/transcript", response_model=YoutubeTranscriptRead)
async def import_youtube_transcript(
    payload: YoutubePreviewRequest,
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    """Fetch YouTube captions before a sermon row is created."""
    video_id = parse_youtube_video_id(payload.url)
    if not video_id:
        raise HTTPException(
            status_code=422, detail="That doesn't look like a YouTube video URL."
        )

    try:
        transcript = await fetch_auto_captions(video_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return YoutubeTranscriptRead(video_id=video_id, transcript=transcript)
