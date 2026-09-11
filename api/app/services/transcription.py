"""Transcription provider abstraction + mock/Velma implementations."""

from __future__ import annotations

import abc
import asyncio
import re
import subprocess
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob

MOCK_CANNED_TRANSCRIPT = """Pastor: Good morning, church. Please turn with me to Psalm 23.

The Lord is my shepherd; I shall not want.
He makes me lie down in green pastures.
He leads me beside still waters.
He restores my soul.

You know, when David wrote these words, he wasn't writing from a palace.
He was writing from experience. He had been a shepherd himself.
He knew what it meant to care for sheep — to lead them, to protect them,
to provide for them.

And here he says: the Lord is MY shepherd. It's personal. It's intimate.
It's not just a theological statement — it's a testimony.

When you're walking through a dark valley — and we all do — you don't need
an abstract idea of God. You need a shepherd who walks WITH you.
That's the promise of Psalm 23. Not that the valley disappears,
but that you don't walk it alone.

Let's pray. Father, thank You that You are our shepherd..."

Congregation: Amen.
"""

VELMA_BATCH_URL = "https://platform.modulate.ai/api/velma-2-stt-batch"

# Minimum pause between consecutive YouTube caption fetches. YouTube rate
# limits (and eventually IP-blocks) hosts that request captions too quickly;
# pacing each import keeps a bulk run under the threshold.
YOUTUBE_IMPORT_DELAY_SECONDS = 8.0
# When YouTube signals a block (HTTP 429 / ip_blocked), pause future caption
# imports for this long before trying again instead of hammering through it.
YOUTUBE_BLOCK_COOLDOWN_SECONDS = 900.0

# Velma's utterances can be very long (tens of seconds of continuous
# speech), so paragraph breaks are driven by sentence count rather than
# utterance boundaries. These are the tuning knobs.
SENTENCES_PER_PARAGRAPH = 3
# A silence gap at least this long between consecutive utterances also
# starts a new paragraph (a genuine dramatic pause).
PAUSE_PARAGRAPH_THRESHOLD_MS = 1500


async def _youtube_rate_limit_pause() -> None:
    """Pause between consecutive YouTube caption imports to avoid blocks."""
    await asyncio.sleep(YOUTUBE_IMPORT_DELAY_SECONDS)


# Module-level state shared by the worker loop: when YouTube signals a block
# (rate-limit / ip_blocked), later caption fetches wait for the cooldown to
# expire instead of hammering YouTube through the block.
_youtube_block_until: float = 0.0


def _youtube_block_message(job_error: str | None, sermon_error: str | None) -> bool:
    """True when a job failure looks like YouTube blocking this host."""
    combined = f"{job_error or ''}\n{sermon_error or ''}"
    markers = (
        "IpBlocked",
        "ip_blocked",
        "RequestBlocked",
        "TooManyRequests",
        "429",
        "blocking requests from your IP",
    )
    return any(marker in combined for marker in markers)


def _mark_youtube_blocked() -> None:
    global _youtube_block_until
    _youtube_block_until = asyncio.get_event_loop().time() + (
        YOUTUBE_BLOCK_COOLDOWN_SECONDS
    )
    print(
        f"[transcribe] YouTube rate limit detected — pausing caption "
        f"imports for {YOUTUBE_BLOCK_COOLDOWN_SECONDS / 60:.0f} minutes"
    )


@contextmanager
def _prepare_velma_upload(
    file_path: Path,
    upload_name: str,
):
    """Prepare a file in a format accepted by Velma's batch endpoint.

    Velma's batch API rejects the `.m4a` extension even though M4A is a
    common audio container. Convert it to an MP3 in a temporary directory;
    the original recording remains untouched in storage.
    """
    if Path(upload_name).suffix.lower() != ".m4a":
        yield file_path, upload_name
        return

    with tempfile.TemporaryDirectory(prefix="after-sunday-transcode-") as temp_dir:
        converted_path = Path(temp_dir) / "recording.mp3"
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(file_path),
                    "-vn",
                    "-codec:a",
                    "libmp3lame",
                    "-q:a",
                    "2",
                    str(converted_path),
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except FileNotFoundError as exc:
            raise RuntimeError(
                "M4A transcription requires ffmpeg to be installed on the API server."
            ) from exc
        except subprocess.CalledProcessError as exc:
            detail = (exc.stderr or "").strip()[-500:]
            raise RuntimeError(
                f"Could not convert the M4A recording before transcription. {detail}"
            ) from exc

        if not converted_path.exists() or converted_path.stat().st_size == 0:
            raise RuntimeError("M4A conversion produced an empty audio file.")

        yield converted_path, converted_path.name


class TranscriptionProvider(abc.ABC):
    """Interface for turning an audio/video file into text."""

    # Short identifier recorded on transcription_jobs.provider.
    provider_name = "unknown"

    @abc.abstractmethod
    async def transcribe(self, file_path: Path, original_filename: str | None = None) -> str:
        """Return the full transcript of the media at *file_path*.

        *original_filename* carries the user-facing name (e.g. "sermon.mp4")
        because storage keys may lack a file extension that some providers
        require.

        May raise an exception on failure; the caller is responsible for
        catching it and updating the job status to 'failed'.
        """
        ...


class MockTranscriptionProvider(TranscriptionProvider):
    """Returns a canned transcript after a simulated processing delay (dev)."""

    provider_name = "mock"

    def __init__(self, delay_seconds: float = 4.0) -> None:
        self._delay = delay_seconds

    async def transcribe(self, file_path: Path, original_filename: str | None = None) -> str:
        print(f"[transcribe] Mock started for {file_path.name} (sleep {self._delay:.1f}s)")
        await asyncio.sleep(self._delay)
        print(f"[transcribe] Mock complete for {file_path.name}")
        return MOCK_CANNED_TRANSCRIPT


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on '.', '!' or '?' followed by whitespace."""
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _paragraphize(utterances: list[dict]) -> str:
    """Rebuild a transcript from Velma utterances with paragraph breaks.

    Paragraphs hold up to ``SENTENCES_PER_PARAGRAPH`` sentences. A new
    paragraph also starts on a speaker change or after a silence gap of at
    least ``PAUSE_PARAGRAPH_THRESHOLD_MS``. Velma's utterances can be very
    long, so sentence grouping — not utterance boundaries alone — is what
    keeps the output readable. Returns ``""`` when there are no usable
    utterances.
    """
    paragraphs: list[list[str]] = []
    current: list[str] = []
    prev_end_ms: int | None = None
    prev_speaker: int | None = None

    def flush() -> None:
        nonlocal current
        if current:
            paragraphs.append(current)
            current = []

    for u in utterances:
        text = (u.get("text") or "").strip()
        if not text:
            continue

        start_ms = u.get("start_ms")
        duration_ms = u.get("duration_ms")
        end_ms = (
            start_ms + duration_ms
            if isinstance(start_ms, int) and isinstance(duration_ms, int)
            else None
        )
        gap_ms = (
            start_ms - prev_end_ms
            if isinstance(start_ms, int) and isinstance(prev_end_ms, int)
            else None
        )
        speaker = u.get("speaker")

        if speaker != prev_speaker or (
            gap_ms is not None and gap_ms >= PAUSE_PARAGRAPH_THRESHOLD_MS
        ):
            flush()

        for sentence in _split_sentences(text):
            if len(current) >= SENTENCES_PER_PARAGRAPH:
                flush()
            current.append(sentence)

        prev_end_ms = end_ms
        prev_speaker = speaker

    flush()
    return "\n\n".join(" ".join(p) for p in paragraphs)


def _paragraphize_text(text: str) -> str:
    """Sentence-grouped paragraphing for a plain transcript string with no
    utterance metadata available."""
    sentences = _split_sentences(text)
    paragraphs = [
        sentences[i : i + SENTENCES_PER_PARAGRAPH]
        for i in range(0, len(sentences), SENTENCES_PER_PARAGRAPH)
    ]
    return "\n\n".join(" ".join(p) for p in paragraphs)


class VelmaTranscriptionProvider(TranscriptionProvider):
    """Transcribes through Modulate's Velma Transcribe batch API.

    Accepts MP3/WAV/FLAC/MP4/OGG up to 100 MB directly, so uploaded video
    files can be sent as-is (no ffmpeg audio extraction needed). Speaker
    diarization is enabled by default so pastor/congregation turns come
    back labeled.

    The batch response includes per-utterance timestamps; we rebuild the
    transcript from those utterances so speaker changes and long pauses
    become paragraph breaks (see ``_paragraphize``).
    """

    provider_name = "velma"

    def __init__(self, api_key: str, url: str = VELMA_BATCH_URL) -> None:
        self._api_key = api_key
        self._url = url

    async def transcribe(self, file_path: Path, original_filename: str | None = None) -> str:
        # Velma validates by file extension, and storage keys are UUIDs with
        # no extension — so send the user-facing filename when we have it.
        upload_name = original_filename or file_path.name
        print(f"[transcribe] Velma started for {upload_name}")
        with _prepare_velma_upload(file_path, upload_name) as (
            upload_path,
            prepared_upload_name,
        ):
            async with httpx.AsyncClient(timeout=600.0) as client:
                with upload_path.open("rb") as fh:
                    response = await client.post(
                        self._url,
                        headers={"X-API-Key": self._api_key},
                        data={"speaker_diarization": "true"},
                        files={"upload_file": (prepared_upload_name, fh)},
                    )

        if response.is_error:
            detail = response.text.strip() or "No error details returned."
            raise RuntimeError(
                f"Velma rejected the recording (HTTP {response.status_code}): "
                f"{detail[:1000]}"
            )
        result = response.json()
        utterances = result.get("utterances") or []
        if utterances:
            text = _paragraphize(utterances)
        else:
            text = _paragraphize_text(result.get("text") or "")
        if not text.strip():
            raise RuntimeError(
                f"Velma returned no transcript: {result!r}"
            )
        print(
            f"[transcribe] Velma complete for {upload_name} "
            f"({result.get('duration_ms', '?')}ms, {len(utterances)} utterances)"
        )
        return text


def build_provider() -> TranscriptionProvider:
    """Pick the real Velma provider when an API key is configured, else mock."""
    api_key = get_settings().modulate_api_key
    if api_key:
        return VelmaTranscriptionProvider(api_key=api_key)
    print("[transcribe] No MODULATE_API_KEY set — using mock provider (dev only)")
    return MockTranscriptionProvider(delay_seconds=4.0)


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
        # Store the full traceback on the job for debugging; store a
        # short, user-facing message on the sermon so the UI can show it.
        err_msg = str(exc) or type(exc).__name__
        try:
            job.status = "failed"
            job.error_message = tb
            sermon.transcript_status = "failed"
            sermon.transcript_error = err_msg
            db.commit()
        except Exception:
            print(f"[transcribe] Failed to record failure: {traceback.format_exc()}")
        # A caption fetch that looks like an IP block means the *next*
        # fetches would fail too — cool down before processing more.
        if job.provider == "youtube_captions" and _youtube_block_message(
            tb, err_msg
        ):
            _mark_youtube_blocked()


async def run_transcription_worker(
    provider: TranscriptionProvider,
    poll_interval: float = 2.0,
) -> None:
    """Poll for queued transcription jobs and process them.

    Intended to run as a background asyncio task for the lifetime of the
    server.  Each job gets its own database session and is committed
    independently so a single failure doesn't block the queue.
    """
    global _youtube_block_until
    print(f"[transcribe] Worker started (provider={type(provider).__name__})")

    while True:
        try:
            await asyncio.sleep(poll_interval)

            db = SessionLocal()
            try:
                # Respect the YouTube block cooldown before picking up the
                # next caption job (leave file-transcription jobs alone).
                if _youtube_block_until > 0.0:
                    remaining = _youtube_block_until - asyncio.get_event_loop().time()
                    if remaining > 0:
                        next_caption = db.scalars(
                            select(TranscriptionJob)
                            .where(
                                TranscriptionJob.status == "queued",
                                TranscriptionJob.provider == "youtube_captions",
                            )
                            .limit(1)
                        ).first()
                        if next_caption is not None:
                            print(
                                f"[transcribe] Waiting {remaining:.0f}s for "
                                f"YouTube cooldown"
                            )
                            continue
                    else:
                        _youtube_block_until = 0.0

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

                was_youtube = job.provider == "youtube_captions"
                await _process_transcription_job(db, job, provider)

                # Pace consecutive YouTube caption imports so the bulk
                # import doesn't trip YouTube's rate limiting.
                if was_youtube:
                    await _youtube_rate_limit_pause()
            finally:
                db.close()

        except Exception:
            import traceback

            print(f"[transcribe] Worker loop error: {traceback.format_exc()}")
            await asyncio.sleep(poll_interval)
