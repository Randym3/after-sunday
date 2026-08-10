# After Sunday — Ordered Development Roadmap

## Phase 0 — Frontend Foundation

Status: complete.

- marketing site
- Supabase auth (incl. forgot/reset password)
- protected app shell
- reusable UI components

## Phase 1 — Multi-Source Sermon Creation

Status: complete.

- Upload Recording
- YouTube
- Paste Transcript
- optional transcript for Upload/YouTube
- conditional validation
- all three sources create real sermon rows

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
- edit page shares the create form, organized into Sermon Details / AI Draft tabs with a fade transition

## Phase 3 — Stabilize Frontend Prototype

Status: complete (stabilization pass done; subsequent polish: sidebar height, cursor pointers, responsive list tables).

1. Review create → workspace flow. ✅
2. Remove prototype UX rough edges. ✅
3. Clarify demo-only controls. ✅
4. Verify approval invalidation. ✅
5. Verify mobile behavior. ✅
6. Run lint/build. ✅
7. Add high-value tests if practical. ⏳ not yet
8. Treat this stable UI as the contract for the first backend slice. ✅

## Phase 4 — FastAPI Sermon Vertical Slice

Status: complete (implemented 2026-08-08; sermons + members CRUD live against local Docker Postgres; ownership walls intentionally dropped for dev).

Endpoints:

```txt
POST   /sermons
GET    /sermons
GET    /sermons/{sermon_id}
PATCH  /sermons/{sermon_id}
PATCH  /sermons/{sermon_id}/transcript
DELETE /sermons/{sermon_id}
POST   /members
GET    /members
GET    /members/{member_id}
PATCH  /members/{member_id}
DELETE /members/{member_id}
```

Follow-up draft/approval persistence is not yet server-side (browser-local mock only).

## Phase 5 — Real Media Upload

Status: local-disk slice complete (2026-08-09). Chunked upload pipeline implemented and verified end-to-end (create → init → chunk → complete → serve → delete). Media served via `/media` StaticFiles mount; `api/storage.py` exposes a `StorageBackend` interface.

Remaining: cloud object storage (S3/R2/Supabase Storage) swap-in behind the same interface, and direct-to-bucket uploads (presigned URLs) for production-scale files.

## Phase 6 — Real Async Transcription

**Next phase.**

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
- `transcript_status` already flows `awaiting_upload → queued`; hook the queued state to a real job

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
