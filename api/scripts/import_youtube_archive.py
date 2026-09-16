"""Bulk-import a church YouTube channel as After Sunday sermons.

For each upload it creates a sermon row (source_type=youtube), parses the
video title into {title, preacher, scripture_reference, is_sermon} via the
LLM (regex fallback), and queues auto-caption import through the normal
background transcription worker.

Usage:
    python -m scripts.import_youtube_archive \
        --channel "https://www.youtube.com/@GraceChurch" \
        --limit 50 \
        --user-id <uuid>

--dry-run lists the *parsed* metadata (title / passage / preacher) for each
upload without touching the database. Non-sermon uploads (announcements,
recaps, promos) are skipped unless --include-all is given.

The user id defaults to AFTER_SUNDAY_USER_ID, then the first existing
sermon's creator. Re-running is safe: sermons are deduped by youtube_video_id
and committed one at a time, so an interrupted run resumes cleanly.

Flags:
    --dry-run        print what would be imported, write nothing
    --limit N        process at most N uploads (newest first)
    --no-ai          skip AI parsing (regex passage + raw title only)
    --include-all    import non-sermon uploads too
    --no-transcripts skip queueing auto-caption import
    --reparse        re-run AI parsing on imported YouTube sermons that are
                     missing a preacher (uses the stored youtube_title);
                     requires AI parsing
    --backfill-dates fetch missing YouTube upload dates from video metadata
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from datetime import datetime
from typing import Iterator
from urllib.parse import urlsplit, urlunsplit

import yt_dlp
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.sermon import Sermon
from app.services.sermon_title_parser import (
    SermonTitleParser,
    build_title_parser,
    parse_title_with_fallback,
)
from app.services.youtube import (
    apply_youtube_source,
    fetch_video_metadata,
    parse_youtube_video_id,
    set_youtube_source_metadata,
)


def _videos_tab_url(channel_url: str) -> str:
    """Use a channel's Videos tab instead of its landing page.

    YouTube's channel landing page may expose only featured playlists (and
    sometimes no video entries at all). The Videos tab is the upload feed and
    is where recent sermons, including newly published uploads, are listed.
    """
    url = channel_url.strip()
    parts = urlsplit(url)
    path = parts.path.rstrip("/")
    if not parts.netloc or not path:
        return url
    tab_suffixes = ("/videos", "/streams", "/shorts", "/playlists", "/community", "/about")
    if path.endswith(tab_suffixes):
        return url
    return urlunsplit((parts.scheme, parts.netloc, f"{path}/videos", parts.query, parts.fragment))


def iter_channel_uploads(
    channel_url: str,
    limit: int | None = None,
) -> Iterator[dict]:
    """Yield ``{"video_id", "title", "upload_date", "thumbnail"}`` for
    channel uploads."""
    opts = {
        "extract_flat": True,
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(_videos_tab_url(channel_url), download=False)

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
            "thumbnail": entry.get("thumbnail"),
        }
        count += 1
        if limit is not None and count >= limit:
            return


def _parse_upload_date(value: str | None) -> "datetime.date | None":
    """Turn a yt-dlp YYYYMMDD upload date into a date, or None."""
    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y%m%d").date()
    except ValueError:
        return None


def backfill_upload_dates(
    db: Session,
    *,
    limit: int | None = None,
    dry_run: bool = False,
) -> dict:
    """Fetch missing YouTube upload dates without downloading video media."""
    sermons = db.scalars(
        select(Sermon)
        .where(
            Sermon.youtube_video_id.is_not(None),
            Sermon.preached_at.is_(None),
        )
        .order_by(Sermon.created_at)
    ).all()
    if limit is not None:
        sermons = sermons[:limit]

    updated = 0
    failed = 0
    for sermon in sermons:
        video_id = sermon.youtube_video_id
        try:
            metadata = fetch_video_metadata(
                f"https://www.youtube.com/watch?v={video_id}"
            )
        except Exception as exc:
            failed += 1
            print(f"[date] failed {video_id}: {exc}")
            continue

        if metadata.upload_date is None:
            failed += 1
            print(f"[date] no upload date available for {video_id}")
            continue

        if dry_run:
            print(f"[dry-run] would set {video_id}: {metadata.upload_date}")
            continue

        sermon.preached_at = metadata.upload_date
        if not sermon.youtube_thumbnail_url and metadata.thumbnail_url:
            sermon.youtube_thumbnail_url = metadata.thumbnail_url
        db.commit()
        updated += 1
        print(f"[date] {video_id}: {metadata.upload_date}")

    return {"updated": updated, "failed": failed}


def import_videos(
    db: Session,
    user_id: uuid.UUID,
    items: list[dict],
    dry_run: bool = False,
    *,
    parser: SermonTitleParser | None = None,
    include_all: bool = False,
    no_transcripts: bool = False,
) -> dict:
    """Create sermons for *items*, skipping existing youtube_video_ids.

    Each title is parsed (AI by default, regex fallback) into
    {title, preacher, scripture_reference, is_sermon}; non-sermon uploads
    are skipped unless include_all=True. Returns counts for
    created / skipped (already imported) / skipped_non_sermons.
    """
    created = 0
    skipped = 0
    skipped_non_sermons = 0
    for item in items:
        video_id = item["video_id"]
        exists = db.scalars(
            select(Sermon).where(Sermon.youtube_video_id == video_id)
        ).first()
        if exists is not None:
            skipped += 1
            continue

        original_title = item["title"] or f"YouTube {video_id}"
        parsed = parse_title_with_fallback(original_title, parser)

        if not parsed["is_sermon"] and not include_all:
            skipped_non_sermons += 1
            print(f"[skip] not a sermon: {original_title!r} ({video_id})")
            continue

        url = f"https://www.youtube.com/watch?v={video_id}"
        if dry_run:
            print(
                f"[dry-run] would import: {parsed['title']!r} — "
                f"{parsed['scripture_reference'] or 'no passage'} — "
                f"{parsed['preacher'] or 'no preacher'} ({video_id})"
            )
            continue

        sermon = Sermon(
            created_by_user_id=user_id,
            title=parsed["title"],
            preacher=parsed["preacher"],
            scripture_reference=parsed["scripture_reference"],
            preached_at=_parse_upload_date(item.get("upload_date")),
            source_type="youtube",
            source_url=url,
            youtube_title=original_title,
            youtube_thumbnail_url=item.get("thumbnail"),
        )
        db.add(sermon)
        db.flush()
        if no_transcripts:
            set_youtube_source_metadata(sermon, url)
        else:
            apply_youtube_source(db, sermon, url)
        db.commit()
        created += 1
        print(
            f"[import] {parsed['title']} — {parsed['scripture_reference'] or 'no passage'} "
            f"({parsed['preacher'] or 'no preacher'}, {video_id})"
        )

    return {
        "created": created,
        "skipped": skipped,
        "skipped_non_sermons": skipped_non_sermons,
    }


def reparse_videos(
    db: Session,
    *,
    parser: SermonTitleParser,
    limit: int | None = None,
    dry_run: bool = False,
) -> dict:
    """Re-run AI parsing on imported YouTube sermons missing a preacher.

    Uses the stored youtube_title (falling back to the current title) so the
    parse can be redone offline after prompt improvements. Only rows whose
    parsed metadata actually changes are counted as updated.
    """
    sermons = db.scalars(
        select(Sermon)
        .where(Sermon.youtube_video_id.is_not(None), Sermon.preacher.is_(None))
        .order_by(Sermon.created_at)
    ).all()
    if limit is not None:
        sermons = sermons[:limit]

    updated = 0
    unchanged = 0
    for sermon in sermons:
        original_title = sermon.youtube_title or sermon.title or ""
        if not original_title:
            unchanged += 1
            continue
        parsed = parse_title_with_fallback(original_title, parser)
        if dry_run:
            print(
                f"[dry-run] would reparse {sermon.youtube_video_id}: "
                f"title={parsed['title']!r} scripture="
                f"{parsed['scripture_reference'] or 'none'} preacher="
                f"{parsed['preacher'] or 'none'}"
            )
            continue
        if (
            sermon.title == parsed["title"]
            and sermon.preacher == parsed["preacher"]
            and sermon.scripture_reference == parsed["scripture_reference"]
        ):
            unchanged += 1
            continue
        sermon.title = parsed["title"]
        sermon.preacher = parsed["preacher"]
        sermon.scripture_reference = parsed["scripture_reference"]
        db.add(sermon)
        db.commit()
        updated += 1
        print(
            f"[reparse] {sermon.youtube_video_id}: "
            f"preacher={parsed['preacher']!r} "
            f"scripture={parsed['scripture_reference']!r}"
        )

    return {"updated": updated, "unchanged": unchanged}


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
        default=None,
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
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Skip AI title parsing (regex passage + raw title only).",
    )
    parser.add_argument(
        "--include-all",
        action="store_true",
        help="Import non-sermon uploads (announcements, recaps, promos) too.",
    )
    parser.add_argument(
        "--no-transcripts",
        action="store_true",
        help="Skip queueing auto-caption import for new sermons.",
    )
    parser.add_argument(
        "--reparse",
        action="store_true",
        help="Re-run AI parsing on imported YouTube sermons missing a preacher.",
    )
    parser.add_argument(
        "--backfill-dates",
        action="store_true",
        help="Fetch and save missing YouTube upload dates; does not download video media.",
    )
    args = parser.parse_args()

    if args.reparse and args.no_ai:
        print("--reparse requires AI parsing; drop --no-ai.")
        sys.exit(1)

    db = SessionLocal()
    try:
        parser_ai = None if args.no_ai else build_title_parser()

        if args.reparse:
            result = reparse_videos(
                db, parser=parser_ai, limit=args.limit, dry_run=args.dry_run
            )
            print(
                f"Done. updated={result['updated']} unchanged={result['unchanged']}"
            )
            return

        if args.backfill_dates:
            result = backfill_upload_dates(
                db, limit=args.limit, dry_run=args.dry_run
            )
            print(f"Done. updated={result['updated']} failed={result['failed']}")
            return

        if not args.channel:
            print(
                "Pass --channel <url> to import, or --reparse to re-run "
                "parsing on existing sermons."
            )
            sys.exit(1)

        # A dry run only fetches and parses metadata; it does not need an
        # owner UUID. Require one only when rows will actually be created.
        user_id = None if args.dry_run else _resolve_user_id(db, args.user_id)
        if user_id is None and not args.dry_run:
            print(
                "No user found. Pass --user-id <uuid> or set AFTER_SUNDAY_USER_ID."
            )
            sys.exit(1)

        items = list(iter_channel_uploads(args.channel, limit=args.limit))
        if not items:
            print("No uploads found for that channel URL.")
            sys.exit(1)

        result = import_videos(
            db,
            user_id or uuid.uuid4(),
            items,
            dry_run=args.dry_run,
            parser=parser_ai,
            include_all=args.include_all,
            no_transcripts=args.no_transcripts,
        )
        print(
            f"Done. created={result['created']} skipped={result['skipped']} "
            f"non-sermons={result['skipped_non_sermons']} ({len(items)} total)"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()