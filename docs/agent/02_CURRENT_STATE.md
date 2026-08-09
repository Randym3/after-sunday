# After Sunday — Current Implementation State

Agents must inspect the repository to confirm exact implementation details before editing. This file was last verified against the repo on 2026-08-08.

## Repository

```txt
after-sunday/
  AGENTS.md
  CLAUDE.md
  docs/agent/
  web/
  api/
```

## Frontend

```txt
Next.js 16.2.9 App Router
React 19.2.4
TypeScript
Tailwind CSS v4
Supabase Auth (@supabase/ssr)
```

`web/AGENTS.md` warns that this Next.js version has breaking changes and directs agents to the bundled docs at `web/node_modules/next/dist/docs/` before writing code.

## Protected Routes

Pages that exist:

```txt
/app/dashboard
/app/sermons
/app/sermons/new
/app/sermons/[sermonId]
/app/members
```

The following routes are referenced in the sidebar (`web/src/lib/constants/navigation.ts`) but are **empty directories with no page.tsx** — visiting them 404s:

```txt
/app/groups
/app/email-campaigns
/app/settings
```

The sidebar labels Members (was Recipients) and points at `/app/members`; the old empty `/app/recipients` directory was removed.

The protected layout (`web/src/app/(protected)/app/layout.tsx`) checks Supabase claims via `supabase.auth.getClaims()` and redirects unauthenticated users to `/login`.

Authentication (signup, login, logout) is real and wired to Supabase via `web/src/lib/supabase/{client,server,proxy}.ts`.

## Visual Direction

- warm off-white surfaces
- deep green brand color
- lime accents
- rounded cards
- editorial typography
- calm SaaS layout

## Sermon Model

Source types:

```txt
upload
youtube
transcript
```

Transcription states:

```txt
not_started
awaiting_upload
queued
processing
ready
failed
```

AI draft states:

```txt
not_started
generating
draft_ready
approved
```

Email states:

```txt
not_started
draft
ready
sent
```

Defined in `web/src/types/sermon.ts` exactly as above.

## Create Sermon Form

`web/src/components/sermons/SermonForm.tsx` supports:

```txt
Upload Recording
YouTube
Paste Transcript
```

Upload:
- accepts a browser `File`
- no real upload occurs
- optional transcript allowed

YouTube:
- collects URL
- optional transcript allowed
- no real YouTube integration yet

Paste Transcript:
- transcript required

Validation is client-side only and currently uses `alert()` for errors. The Cancel button links back to `/app/sermons`.

Drag-and-drop: dragging a file anywhere over the page shows a full-screen "Drop to add your recording" overlay; releasing an audio/video file anywhere attaches it to the recording and auto-selects the Upload source. Non-media files are rejected with an inline notice. The window-level drag listeners live in `web/src/components/sermons/useRecordingFileDrop.ts`.

## Mock Create Flow

`web/src/components/sermons/CreateSermonFlow.tsx` derives the initial transcript status:

```txt
Upload + transcript      -> ready
Upload, no transcript    -> processing
YouTube + transcript     -> ready
YouTube, no transcript   -> queued
Paste Transcript         -> ready
```

It stores a mock sermon in `sessionStorage` under:

```txt
after-sunday:demo-sermon
```

The actual media `File` is not stored. Only serializable metadata such as filename is stored.

The flow redirects to `/app/sermons/demo`.

**Pasted-transcript source is no longer mocked.** As of 2026-08-08 (backend slice, `08_BACKEND_FIRST_SLICE.md`), `CreateSermonFlow` `POST`s transcript-source sermons to FastAPI, gets back a real UUID, and redirects to `/app/sermons/<id>`. Upload and YouTube sources still take the `sessionStorage`/`demo` path above until the media slice.

## Sermon Workspace

`web/src/components/sermons/SermonWorkspace.tsx` can display:

- sermon title
- preacher
- scripture
- preached date
- source
- filename or YouTube URL
- transcript status
- transcript editor (with live word count)

State management depends on the sermon id:

- `sermonId === "demo"` (upload/YouTube mock): the stored sermon in `sessionStorage` is the single source of truth. The workspace subscribes to it with `useSyncExternalStore` (no effect-driven load), and every edit writes through to storage immediately. The Save buttons confirm the current state rather than being the only way to persist.
- any other id (persisted sermon): the workspace loads it via `GET /sermons/{id}` on mount, and **Save Transcript** `PATCH`es `/sermons/{id}/transcript`. Follow-up draft/approval state is browser-local in this slice (mock AI generation is unchanged) and does not persist across reloads.

Behavior notes:

- If `sessionStorage` is empty and the id is `demo` (e.g., visiting `/app/sermons/demo` directly), the workspace renders a hardcoded `fallbackSermon` ("The Good Shepherd", Psalm 23, `sunday-sermon.mp4`, status `processing`).
- A persisted id that does not exist or belongs to another user renders an "Unable to load this sermon" error state (the API returns 404).
- For mocked non-ready transcripts, a **Mark Transcript Ready** button injects a demo transcript and sets status to `ready`. It is styled as a secondary button with a "Prototype action — simulates transcription finishing..." caption so it is not mistaken for a production action.
- A **Back to sermons** link sits above the workspace header; the SermonForm **Cancel** button also returns to `/app/sermons`.
- The source card explains persistence explicitly for each source type (e.g. "Prototype only: the recording is not uploaded or saved. Only its filename is kept in this browser session.").

## Follow-Up Prototype

The current prototype includes:

```txt
Generate Follow-Up Draft
-> mocked generation delay (~700ms)
-> visual swirl/loading state
-> editable subject/body
-> live email preview
-> Save Draft
-> Approve Draft
```

The generated content is hardcoded/mock content (`buildMockFollowUp`). No AI API call occurs. The email preview (`EmailPreview.tsx`) replaces `{{ firstName }}` with "Jordan" for the member-facing preview.

Approval invalidation is implemented: editing the subject, body, or transcript after approval returns `aiDraftStatus` to `draft_ready` and `emailStatus` to `draft`. For the demo path, edits write through to `sessionStorage`, so unsaved edits survive navigation within the tab. For persisted sermons, the follow-up draft is held in component state only (mock generation; server persistence of drafts is a later step).

## Backend

As of 2026-08-09, the FastAPI app implements the sermon vertical slice (`08_BACKEND_FIRST_SLICE.md`) plus member CRUD:

```txt
GET    /                        -> status ok
GET    /health                  -> healthy
POST   /sermons                 -> create sermon (201)
GET    /sermons                 -> list all sermons (newest first)
GET    /sermons/{id}            -> get one sermon
PATCH  /sermons/{id}            -> partial update
PATCH  /sermons/{id}/transcript -> save transcript edits
POST   /members                 -> create member (201)
GET    /members                 -> list members (alphabetical)
GET    /members/{id}            -> get one member
PATCH  /members/{id}            -> partial update
DELETE /members/{id}            -> delete member
```

- **Postgres**: local Docker container (`api/docker-compose.yml`, `postgres:16-alpine`) mapped to host port **5433** because a native Postgres 17 (EDB, launchd) already occupies 5432 on this machine. Named volume `after_sunday_pgdata`.
- **Migrations**: Alembic (`api/alembic/`). `0001_create_sermons` creates `sermons`; `0002_create_members` creates `members` (unique email, `status` defaulting to `active`, ownership columns `created_by_user_id` NOT NULL + nullable `church_id`).
- **Auth**: every request requires `Authorization: Bearer <supabase access token>`; FastAPI resolves the user via Supabase's `GET /auth/v1/user` (no new dependency). **No ownership scoping** — any authenticated user can read/edit/delete any sermon or member (a deliberate dev decision after the ownership-wall removal; revisit with multi-tenancy).
- **Models/schemas**: `api/app/models/{sermon,member}.py` (SQLAlchemy), `api/app/schemas/{sermon,member}.py` (Pydantic with camelCase aliases via `api/app/schemas/aliases.py` so the API speaks the frontend `Sermon`/`Member` types).
- **Frontend client**: `web/src/lib/api/client.ts` (fetch wrapper attaching the bearer token, refreshing expired sessions), `web/src/lib/api/{sermons,members}.ts` (typed functions). `NEXT_PUBLIC_API_URL=http://localhost:8000` is already set.
- **Config**: `api/.env` (gitignored) holds `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; `api/.env.example` documents them.

`api/requirements.txt` pre-installs alembic, SQLAlchemy, psycopg, openai, and resend. `api/app.save` is a stray draft file.

## Environment

`.env.example` lives at the repository root. The actual env files are `web/.env` and `web/.env.local` (both gitignored), containing `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Lint / Build Status

`npm run lint` and `npm run build` both pass as of 2026-08-08. The two former `SermonWorkspace.tsx` errors were resolved by the stabilization pass (`docs/agent/07_NEXT_TASK.md`): the effect-driven storage load was replaced with `useSyncExternalStore`, and the manual `useMemo` was removed in favor of an inline derivation.

## Still Mocked

- media upload / object storage
- transcription provider
- asynchronous jobs
- YouTube OAuth/channel integration
- real AI generation (follow-up draft is generated in-browser and, for persisted sermons, is not yet saved server-side)
- groups (deferred; members are built, groups are not needed for MVP)
- campaign / sermon follow-up persistence and sending
- email sending
- analytics
- multi-tenant church/workspace implementation (ownership exists per-user; `church_id` column is a nullable placeholder)

Persisted sermons cover only the pasted-transcript source. Do not mistake frontend statuses for working backend behavior.
