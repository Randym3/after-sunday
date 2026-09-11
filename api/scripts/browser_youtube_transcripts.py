"""Import YouTube transcripts through the visible browser transcript panel.

This is a cautious, terminal-run fallback for cases where the direct
``youtube-transcript-api`` request is blocked but YouTube shows a transcript
when opened normally in a browser. It uses a persistent Chromium profile so
an operator can sign in once if YouTube requires it.

The script defaults to ONE sermon per run. It stops on CAPTCHA, bot checks,
consent interruptions, or other block signals. It never tries to bypass those
checks and never retries the same video in a loop.

Install once from the api/ directory:

    .venv/bin/python -m pip install playwright
    .venv/bin/python -m playwright install chromium

Pilot commands:

    .venv/bin/python -m scripts.browser_youtube_transcripts --dry-run
    .venv/bin/python -m scripts.browser_youtube_transcripts --headed
    .venv/bin/python -m scripts.browser_youtube_transcripts --limit 10 --delay 20 --headed

Use ``--headed`` for the first run so you can see the browser and sign in if
needed. The default profile is ``.freebuff/youtube-browser-profile`` under the
repository. Pass ``--profile-dir`` to use a different profile.
"""

from __future__ import annotations

import argparse
import re
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.db import SessionLocal
from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob

NO_CAPTIONS_MARKER = "[no-english-captions]"
BROWSER_MARKER = "[browser-transcript]"


class BrowserTranscriptError(RuntimeError):
    """A browser transcript could not be safely extracted."""


class BrowserBlockedError(BrowserTranscriptError):
    """YouTube presented a bot check, CAPTCHA, or access interruption."""


_BLOCK_MARKERS = (
    "before you continue to youtube",
    "verify you're human",
    "verify you are human",
    "not a robot",
    "unusual traffic",
    "www.google.com/recaptcha",
    "captcha",
    "confirm you're not a bot",
    "confirm you are not a bot",
)
_UNAVAILABLE_MARKERS = (
    "video unavailable",
    "this video is unavailable",
    "this video has been removed",
    "private video",
)


_TIMESTAMP_PREFIX_RE = re.compile(
    r"^(?:(?:(?:\d{1,2}:)?\d{1,2}:\d{2})|"
    r"(?:(?:\d+\s+(?:hours?|minutes?|seconds?)(?:,\s*|\s+|$))+))\s*",
    re.IGNORECASE,
)


def clean_transcript_segments(segments: list[str]) -> str:
    """Normalize visible transcript segment text without changing wording."""
    cleaned: list[str] = []
    for segment in segments:
        text = re.sub(r"\s+", " ", segment).strip()
        # YouTube exposes timestamps in both clock form (0:03) and
        # accessibility form (3 seconds / 1 minute, 8 seconds).
        text = _TIMESTAMP_PREFIX_RE.sub("", text)
        if text:
            cleaned.append(text)
    return "\n\n".join(cleaned)


def _page_text(page: Any) -> str:
    # Playwright timeouts are milliseconds; allow the YouTube page time to
    # finish rendering before deciding that its body is unavailable.
    return (page.locator("body").inner_text(timeout=10_000) or "").lower()


def _check_for_block(page: Any) -> None:
    body = _page_text(page)
    if any(marker in body for marker in _BLOCK_MARKERS):
        raise BrowserBlockedError(
            "YouTube presented a CAPTCHA, bot check, consent screen, or "
            "human-verification page. The run stopped without retrying."
        )
    if any(marker in body for marker in _UNAVAILABLE_MARKERS):
        raise BrowserTranscriptError("YouTube reports that this video is unavailable.")


def _click_first_visible(page: Any, candidates: list[Any], description: str) -> None:
    """Click the first visible candidate, tolerating small YouTube UI changes."""
    for candidate in candidates:
        try:
            count = candidate.count()
            for index in range(count):
                item = candidate.nth(index)
                if item.is_visible():
                    item.click(timeout=5_000)
                    return
        except Exception:
            continue
    raise BrowserTranscriptError(f"YouTube did not expose a visible {description} control.")


def _expand_description(page: Any) -> None:
    """Expand the description before looking for its transcript action."""
    candidates = [
        page.locator("ytd-watch-metadata #description-inline-expander #expand"),
        page.locator("ytd-text-inline-expander #expand"),
        page.locator("ytd-video-description-infocards-section-renderer #expand"),
        page.locator("tp-yt-paper-button#expand"),
        page.get_by_role("button", name=re.compile(r"show more|more", re.I)),
        page.get_by_text(re.compile(r"^more$", re.I)),
    ]
    try:
        _click_first_visible(page, candidates, "description 'More'")
        page.wait_for_timeout(750)
    except BrowserTranscriptError:
        # Some layouts show the full description already. The transcript
        # action is still authoritative, so continue and let that lookup
        # produce the useful error if it is genuinely absent.
        return


def _extract_transcript_panel_text(page: Any) -> str:
    """Read the open transcript panel using its visible text structure.

    YouTube has changed the transcript custom-element names more than once.
    The panel itself is more stable: it contains the ``Search transcript``
    control and timestamped lines. This fallback finds that panel and removes
    headings/timestamps without depending on private element names.
    """
    return page.evaluate(
        """() => {
          const visible = (node) => {
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' &&
              rect.width > 0 && rect.height > 0;
          };
          const timestamp = /^(?:(?:(?:\\d{1,2}:)?\\d{1,2}:\\d{2})|(?:(?:\\d+\\s+(?:hours?|minutes?|seconds?)(?:,\\s*|\\s+|$))+))\\s*/i;
          const timestampLine = /^(?:(?:(?:\\d{1,2}:)?\\d{1,2}:\\d{2})|(?:(?:\\d+\\s+(?:hours?|minutes?|seconds?)(?:,\\s*|\\s+|$))+))\\b/i;
          const searchCandidates = Array.from(document.querySelectorAll(
            'input[placeholder*="Search transcript" i], textarea[placeholder*="Search transcript" i], ' +
            '[aria-label*="Search transcript" i], button, yt-formatted-string, span, div'
          )).filter((candidate) => {
            if (!visible(candidate)) return false;
            const text = (candidate.innerText || candidate.getAttribute('aria-label') || '').trim();
            return /^search transcript$/i.test(text) ||
              /search transcript/i.test(candidate.getAttribute('placeholder') || '');
          });
          const search = searchCandidates[0];
          if (!search) return '';

          let panel = null;
          let node = null;
          const transcriptRoots = [
            'ytd-transcript-renderer',
            'ytd-engagement-panel-section-list-renderer',
            'ytd-transcript-segment-list-renderer',
            'yt-transcript-renderer',
            '[class*="transcript"]'
          ];
          for (const selector of transcriptRoots) {
            for (const candidate of document.querySelectorAll(selector)) {
              if (visible(candidate) && candidate.innerText &&
                  candidate.innerText.toLowerCase().includes('transcript')) {
                const text = candidate.innerText.trim();
                const timestamps = (text.match(new RegExp(`(?:^|\\n)${timestampLine.source}`, 'gmi')) || []).length;
                if (timestamps > 0) {
                  panel = candidate;
                  break;
                }
              }
            }
            if (panel) break;
          }
          if (!panel) {
            // Last resort: walk upward from the search control. YouTube can
            // place the transcript in an anonymous engagement-panel subtree.
            node = search;
            for (let depth = 0; node && depth < 16; depth += 1, node = node.parentElement) {
              const text = (node.innerText || '').trim();
              const timestamps = (text.match(new RegExp(`(?:^|\\n)${timestampLine.source}`, 'gmi')) || []).length;
              if (timestamps > 0 && text.toLowerCase().includes('transcript')) {
                panel = node;
                break;
              }
            }
          }
          if (!panel) return '';

          const lines = (panel.innerText || '').split(/\\n+/)
            .map((line) => line.replace(/\\s+/g, ' ').trim())
            .filter(Boolean);
          const output = [];
          let current = '';
          let sawTimestamp = false;
          for (const line of lines) {
            const match = line.match(timestamp);
            if (match) {
              if (current) output.push(current);
              current = line.slice(match[0].length).trim();
              sawTimestamp = true;
            } else if (!/^(transcript|search transcript)$/i.test(line)) {
              // In the current layout the timestamp and spoken text can be
              // separate lines. Subsequent lines may also be wrapped text.
              if (sawTimestamp && !current) current = line;
              else if (current) current += ` ${line}`;
            }
          }
          if (current) output.push(current);
          return output.join('\\n\\n');
        }"""
    )


def _click_show_transcript(page: Any) -> None:
    """Click YouTube's transcript control after expanding the description."""
    _expand_description(page)
    candidates = [
        page.locator("ytd-video-description-transcript-section-renderer button"),
        page.locator("ytd-video-description-transcript-section-renderer yt-button-shape"),
        page.get_by_role("button", name=re.compile(r"show transcript", re.I)),
        page.get_by_text(re.compile(r"^show transcript$", re.I)),
    ]
    _click_first_visible(page, candidates, "'Show transcript'")


def extract_visible_transcript(page: Any, timeout_ms: int = 12_000) -> str:
    """Open and extract the transcript panel from a YouTube video page.

    YouTube currently renders each line as
    ``ytd-transcript-segment-renderer``. The fallback selectors cover the
    alternate segment text elements used by recent desktop layouts.
    """
    _check_for_block(page)
    _click_show_transcript(page)

    selectors = (
        "ytd-transcript-segment-renderer #content-text",
        "ytd-transcript-segment-renderer .segment-text",
        "ytd-transcript-segment-renderer yt-formatted-string.segment-text",
        "ytd-transcript-segment-renderer [role=button]",
        "ytd-transcript-renderer ytd-transcript-segment-renderer",
        "yt-transcript-segment-renderer #content-text",
        "yt-transcript-segment-renderer .segment-text",
        "yt-transcript-segment-renderer [class*='segment-text']",
        "ytd-transcript-segment-list-renderer .segment-text",
        "yt-transcript-segment-list-renderer .segment-text",
        "[class*='transcript-segment']",
        "[class*='segment-text']",
    )
    deadline = time.monotonic() + timeout_ms / 1000
    while time.monotonic() < deadline:
        for selector in selectors:
            locator = page.locator(selector)
            if locator.count() == 0:
                continue
            segments = [
                text
                for text in locator.all_inner_texts()
                if text.strip()
            ]
            transcript = clean_transcript_segments(segments)
            if transcript:
                return transcript

        # Fallback for the current layout: read the open panel's timestamped
        # visible lines rather than relying on YouTube's custom tag names.
        transcript = _extract_transcript_panel_text(page)
        if transcript:
            return transcript
        time.sleep(0.25)

    _check_for_block(page)
    raise BrowserTranscriptError(
        "YouTube opened the transcript control, but no transcript segments "
        "became visible."
    )


def _load_sermon_ids(db, include_active: bool, limit: int | None) -> list:
    sermons = db.scalars(
        select(Sermon).where(
            Sermon.source_type == "youtube",
            Sermon.transcript_status != "ready",
            Sermon.youtube_video_id.is_not(None),
        ).order_by(Sermon.created_at.asc())
    ).all()
    if not include_active:
        sermons = [
            sermon
            for sermon in sermons
            if sermon.transcript_status not in ("queued", "processing")
        ]

    # Try ordinary failures first. Existing no-caption markers are last because
    # the browser fallback is most useful for transient/direct-fetch failures.
    sermons.sort(
        key=lambda sermon: NO_CAPTIONS_MARKER in (sermon.transcript_error or "")
    )
    ids = [sermon.id for sermon in sermons]
    return ids[:limit] if limit is not None else ids


def _get_or_create_job(db, sermon: Sermon) -> TranscriptionJob:
    job = db.scalars(
        select(TranscriptionJob).where(TranscriptionJob.sermon_id == sermon.id)
    ).first()
    if job is None:
        job = TranscriptionJob(
            id=sermon.id,
            sermon_id=sermon.id,
            provider="youtube_browser",
            status="processing",
        )
        db.add(job)
    else:
        job.provider = "youtube_browser"
        job.status = "processing"
        job.result_text = None
        job.error_message = None
        job.started_at = datetime.now(timezone.utc)
        job.completed_at = None
    return job


def _save_success(db, sermon: Sermon, transcript: str) -> None:
    job = _get_or_create_job(db, sermon)
    job.result_text = transcript
    job.status = "completed"
    job.completed_at = datetime.now(timezone.utc)
    sermon.transcript = transcript
    sermon.transcript_status = "ready"
    sermon.transcript_error = None
    db.commit()


def _save_failure(db, sermon: Sermon, exc: BaseException) -> None:
    job = _get_or_create_job(db, sermon)
    detail = f"{BROWSER_MARKER} {type(exc).__name__}: {exc}"
    sermon.transcript_status = "failed"
    sermon.transcript_error = detail[:500]
    job.status = "failed"
    job.error_message = traceback.format_exc()
    db.commit()


def _run_browser(
    sermon_ids: list,
    *,
    profile_dir: Path,
    headed: bool,
    delay: float,
) -> dict[str, int]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright is not installed. Run from api/: "
            ".venv/bin/python -m pip install playwright && "
            ".venv/bin/python -m playwright install chromium"
        ) from exc

    counts = {"ok": 0, "failed": 0, "blocked": 0, "skipped": 0}
    db = SessionLocal()
    try:
        with sync_playwright() as playwright:
            profile_dir.mkdir(parents=True, exist_ok=True)
            context = playwright.chromium.launch_persistent_context(
                str(profile_dir),
                headless=not headed,
                viewport={"width": 1440, "height": 1000},
            )
            try:
                page = context.pages[0] if context.pages else context.new_page()
                for index, sermon_id in enumerate(sermon_ids, start=1):
                    sermon = db.get(Sermon, sermon_id)
                    if sermon is None:
                        counts["skipped"] += 1
                        continue
                    if sermon.transcript_status == "ready":
                        counts["skipped"] += 1
                        print(f"[{index}/{len(sermon_ids)}] SKIP {sermon.title!r} — already ready")
                        continue

                    video_id = sermon.youtube_video_id
                    url = f"https://www.youtube.com/watch?v={video_id}"
                    print(
                        f"[{index}/{len(sermon_ids)}] {video_id} {sermon.title!r} ...",
                        flush=True,
                    )
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                        page.wait_for_timeout(2_000)
                        transcript = extract_visible_transcript(page)
                        _save_success(db, sermon, transcript)
                        counts["ok"] += 1
                        print(f"    OK ({len(transcript):,} chars)")
                    except BrowserBlockedError as exc:
                        db.rollback()
                        _save_failure(db, sermon, exc)
                        counts["blocked"] += 1
                        print(f"    STOPPED: {exc}")
                        print("Stopping the whole run; resolve the browser check and rerun later.")
                        break
                    except Exception as exc:
                        db.rollback()
                        _save_failure(db, sermon, exc)
                        counts["failed"] += 1
                        print(f"    FAILED: {type(exc).__name__}: {exc}")

                    if index < len(sermon_ids):
                        time.sleep(delay)
            finally:
                context.close()
    finally:
        db.close()
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract YouTube transcripts through the visible browser panel."
    )
    parser.add_argument("--limit", type=int, default=1, help="Maximum sermons (default: 1).")
    parser.add_argument("--delay", type=float, default=15.0, help="Seconds between videos (default: 15).")
    parser.add_argument("--headed", action="store_true", help="Show Chromium (recommended for the pilot).")
    parser.add_argument("--dry-run", action="store_true", help="List candidates without opening a browser or writing data.")
    parser.add_argument("--include-active", action="store_true", help="Include queued/processing sermons; only use when no worker owns them.")
    parser.add_argument(
        "--profile-dir",
        type=Path,
        default=Path(".freebuff/youtube-browser-profile"),
        help="Persistent Chromium profile directory.",
    )
    args = parser.parse_args()
    if args.limit < 1:
        parser.error("--limit must be at least 1")
    if args.delay < 0:
        parser.error("--delay cannot be negative")

    db = SessionLocal()
    try:
        sermon_ids = _load_sermon_ids(db, args.include_active, args.limit)
        print(f"{len(sermon_ids)} sermon(s) selected.")
        for sermon_id in sermon_ids:
            sermon = db.get(Sermon, sermon_id)
            if sermon is not None:
                print(f"  {sermon.youtube_video_id}  {sermon.title}  [{sermon.transcript_status}]")
        if args.dry_run or not sermon_ids:
            if not sermon_ids:
                print("Nothing to do.")
            return
    finally:
        db.close()

    counts = _run_browser(
        sermon_ids,
        profile_dir=args.profile_dir,
        headed=args.headed,
        delay=args.delay,
    )
    print(
        "Done: "
        + " ".join(f"{key}={value}" for key, value in counts.items())
    )


if __name__ == "__main__":
    main()
