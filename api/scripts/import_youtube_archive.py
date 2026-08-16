"""Bulk-import a church YouTube channel as After Sunday sermons.

For each upload it creates a sermon row (source_type=youtube) and queues
auto-caption import through the normal background transcription worker.

Usage:
    python -m scripts.import_youtube_archive \
        --channel "https://www.youtube.com/@GraceChurch" \
        --limit 50 \
        --user-id <uuid>

--dry-run lists what would be imported without touching the database.
The user id defaults to AFTER_SUNDAY_USER_ID, then the first existing
sermon's creator.
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from typing import Iterator

import yt_dlp
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.sermon import Sermon
from app.services.youtube import apply_youtube_source, parse_youtube_video_id


def iter_channel_uploads(
    channel_url: str,
    limit: int | None = None,
) -> Iterator[dict]:
    """Yield ``{"video_id", "title", "upload_date"}`` for channel uploads."""
    opts = {
        "extract_flat": True,
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(channel_url.strip(), download=False)

    entries = info.get("entries") or []
    count = 0
    for entry in entries:
        if entry is None or entry.get("_type") == "playlist":
            continue
        video_id = entry.get("id") or parse_youtube_video_id(entry.get("url") or "")
        if not video_id:
            continue
        yield {
            "video_id": video_id,
            "title": str(entry.get("title") or "").strip(),
            "upload_date": entry.get("upload_date"),  # YYYYMMDD or None
        }
        count += 1
        if limit is not None and count >= limit:
            return


def import_videos(
    db: Session,
    user_id: uuid.UUID,
    items: list[dict],
    dry_run: bool = False,
) -> dict:
    """Create sermons for *items*, skipping existing youtube_video_ids."""
    created = 0
    skipped = 0
    for item in items:
        video_id = item["video_id"]
        exists = db.scalars(
            select(Sermon).where(Sermon.youtube_video_id == video_id)
        ).first()
        if exists is not None:
            skipped += 1
            continue

        title = item["title"] or f"YouTube {video_id}"
        url = f"https://www.youtube.com/watch?v={video_id}"
        if dry_run:
            print(f"[dry-run] would import: {title} ({video_id})")
            continue

        sermon = Sermon(
            created_by_user_id=user_id,
            title=title,
            source_type="youtube",
            source_url=url,
        )
        db.add(sermon)
        db.flush()
        apply_youtube_source(db, sermon, url)
        db.commit()
        created += 1
        print(f"[import] {title} — transcript queued")

    return {"created": created, "skipped": skipped}


def _resolve_user_id(db: Session, flag_value: str | None) -> uuid.UUID | None:
    if flag_value:
        return uuid.UUID(flag_value)
    env_value = os.environ.get("AFTER_SUNDAY_USER_ID")
    if env_value:
        return uuid.UUID(env_value)
    first = db.scalars(select(Sermon.created_by_user_id).limit(1)).first()
    return first


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import a church YouTube channel into After Sunday."
    )
    parser.add_argument(
        "--channel",
        required=True,
        help="Channel URL or handle, e.g. https://www.youtube.com/@GraceChurch",
    )
    parser.add_argument(
        "--limit", type=int, default=None, help="Import at most N videos (newest first)."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="List what would be imported."
    )
    parser.add_argument(
        "--user-id", default=None, help="UUID for created_by_user_id."
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user_id = _resolve_user_id(db, args.user_id)
        if user_id is None:
            print(
                "No user found. Pass --user-id <uuid> or set AFTER_SUNDAY_USER_ID."
            )
            sys.exit(1)

        items = list(iter_channel_uploads(args.channel, limit=args.limit))
        if not items:
            print("No uploads found for that channel URL.")
            sys.exit(1)

        result = import_videos(db, user_id, items, dry_run=args.dry_run)
        print(
            f"Done. created={result['created']} skipped={result['skipped']} "
            f"({len(items)} total)"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
