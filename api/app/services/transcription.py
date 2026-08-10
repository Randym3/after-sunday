"""Transcription provider abstraction + mock implementation."""

from __future__ import annotations

import abc
import asyncio
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

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


class TranscriptionProvider(abc.ABC):
    """Interface for turning an audio/video file into text."""

    @abc.abstractmethod
    async def transcribe(self, file_path: Path) -> str:
        """Return the full transcript of the media at *file_path*.

        May raise an exception on failure; the caller is responsible for
        catching it and updating the job status to 'failed'.
        """
        ...


class MockTranscriptionProvider(TranscriptionProvider):
    """Returns a canned transcript after a simulated processing delay (dev)."""

    def __init__(self, delay_seconds: float = 4.0) -> None:
        self._delay = delay_seconds

    async def transcribe(self, file_path: Path) -> str:
        print(f"[transcribe] Mock started for {file_path.name} (sleep {self._delay:.1f}s)")
        await asyncio.sleep(self._delay)
        print(f"[transcribe] Mock complete for {file_path.name}")
        return MOCK_CANNED_TRANSCRIPT


async def run_transcription_worker(
    provider: TranscriptionProvider,
    poll_interval: float = 2.0,
) -> None:
    """Poll for queued transcription jobs and process them.

    Intended to run as a background asyncio task for the lifetime of the
    server.  Each job gets its own database session and is committed
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

                # Load the parent sermon so we can update its transcript fields.
                sermon = db.get(Sermon, job.sermon_id)
                if sermon is None:
                    job.status = "failed"
                    job.error_message = "Sermon row deleted before transcription started."
                    db.commit()
                    continue

                sermon.transcript_status = "processing"
                db.commit()

                # Run transcription.
                from app.storage import get_storage

                path = get_storage().retrieve(sermon.media_storage_key)
                if path is None or isinstance(path, bytes):
                    raise FileNotFoundError(
                        f"Media file not found for key {sermon.media_storage_key}"
                    )

                transcript = await provider.transcribe(path)

                job.result_text = transcript
                job.status = "completed"
                job.completed_at = datetime.now(timezone.utc)

                sermon.transcript = transcript
                sermon.transcript_status = "ready"

                db.commit()
                print(f"[transcribe] Job {job.id} completed")

            except Exception:
                import traceback
                print(f"[transcribe] Job failed: {traceback.format_exc()}")
                # Best-effort: try to mark the job as failed.
                try:
                    job.status = "failed"
                    job.error_message = traceback.format_exc()
                    if sermon:
                        sermon.transcript_status = "failed"
                    db.commit()
                except Exception:
                    print(f"[transcribe] Failed to record failure: {traceback.format_exc()}")
            finally:
                db.close()

        except Exception:
            import traceback
            print(f"[transcribe] Worker loop error: {traceback.format_exc()}")
            await asyncio.sleep(poll_interval)
