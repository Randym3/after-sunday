# After Sunday — Start Here

## What You Are Building

After Sunday helps churches turn sermons into pastoral follow-up.

The user is **church staff**, not the recipient/member.

```txt
Login
→ Create sermon
→ Choose sermon source
→ Obtain/review transcript
→ Generate follow-up draft
→ Edit
→ Preview
→ Approve
→ Select recipients
→ Send
```

The initial member experience is simply receiving the church's follow-up email.

## Sermon Sources

### Upload Recording

Examples:

```txt
MP3
M4A
WAV
MP4
WebM
```

An optional transcript may also be pasted. If a transcript is provided, automatic transcription can be skipped.

### YouTube

The user provides a YouTube sermon URL. An optional transcript may also be pasted.

Long-term, churches should be able to connect their own YouTube account/channel. Do not build production behavior around scraping arbitrary public YouTube transcript pages.

### Paste Transcript

The user already has a transcript and pastes it directly. The transcript is required for this source type.

## Current Development Stage

The frontend prototype demonstrates much of the core workflow using local browser state and `sessionStorage`.

There is **no real sermon persistence, media storage, transcription API, AI generation API, recipient system, or email sending yet**.

That is intentional.

## Core Principle

> AI-generated pastoral content must be reviewed and explicitly approved by church staff before sending.

If approved content is edited afterward, it should return to a review-needed state.

## Read Next

- `01_PRODUCT_SPEC.md`
- `02_CURRENT_STATE.md`
- `03_ARCHITECTURE.md`
- `04_ROADMAP.md`
- `05_IMPLEMENTATION_STANDARDS.md`
- `06_AGENT_WORKFLOW.md`
- `07_NEXT_TASK.md`
