"""Retry YouTube caption imports for sermons without a ready transcript.

Processes sermons one at a time through the same ``fetch_auto_captions``
code path the in-app transcription worker uses, pausing between videos so
YouTube is not hammered. Safe to interrupt (Ctrl+C): every result is
committed independently and reruns skip sermons that are already ready.

The script deliberately distinguishes YouTube IP blocks (``IpBlocked`` /
``RequestBlocked`` / ``TooManyRequests``) from videos that genuinely have
no English captions, because the in-app worker reports both as the same
generic "No English captions available" error. On an IP block the run
stops by default — continuing would only deepen the block. Pass
``--block-wait SECONDS`` to cool down and keep going instead.

IMPORTANT: run only ONE copy of this script at a time, and do not leave
it running while the in-app worker is also importing captions for the
same sermons — both write the same rows.

Usage (from the api/ directory):

    .venv/bin/python -m scripts.retry_youtube_transcripts
    .venv/bin/python -m scripts.retry_youtube_transcripts --delay 5
    .venv/bin/python -m scripts.retry_youtube_transcripts --limit 10
    .venv/bin/python -m scripts.retry_youtube_transcripts --dry-run
    .venv/bin/python -m scripts.retry_youtube_transcripts --block-wait 900

Flags:
    --delay SECONDS      pause between videos (default 10)
    --limit N            process at most N sermons this run
    --dry-run            list what would be processed, write nothing
    --include-active     also retry sermons currently queued/processing
                         (only needed if the in-app worker is NOT running
                         and those rows are stuck)
    --block-wait S       on an IP block, wait S seconds and continue
                         instead of stopping (default 0 = stop)
"""

from __future__ import annotations

import argparse
import asyncio
import time
import traceback
from datetime import datetime, timezone

from sqlalchemy import select

from app.db import SessionLocal
from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob
from app.services.youtube import fetch_auto_captions

# Error classes exposed by youtube-transcript-api. All versions used here
# keep them in ``youtube_transcript_api._errors``.
_BLOCKING_ERRORS = ("IpBlocked", "RequestBlocked", "TooManyRequests")
_PERMANENT_ERRORS = (
    "TranscriptsDisabled",
    "NoTranscriptFound",
    "VideoUnavailable",
    "VideoUnavailableInCountry",
    "AgeRestricted",
)
# Sermons whose stored error contains this marker failed for lack of English
# captions; they are sorted last because retrying them is pointless.
NO_CAPTIONS_MARKER = "[no-english-captions]"


def _load_error_classes() -> dict[str, type]:
    try:
        from youtube_transcript_api import _errors as yta_errors
    except ImportError:  # pragma: no cover - package is in requirements
        return {}
    return {
        name: getattr(yta_errors, name)
        for name in _BLOCKING_ERRORS + _PERMANENT_ERRORS
        if hasattr(yta_errors, name)
    }


YTA_ERRORS = _load_error_classes()


def classify_exception(exc: BaseException) -> str | None:
    """Walk the exception chain (fetch_auto_captions wraps everything in a
    RuntimeError) and return the first known youtube-transcript-api error
    name found, or None."""
    seen: set[int] = set()
    while exc is not None and id(exc) not in seen:
        seen.add(id(exc))
        for name, cls in YTA_ERRORS.items():
            if isinstance(exc, cls):
                return name
        exc = exc.__cause__
    return None


def root_cause(exc: BaseException) -> BaseException:
    """Return the deepest exception in the __cause__ chain."""
    seen: set[int] = set()
    while exc.__cause__ is not None and id(exc.__cause__) not in seen:
        seen.add(id(exc))
        exc = exc.__cause__
    return exc


def _snapshot_sermon_ids(db, include_active: bool, limit: int | None) -> list:
    """Collect the ids of sermons to process this run (oldest first).

    Sermons that previously failed for lack of English captions are sorted
    last — retrying them is pointless, so recoverable ones go first.
    """
    sermons = db.scalars(
        select(Sermon).where(
            Sermon.transcript_status != "ready",
            Sermon.youtube_video_id.is_not(None),
        )
    ).all()
    if not include_active:
        sermons = [
            s
            for s in sermons
            if s.transcript_status not in ("queued", "processing")
        ]
    sermons.sort(key=lambda s: NO_CAPTIONS_MARKER in (s.transcript_error or ""))
    ids = [s.id for s in sermons]
    return ids[:limit] if limit is not None else ids


def process_one(db, sermon: Sermon) -> tuple[str, str | None]:
    """Import captions for one sermon. Returns (result, detail) where
    result is 'ok' | 'blocked' | 'failed' and detail describes a failure."""
    video_id = sermon.youtube_video_id
    job = db.scalars(
        select(TranscriptionJob).where(TranscriptionJob.sermon_id == sermon.id)
    ).first()
    if job is None:
        job = TranscriptionJob(
            id=sermon.id, sermon_id=sermon.id, provider="youtube_captions"
        )
        db.add(job)
    job.provider = "youtube_captions"
    job.status = "processing"
    job.started_at = datetime.now(timezone.utc)
    job.error_message = None
    sermon.transcript = None
    sermon.transcript_error = None
    sermon.transcript_status = "processing"
    db.commit()

    try:
        transcript = asyncio.run(fetch_auto_captions(video_id))
    except Exception as exc:
        db.rollback()
        # Re-read both rows; the rollback above may have discarded state.
        sermon = db.get(Sermon, sermon.id)
        job = db.scalars(
            select(TranscriptionJob).where(
                TranscriptionJob.sermon_id == sermon.id
            )
        ).first()
        kind = classify_exception(exc)
        cause = root_cause(exc)
        detail = (
            f"{type(cause).__name__}: {cause}" if cause is not exc else str(exc)
        )
        # One concise terminal line; the full traceback still goes to the
        # job row (error_message) and the detail to the sermon row.
        if kind in ("TranscriptsDisabled", "NoTranscriptFound"):
            detail = (
                f"{NO_CAPTIONS_MARKER} No English captions: {detail}"
            )
        sermon.transcript_status = "failed"
        sermon.transcript_error = detail[:500]
        if job is not None:
            job.status = "failed"
            job.error_message = traceback.format_exc()
        db.commit()
        return ("blocked" if kind in _BLOCKING_ERRORS else "failed"), detail

    job.result_text = transcript
    job.status = "completed"
    job.completed_at = datetime.now(timezone.utc)
    sermon.transcript = transcript
    sermon.transcript_status = "ready"
    db.commit()
    return "ok", None


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Retry YouTube caption imports for sermons without a ready "
            "transcript, one at a time with a delay."
        )
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=10.0,
        help="Seconds to wait between videos (default: 10).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most N sermons this run.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would be processed and exit.",
    )
    parser.add_argument(
        "--include-active",
        action="store_true",
        help=(
            "Also retry sermons currently queued/processing. Only use "
            "this when the in-app worker is NOT running."
        ),
    )
    parser.add_argument(
        "--block-wait",
        type=float,
        default=0.0,
        help=(
            "On a YouTube IP block, wait this many seconds and continue "
            "instead of stopping (default: 0 = stop immediately)."
        ),
    )
    args = parser.parse_args()

    db = SessionLocal()
    stopped_on_block = False
    try:
        sermon_ids = _snapshot_sermon_ids(db, args.include_active, args.limit)
        if not sermon_ids:
            print("Nothing to do — every YouTube sermon has a ready transcript.")
            return

        print(f"{len(sermon_ids)} sermon(s) to process (delay {args.delay:g}s between videos).")
        if args.dry_run:
            for sermon_id in sermon_ids:
                sermon = db.get(Sermon, sermon_id)
                if sermon is None:
                    continue
                print(
                    f"  [dry-run] {sermon.youtube_video_id}  "
                    f"{sermon.title}  (status={sermon.transcript_status})"
                )
            print("Dry run only — nothing was written.")
            return

        counts = {"ok": 0, "failed": 0, "blocked": 0, "skipped": 0}
        started = time.monotonic()

        for index, sermon_id in enumerate(sermon_ids, start=1):
            # Re-read fresh each iteration; status may have changed since
            # the snapshot (e.g. the user fixed it in the UI mid-run).
            sermon = db.get(Sermon, sermon_id)
            if sermon is None:
                counts["skipped"] += 1
                continue
            if sermon.transcript_status == "ready":
                counts["skipped"] += 1
                print(f"[{index}/{len(sermon_ids)}] SKIP {sermon.title!r} — already ready")
                continue
            if (
                not args.include_active
                and sermon.transcript_status in ("queued", "processing")
            ):
                counts["skipped"] += 1
                print(
                    f"[{index}/{len(sermon_ids)}] SKIP {sermon.title!r} — "
                    "queued/processing (in-app worker may own it)"
                )
                continue

            video_id = sermon.youtube_video_id
            print(
                f"[{index}/{len(sermon_ids)}] {video_id}  {sermon.title!r} ...",
                flush=True,
            )
            try:
                result, detail = process_one(db, sermon)
            except KeyboardInterrupt:
                print("\nInterrupted — progress so far is saved. Rerun to resume.")
                raise

            if result == "ok":
                counts["ok"] += 1
                transcript_len = len(sermon.transcript or "")
                print(f"    OK ({transcript_len:,} chars)")
            elif result == "blocked":
                counts["blocked"] += 1
                print(f"    IP BLOCKED: {detail}")
                if args.block_wait > 0:
                    print(
                        f"    Cooling down {args.block_wait:g}s before continuing "
                        "(--block-wait)..."
                    )
                    time.sleep(args.block_wait)
                else:
                    stopped_on_block = True
                    print(
                        "\nSTOPPING: YouTube is blocking this machine's IP "
                        "(too many requests). Wait a while — hours, or try "
                        "another network — then rerun. Reruns skip sermons "
                        "that already succeeded. Use --block-wait SECONDS to "
                        "cool down and continue automatically instead."
                    )
                    break
            else:
                counts["failed"] += 1
                if NO_CAPTIONS_MARKER in detail:
                    print(f"    NO ENGLISH CAPTIONS: {detail}")
                else:
                    print(f"    FAILED: {detail}")

            # Pause between videos (not after the last one).
            if index < len(sermon_ids) and result != "blocked":
                time.sleep(args.delay)

        elapsed = time.monotonic() - started
        print(
            f"\nDone in {elapsed / 60:.1f} min. ok={counts['ok']} "
            f"failed={counts['failed']} blocked={counts['blocked']} "
            f"skipped={counts['skipped']}"
        )
        if stopped_on_block:
            raise SystemExit(2)
    finally:
        db.close()


if __name__ == "__main__":
    main()
