"""Background worker for resumable long-sermon follow-up generation."""

from __future__ import annotations

import asyncio
import json
import traceback
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.follow_up_job import FollowUpJob
from app.models.sermon import Sermon
from app.services.follow_up import build_follow_up_provider
from app.services.transcript_chunking import chunk_transcript


async def _process_follow_up_job(db: Session, job: FollowUpJob) -> None:
    sermon = db.get(Sermon, job.sermon_id)
    if sermon is None:
        job.status = "failed"
        job.error_message = "Sermon row deleted before follow-up generation started."
        db.commit()
        return

    provider = build_follow_up_provider()
    chunks = chunk_transcript(sermon.transcript or "")
    try:
        notes = json.loads(job.notes_json) if job.notes_json else None
    except json.JSONDecodeError:
        notes = None
    if not isinstance(notes, list) or len(notes) != len(chunks):
        notes = [None] * len(chunks)

    job.provider = provider.provider_name
    job.map_model = getattr(provider, "map_model_name", provider.model_name)
    job.reduce_model = provider.model_name
    job.total_chunks = len(chunks)
    job.completed_chunks = sum(bool(note) for note in notes)
    sermon.ai_generation_status = "processing"
    sermon.ai_generation_total_chunks = len(chunks)
    sermon.ai_generation_completed_chunks = job.completed_chunks
    sermon.ai_generation_error = None
    db.commit()

    async def on_chunk_complete(index: int, note: str) -> None:
        notes[index] = note
        job.notes_json = json.dumps(notes)
        job.completed_chunks = sum(bool(value) for value in notes)
        sermon.ai_generation_completed_chunks = job.completed_chunks
        db.commit()
        print(
            f"[follow-up] Saved section {index + 1}/{job.total_chunks} "
            f"for sermon {sermon.id}"
        )

    try:
        draft = await provider.generate(
            title=sermon.title,
            preacher=sermon.preacher,
            scripture_reference=sermon.scripture_reference,
            transcript=sermon.transcript or "",
            existing_notes=notes,
            on_chunk_complete=on_chunk_complete,
        )
        sermon.follow_up_subject = draft["subject"]
        sermon.follow_up_body = draft["body"]
        sermon.ai_draft_status = "draft_ready"
        sermon.ai_provider = provider.provider_name
        sermon.ai_model = provider.model_name
        sermon.email_status = "draft"
        sermon.ai_generation_status = "completed"
        sermon.ai_generation_completed_chunks = job.total_chunks
        sermon.ai_generation_error = None
        job.notes_json = json.dumps(notes)
        job.completed_chunks = job.total_chunks
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        print(f"[follow-up] Job {job.id} completed")
    except Exception as exc:
        message = str(exc) or type(exc).__name__
        job.status = "failed"
        job.error_message = traceback.format_exc()
        sermon.ai_draft_status = "not_started"
        sermon.ai_generation_status = "failed"
        sermon.ai_generation_error = message
        db.commit()
        print(f"[follow-up] Job {job.id} failed:\n{job.error_message}")


async def run_follow_up_worker(poll_interval: float = 2.0) -> None:
    """Process queued follow-up jobs until the API shuts down."""
    print("[follow-up] Worker started")
    while True:
        await asyncio.sleep(poll_interval)
        db = SessionLocal()
        try:
            job = db.scalars(
                select(FollowUpJob)
                .where(FollowUpJob.status == "queued")
                .order_by(FollowUpJob.created_at)
                .limit(1)
            ).first()
            if job is None:
                continue

            job.status = "processing"
            job.started_at = datetime.now(timezone.utc)
            db.commit()
            await _process_follow_up_job(db, job)
        except asyncio.CancelledError:
            raise
        except Exception:
            print(f"[follow-up] Worker loop error:\n{traceback.format_exc()}")
        finally:
            db.close()
