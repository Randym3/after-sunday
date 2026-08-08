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
```

The following routes are referenced in the sidebar (`web/src/lib/constants/navigation.ts`) but are **empty directories with no page.tsx** — visiting them 404s:

```txt
/app/recipients
/app/groups
/app/email-campaigns
/app/settings
```

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

State management: the stored sermon in `sessionStorage` is the single source of truth. The workspace subscribes to it with `useSyncExternalStore` (no effect-driven load), and every edit writes through to storage immediately. The Save buttons confirm the current state rather than being the only way to persist.

Behavior notes:

- If `sessionStorage` is empty (e.g., visiting any `/app/sermons/[id]` directly), the workspace renders a hardcoded `fallbackSermon` ("The Good Shepherd", Psalm 23, `sunday-sermon.mp4`, status `processing`).
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

Approval invalidation is implemented: editing the subject, body, or transcript after approval returns `aiDraftStatus` to `draft_ready` and `emailStatus` to `draft`. Because edits write through to `sessionStorage`, unsaved edits survive navigation within the tab.

## Backend

`api/app/main.py` is a bare FastAPI scaffold:

```txt
GET /         -> status ok
GET /health   -> healthy
```

There are no routers, models, migrations, or database connections. `web/src/lib/api/` is an empty directory (no frontend API client yet).

`api/requirements.txt` pre-installs alembic, SQLAlchemy, psycopg, openai, and resend, but no code uses them yet. `api/app.save` is a stray draft file.

## Environment

`.env.example` lives at the repository root. The actual env files are `web/.env` and `web/.env.local` (both gitignored), containing `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Lint / Build Status

`npm run lint` and `npm run build` both pass as of 2026-08-08. The two former `SermonWorkspace.tsx` errors were resolved by the stabilization pass (`docs/agent/07_NEXT_TASK.md`): the effect-driven storage load was replaced with `useSyncExternalStore`, and the manual `useMemo` was removed in favor of an inline derivation.

## Still Mocked

- sermon database persistence
- media upload
- object storage
- transcription provider
- asynchronous jobs
- YouTube OAuth/channel integration
- real AI generation
- recipients/groups
- campaign persistence
- email sending
- analytics
- multi-tenant church/workspace implementation
- all FastAPI endpoints beyond `/` and `/health`

Do not mistake frontend statuses for working backend behavior.
