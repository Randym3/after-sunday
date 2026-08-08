# After Sunday — Next Recommended Task

> **Status: completed 2026-08-08.** See the stabilization report in the agent thread for files changed, checks run, remaining mocks, and technical debt. `02_CURRENT_STATE.md` was updated to match. The next milestone is the FastAPI sermon vertical slice (`08_BACKEND_FIRST_SLICE.md`).

## Task

**Stabilize and polish the current mocked sermon workflow before starting FastAPI integration.**

## Goal

A church staff user should be able to:

```txt
Create Sermon
→ choose source
→ optionally provide transcript
→ arrive in workspace
→ understand transcript state
→ review transcript
→ generate mocked follow-up
→ edit it
→ preview it
→ approve it
```

without confusing prototype behavior.

## Inspect First

Relevant files likely include:

```txt
web/src/types/sermon.ts
web/src/components/sermons/SermonForm.tsx
web/src/components/sermons/CreateSermonFlow.tsx
web/src/components/sermons/SermonWorkspace.tsx
web/src/components/sermons/FollowUpEditor.tsx
web/src/components/sermons/EmailPreview.tsx
web/src/app/(protected)/app/sermons/new/page.tsx
web/src/app/(protected)/app/sermons/[sermonId]/page.tsx
```

Verify names before editing.

## Required Checks / Improvements

### Source + Transcript Behavior

Expected:

```txt
Upload + no transcript
→ Processing/Transcribing

Upload + transcript
→ Transcript Ready

YouTube + no transcript
→ Queued

YouTube + transcript
→ Transcript Ready

Paste Transcript
→ transcript required
→ Transcript Ready
```

### Demo Controls

If `Mark Transcript Ready` exists, clearly identify it as a prototype/development action. Do not make it look like a production action.

### Approval Invalidation

Expected:

```txt
Draft approved
→ edit subject/body
→ Needs Review
```

Also verify transcript edits intentionally invalidate downstream approval where appropriate.

### Persistence Clarity

The current prototype uses `sessionStorage`.

The UI must not imply an MP3/MP4 was actually uploaded or permanently saved.

### Navigation

Add or verify simple navigation back to `/app/sermons` and/or to create another sermon.

Do not build a real sermon database list yet.

### Responsive Review

Check:

- source cards
- long YouTube URLs
- transcript editor
- follow-up editor
- email preview
- action buttons
- generation swirl

### Verification

Run:

```bash
cd web
npm run lint
npm run build
```

## Do Not Build Here

- FastAPI integration
- PostgreSQL
- object storage
- real transcription
- AI API calls
- YouTube OAuth
- recipients
- email sending
- billing

## Deliverable

Report:

1. files changed
2. UX/state inconsistencies fixed
3. lint/build results
4. technical debt before backend work
5. whether the UI is stable enough to become the API contract
