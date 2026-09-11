# Browser-based YouTube transcript fallback

`api/scripts/browser_youtube_transcripts.py` is a cautious, terminal-run fallback for
YouTube videos where the normal `youtube-transcript-api` request is blocked but
the video page visibly offers **Show transcript**.

It opens each candidate in Chromium, clicks the visible transcript control, extracts
the rendered transcript segments, and saves the result directly to the matching
sermon and transcription-job rows. Candidates with an existing
`[no-english-captions]` error are tried last.

## One-video pilot

From the `api/` directory:

```bash
.venv/bin/python -m pip install playwright
.venv/bin/python -m playwright install chromium
.venv/bin/python -m scripts.browser_youtube_transcripts --dry-run
.venv/bin/python -m scripts.browser_youtube_transcripts --headed
```

The first headed run stores a persistent browser profile in
`api/.freebuff/youtube-browser-profile`. If YouTube asks for sign-in, complete
that manually in the visible browser, then rerun the command. The script defaults
to one sermon so the first attempt is easy to inspect.

After a successful pilot, a small batch can be run with a conservative delay:

```bash
.venv/bin/python -m scripts.browser_youtube_transcripts --limit 10 --delay 20 --headed
```

## Safety behavior

- It processes one sermon at a time and defaults to one sermon per invocation.
- It skips ready, queued, and processing sermons unless `--include-active` is used.
- It stops the whole run if YouTube shows a CAPTCHA, bot check, consent/access
  interruption, or similar block signal.
- It records browser failures on `sermons.transcript_error` and the complete
  traceback on `transcription_jobs.error_message`.
- It does not attempt to bypass CAPTCHA, evade YouTube controls, or rotate
  accounts/IPs.
- This is a browser-rendered fallback, not a separate YouTube transcript API;
  it is reading the same caption transcript YouTube displays to a user.
