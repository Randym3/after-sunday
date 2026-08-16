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
    rf"\b((?:1|2|3)\s?)?({_BOOKS})\s+(\d{{1,3}})(?::(\d{{1,3}}))?\b",
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
    ordinal, book, chapter, verse = match.groups()
    # Normalize the matched book casing, then re-apply the ordinal prefix.
    normalized = next(
        (b for b in _BOOKS.split("|") if b.lower() == book.lower()), book
    )
    reference = f"{normalized} {chapter}"
    if verse:
        reference += f":{verse}"
    if ordinal:
        reference = f"{ordinal.strip()} {reference}"
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


async def fetch_auto_captions(
    video_id: str,
    preferred_languages: tuple[str, ...] = ("en", "en-US", "en-GB"),
) -> str:
    """Fetch the video's captions (manual preferred, then auto-generated)."""
    try:
        # ``fetch`` prefers a manually-created transcript in one of the
        # requested languages, falling back to an auto-generated one.
        fetched = YouTubeTranscriptApi().fetch(
            video_id, languages=list(preferred_languages)
        )
    except Exception as exc:
        raise RuntimeError(
            f"No English captions available for video {video_id}."
        ) from exc

    lines = fetched.to_raw_data()
    text = " ".join(
        (line.get("text") or "").strip()
        for line in lines
        if line.get("text", "").strip()
    )
    if not text.strip():
        raise RuntimeError(f"Captions for video {video_id} were empty.")
    return _paragraphize_text(text)


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
