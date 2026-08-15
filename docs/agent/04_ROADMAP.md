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

Status: complete (2026-08-10). Velma (Modulate) batch STT is wired behind the `TranscriptionProvider` interface: `api/app/services/transcription.py` + `transcription_jobs` table (migration 0005) + background worker driving `queued → processing → ready`. Uses `MODULATE_API_KEY`; falls back to the mock provider when unset (dev only). Verified end-to-end with real audio.

Velma already provides most of the transcript intelligence a sermon tool could want — no extra plumbing required:

- **Per-utterance output with timestamps** (`start_ms`/`duration_ms` per utterance) — we rebuild the transcript from utterances: speaker changes and silence gaps ≥ 1.5s start a new paragraph. Note: Velma's utterances can be very long (60s+ of continuous speech on real sermons), so paragraphing is primarily sentence-count-based (~3 sentences per paragraph), with pause/speaker breaks layered on top. Tuning knobs live in `api/app/services/transcription.py` (`SENTENCES_PER_PARAGRAPH`, `PAUSE_PARAGRAPH_THRESHOLD_MS`).
- **Speaker diarization** — per-utterance speaker labels; we send `speaker_diarization=true`. Note: labels are `Speaker 1 / Speaker 2` (by order of appearance), not names — mapping them to members is future work.
- **Emotion, accent, deepfake score, PII/PHI tagging** — opt-in request params on the same batch endpoint (`emotion_signal`, `accent_signal`, `deepfake_signal`, `pii_phi_tagging`).
- **100 MB file cap, accepts MP4 directly** — no ffmpeg/audio-extraction step (unlike OpenAI's 25 MB cap). ~$0.03/hr batch pricing; ~400 free hours.

Reference: https://docs.modulate.ai/llms.txt — Speech-to-Text Transcription Batch Multilingual is the endpoint we use: https://docs.modulate.ai/api-reference/stt/batch.md

Remaining: store the raw `utterances` JSON on the job row so a future "click a paragraph → seek the video" or speaker-labeled transcript view doesn't lose the timestamps. (Paragraph breaks are computed at transcription time; the timestamps themselves are currently discarded.)

## Phase 7 — Real Follow-Up Generation

Status: complete (2026-08-10). Real follow-up generation is wired end-to-end:

- `api/app/services/follow_up.py` — `FollowUpProvider` abstraction with a mock and an OpenAI-compatible provider (Groq by default, configurable base URL so OpenRouter / GitHub Models / NVIDIA NIM / local servers are a config swap — no new dependencies; `openai` was already in requirements). Uses `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` from `api/.env`; falls back to mock when no key (dev only).
- `POST /sermons/{id}/follow-up/generate` — validates a `ready` transcript (409 otherwise), calls the provider with title/preacher/scripture/transcript, and persists `follow_up_subject` / `follow_up_body` with `ai_draft_status=draft_ready` and `email_status=draft` on the sermon row (survives reloads).
- Workspace: Generate / Save Draft / Approve are real API calls (`PATCH` persists drafts and approval); the browser-local mock only remains for the legacy `demo` path.

Provider is swappable at runtime via env vars; free tiers (Groq 1,000 req/day) are ample for church volume. See `docs/agent/04_ROADMAP.md` notes and the free-LLM-API comparison in the agent thread.

Remaining in this phase (deferred): per-version draft history, and storing which provider/model generated a draft.

## Phase 8 — YouTube Integration

After upload/transcription works:

- authenticated Google/YouTube connection
- list/select authorized church videos where practical
- import captions when permitted
- fallback when unavailable

## Phase 9 — Recipients and Groups

Status: groups complete (2026-08-12); email campaigns pending.

- groups + group_members tables (migration 0007)
- /groups CRUD + membership endpoints; MemberRead carries groupIds
- groups list/create/detail pages; member form group multi-select
- campaign creation/listing + recipient resolution (migration 0008), sermon-linked email drafts, schedule (one-time or weekly; migration 0010), and edit/delete/bulk-delete implemented; email sending remains pending

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
