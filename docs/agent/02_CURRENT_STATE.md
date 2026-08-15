# After Sunday — Current Implementation State

Agents must inspect the repository to confirm exact implementation details before editing. This file was last verified against the repo on 2026-08-10.

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
/app/members/new
/app/members/[memberId]
/app/groups
/app/groups/new
/app/groups/[groupId]
```

The following routes are referenced in the sidebar (`web/src/lib/constants/navigation.ts`) but are **empty directories with no page.tsx** — visiting them 404s:

```txt
/app/email-campaigns
/app/settings
```

The protected layout (`web/src/app/(protected)/app/layout.tsx`) checks Supabase claims via `supabase.auth.getClaims()` and redirects unauthenticated users to `/login`.

Authentication (signup, login, logout, forgot-password, reset-password) is real and wired to Supabase via `web/src/lib/supabase/{client,server,proxy}.ts`. The reset flow lives at `/forgot-password` and `/reset-password` with a "Forgot password?" link on the login form.

## Visual Direction

- warm off-white surfaces
- deep green brand color
- lime accents
- rounded cards
- editorial typography
- calm SaaS layout
- dashboard shows stat cards (Sermons, Drafts needing review, Members) and a Create Sermon CTA
- global `cursor: pointer` for all buttons/links/selects/radios (disabled controls get `not-allowed`), set in `globals.css`

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

## Sermon Form (create + edit share one component)

`web/src/components/sermons/SermonForm.tsx` is used for both creating and editing sermons:

- **Create** (`/app/sermons/new`, via `CreateSermonFlow`): submits to `POST /sermons`; for upload sources it then runs the chunked upload (progress bar appears inline in the source card, Create button disabled until it finishes).
- **Edit** (`/app/sermons/[id]`, via `SermonWorkspace`): renders the same form pre-filled from the existing sermon, with a **Save Changes** button. Editing metadata (title/preacher/scripture/date/source) silently clears existing AI follow-up drafts and resets `aiDraftStatus`/`emailStatus` to `not_started` with an inline confirmation.

### Source types

- **Upload recording**: drop-zone or file picker (MP3/M4A/WAV/MP4/WebM). Dragging a file anywhere on the page shows a full-screen "Drop to add your recording" overlay (`useRecordingFileDrop.ts`); releasing attaches it and auto-selects Upload.
  - **Auto-fill on drop/pick (create mode only)**: empty Sermon title is filled from the file name (extension stripped, `_`/`-` → spaces); empty Date preached is filled from the file's creation date (`File.lastModified`). Both fields briefly flash `bg-green-50` (quick fade in/out) so the user sees what was filled, and a notice mentions "Title and date were prefilled from the file."
- **YouTube**: collects a URL; no YouTube integration yet.
- **Paste transcript**: transcript required.

Validation is client-side with `alert()` for errors. The Cancel button returns to `/app/sermons` (create) or the sermon page (edit).

## Sermon Workspace (edit page)

`web/src/components/sermons/SermonWorkspace.tsx` has two tabs with a fade transition:

1. **Sermon Details** — the shared `SermonForm` (all fields editable, including source type + source URL/filename and transcript).
2. **AI Draft** — read-only transcript in italics (finalized in the Details tab), follow-up status card, `FollowUpEditor` + `EmailPreview` side by side, and the generate → edit → approve workflow.

Behavior notes:

- If a sermon has uploaded media, the Details tab shows an **Uploaded recording** card with file details and a YouTube-style thumbnail preview (click to play inline at the same size, native fullscreen, 150px max height while playing; audio gets a simple player). A **Change source** link reveals the full source editor, with an ✕ to close it back to the preview.
- Follow-up draft/approval state for persisted sermons is still browser-local (mock AI generation is unchanged) and does not persist across reloads.
- The hidden tab's content is clipped (`overflow-hidden`) so it can't extend the page and break the sticky sidebar.

## List Views

Both sermons and members list pages use the shared `web/src/components/ui/DataTable.tsx`:

- sortable columns
- hover highlight on rows
- edit (pencil) and delete (trash) row actions
- edit links open the edit page (title/name is clickable)
- filter sidebar (right side) with pills of active filters and a clear-all option
- delete confirmation uses the custom `ConfirmDialog` (no native `prompt`)

**Sermons** (`/app/sermons`): table of title, preacher, date, statuses; wired to `GET /sermons` (fetch all, newest first); title links to the edit page.

**Members** (`/app/members`): full CRUD against the backend; member roles selectable (Member, Pastor, Deacon, and more) with no role management yet; edit routes to `/app/members/[id]` like sermons. The member form includes a Groups multi-select (checkbox list) that syncs `groupIds` on create/edit.

**Groups** (`/app/groups`): full CRUD against the backend via the shared `DataTable` (Name / Description / Members columns, filters, bulk delete); route-based create (`/app/groups/new`) and detail (`/app/groups/[id]`). The detail page edits name/description and manages members: an add-member dropdown plus an in-group member table with per-row remove (confirm dialog). Membership is many-to-many via the `group_members` table; deleting a group or member only removes the membership, never the other entity.

## Follow-Up Prototype

The current workspace includes:

```txt
Generate Follow-Up Draft
-> real OpenAI-compatible provider (mock fallback when no LLM_API_KEY)
-> visual swirl/loading state
-> editable subject/body
-> live email preview
-> Save Draft
-> Approve Draft
-> Send test email to a member or manual address
```

Persisted drafts are stored on the sermon row. Each newly generated draft records its provider/model (`ai_provider` / `ai_model`) and the AI tab displays that metadata. Test emails are allowed before or after approval and use Resend when `RESEND_API_KEY` and `EMAIL_FROM` are configured. The email preview (`EmailPreview.tsx`) replaces `{{ firstName }}` with "Jordan" for the member-facing preview.

Approval invalidation is implemented: editing the subject, body, or transcript after approval returns `aiDraftStatus` to `draft_ready` and `emailStatus` to `draft`.

## Backend

The FastAPI app implements the sermon vertical slice plus member CRUD plus chunked media upload:

```txt
GET    /                        -> status ok
GET    /health                  -> healthy
POST   /sermons                 -> create sermon (201)
GET    /sermons                 -> list all sermons (newest first)
GET    /sermons/{id}            -> get one sermon
PATCH  /sermons/{id}            -> partial update (incl. source_type)
PATCH  /sermons/{id}/transcript -> save transcript edits
POST   /sermons/{id}/follow-up/generate -> generate and persist a follow-up draft
POST   /sermons/{id}/test-email -> send a draft test email to one recipient
DELETE /sermons/{id}            -> delete sermon (+ removes media from storage)
POST   /sermons/{id}/upload/init     -> storage key + chunk size (idempotent per file)
POST   /sermons/{id}/upload/chunk    -> write one chunk at byte offset
POST   /sermons/{id}/upload/complete -> flip transcript_status -> queued
GET    /sermons/{id}/media           -> serve the file (StaticFiles mount at /media)
POST   /members                 -> create member (201)
GET    /members                 -> list members (alphabetical)
GET    /members/{id}            -> get one member
PATCH  /members/{id}            -> partial update
DELETE /members/{id}            -> delete member
POST   /members/bulk-delete     -> delete many members
POST   /groups                 -> create group (201; 409 on duplicate name)
GET    /groups                 -> list groups with memberCount
GET    /groups/{id}            -> get one group
PATCH  /groups/{id}            -> partial update
DELETE /groups/{id}            -> delete group (cascades memberships)
POST   /groups/bulk-delete     -> delete many groups
GET    /groups/{id}/members    -> list members in a group
POST   /groups/{id}/members    -> add members (idempotent)
DELETE /groups/{id}/members    -> remove members
```

- **Postgres**: local Docker container (`api/docker-compose.yml`, `postgres:16-alpine`) mapped to host port **5433** because a native Postgres 17 (EDB, launchd) already occupies 5432 on this machine. Named volume `after_sunday_pgdata`.
- **Migrations**: Alembic (`api/alembic/versions/`): sermon/member/media/transcription/group migrations, campaign migrations `0008`–`0011`, and `0012_add_sermon_ai_metadata` (records the follow-up provider/model).
- **Members** now carry `groupIds` (`MemberRead.group_ids` → camelCase `groupIds`), synced on create/update via `_sync_member_groups`; groups carry `memberCount`.
- **Media storage**: `api/app/storage.py` defines a `StorageBackend` interface with a `LocalDiskBackend` writing to `api/storage/` (gitignored). Chunk requests are content-type-relaxed (dragged-in files often report `application/octet-stream`); init is idempotent so retries reuse the storage key. Production swaps in S3/R2/Supabase Storage behind the same interface.
- **Auth**: every request requires `Authorization: Bearer <supabase access token>`; FastAPI resolves the user via Supabase's `GET /auth/v1/user` (no new dependency). **No ownership scoping** — any authenticated user can read/edit/delete any sermon or member (a deliberate dev decision after the ownership-wall removal; revisit with multi-tenancy).
- **Models/schemas**: `api/app/models/{sermon,member}.py` (SQLAlchemy), `api/app/schemas/{sermon,member}.py` (Pydantic with camelCase aliases via `api/app/schemas/aliases.py` so the API speaks the frontend `Sermon`/`Member` types).
- **Frontend client**: `web/src/lib/api/client.ts` (fetch wrapper attaching the bearer token, refreshing expired sessions; skips the JSON content-type for FormData so multipart works), `web/src/lib/api/{sermons,members,uploads}.ts` (typed functions; `uploads.ts` drives the chunked upload with byte-level progress via XHR). `NEXT_PUBLIC_API_URL=http://localhost:8000` is already set.
- **Config**: `api/.env` (gitignored) holds database/auth settings plus `LLM_*` generation settings and optional `RESEND_API_KEY` / `EMAIL_FROM` test-email delivery settings; `api/.env.example` documents them. Email delivery can also be configured in the app at `/app/settings` (stored in the `app_settings` table, migration 0013, API-key masked in responses); environment values take precedence over the in-app settings. Sensitive setting values (the Resend key) are encrypted at rest with AES-256-GCM (`api/app/services/crypto.py`) using the `SECRET_KEY` env var; without `SECRET_KEY` values fall back to plaintext (dev only), and pre-encryption plaintext rows still read fine.

`api/requirements.txt` pre-installs alembic, SQLAlchemy, psycopg, openai, and resend. `api/app.save` is a stray draft file.

## Environment

`.env.example` lives at the repository root. The actual env files are `web/.env` and `web/.env.local` (both gitignored), containing `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Note: `web/.env` historically held a `sb_secret_…` service-role key in the publishable-key slot; `.env.local` overrides it at runtime. A secret in a `NEXT_PUBLIC_` slot is dangerous if that file is ever committed — remove it.

## Lint / Build Status

`npm run lint` and `npm run build` both pass as of 2026-08-10.

## Still Mocked

- cloud object storage (local-disk backend is real; S3/R2/Supabase Storage is the swap-in)
- transcription provider (upload completes with `transcript_status: queued`; nothing transcribes yet)
- asynchronous jobs
- YouTube OAuth/channel integration / caption import
- production email delivery for campaigns (test-email delivery is real when Resend is configured)
- campaign approval/send orchestration and delivery tracking
- groups (deferred; members are built, groups are not needed for MVP)
- campaign / sermon follow-up persistence and sending
- analytics
- multi-tenant church/workspace implementation (ownership exists per-user; `church_id` column is a nullable placeholder)

Sermons created from **upload** and **YouTube** sources persist their rows and (for upload) the media file; the transcript pipeline is still to be built.
