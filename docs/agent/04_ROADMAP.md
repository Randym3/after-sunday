# After Sunday — Ordered Development Roadmap

## Phase 0 — Frontend Foundation

Status: largely complete.

- marketing site
- Supabase auth
- protected app shell
- reusable UI components

## Phase 1 — Multi-Source Sermon Creation

Status: prototype implemented.

- Upload Recording
- YouTube
- Paste Transcript
- optional transcript for Upload/YouTube
- conditional validation
- mock creation

## Phase 2 — Sermon Workspace Prototype

Status: substantially implemented.

- sermon overview
- source summary
- transcript status
- transcript editor
- mocked transcription completion
- mocked follow-up generation
- live email preview
- explicit approval workflow
- editing after approval invalidates approval

## Phase 3 — Stabilize Frontend Prototype

**Recommended next phase.**

Before backend complexity:

1. Review create → workspace flow.
2. Remove prototype UX rough edges.
3. Clarify demo-only controls.
4. Verify approval invalidation.
5. Verify mobile behavior.
6. Run lint/build.
7. Add high-value tests if practical.
8. Treat this stable UI as the contract for the first backend slice.

## Phase 4 — FastAPI Sermon Vertical Slice

Start with manual/pasted transcript persistence.

Suggested initial endpoints:

```txt
POST   /sermons
GET    /sermons
GET    /sermons/{sermon_id}
PATCH  /sermons/{sermon_id}
PATCH  /sermons/{sermon_id}/transcript
```

Then add follow-up persistence/approval endpoints.

Requirements:

- Supabase JWT verification
- tenant/resource ownership
- PostgreSQL migrations
- request/response schemas
- consistent API errors

## Phase 5 — Real Media Upload

Add direct-to-object-storage uploads with signed URLs.

## Phase 6 — Real Async Transcription

Flow:

```txt
uploaded media
→ transcription job
→ provider callback/poll
→ transcript stored
→ transcript ready
```

Requirements:

- provider abstraction
- job ID persistence
- retry/error handling
- webhook verification/idempotency where applicable

## Phase 7 — Real Follow-Up Generation

Replace mock generation with FastAPI + AI provider.

Use reviewed transcript as input.

## Phase 8 — YouTube Integration

After upload/transcription works:

- authenticated Google/YouTube connection
- list/select authorized church videos where practical
- import captions when permitted
- fallback when unavailable

## Phase 9 — Recipients and Groups

Only after sermon-to-approved-follow-up is real.

## Phase 10 — Email Sending

Requirements:

- approved draft required
- test email
- recipient validation
- send status
- error handling

## Phase 11 — SaaS Expansion

Later:

- church workspaces
- invites
- roles/permissions
- billing/subscriptions
- analytics
- richer branding
- campaign history

## MVP Success

```txt
church staff logs in
→ creates sermon
→ supplies transcript or recording
→ transcript becomes reviewable
→ generates follow-up
→ edits it
→ approves it
→ chooses recipients
→ sends it
```
