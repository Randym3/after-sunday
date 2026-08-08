# After Sunday — Agent Instructions

## Project

**After Sunday** is a SaaS discipleship tool for churches.

Core workflow:

```txt
Church staff adds a sermon
→ After Sunday obtains or accepts a transcript
→ Church staff reviews the transcript
→ After Sunday generates a pastoral follow-up draft
→ Church staff edits and approves it
→ Recipients are selected
→ The church sends the follow-up
```

AI-generated pastoral content must **never be auto-sent without human review and approval**.

## Stack

Frontend:

```txt
Next.js App Router
React
TypeScript
Tailwind CSS
Supabase Auth
```

Frontend folder:

```txt
web/
```

Backend direction:

```txt
Python
FastAPI
PostgreSQL
```

Backend folder:

```txt
api/
```

Do not assume backend endpoints exist until you inspect the repo.

## Product Tone

The product should feel warm, calm, trustworthy, pastoral, modern, and simple for small church teams. Avoid a generic “AI dashboard” aesthetic.

## Non-Negotiable Product Rules

1. AI creates drafts; church staff approves them.
2. Do not auto-send generated pastoral content.
3. A sermon can come from:
   - uploaded audio/video
   - YouTube
   - pasted transcript
4. Upload and YouTube paths may also include an optional pasted transcript.
5. If a transcript is provided, it can skip automatic transcription.
6. `/app/*` is church staff/admin facing.
7. Church members do not need accounts for the initial MVP.
8. Do not build billing, advanced permissions, analytics, or complex onboarding before the core sermon workflow works end to end.

## Coding Rules

- Inspect existing code before creating abstractions.
- Preserve the existing visual language and reusable UI components.
- Prefer small focused components over giant route/page components.
- Keep `page.tsx` files thin.
- Use strict TypeScript types.
- Avoid `any` unless documented.
- Avoid premature state-management libraries.
- Do not add dependencies unnecessarily.
- Handle loading, empty, success, and error states when a feature becomes real.
- Keep accessibility in mind.
- Do not expose Supabase secret/service keys in browser code.
- Do not send large MP3/MP4 files through FastAPI when real uploads are implemented. Use direct-to-object-storage uploads.
- Do not silently change architecture.

## Current Prototype Storage

The frontend prototype uses `sessionStorage` for a mock sermon object.

The actual uploaded `File` is **not persisted**. Only serializable metadata such as filename is stored.

This is temporary and should eventually become:

```txt
FastAPI/PostgreSQL sermon record
+
private object storage
```

## Before Making Changes

1. Read `docs/agent/00_START_HERE.md`.
2. Read `docs/agent/02_CURRENT_STATE.md`.
3. Read the relevant existing implementation files.
4. Inspect `git status`.
5. Make the smallest coherent change.
6. Run relevant lint/build/tests.
7. Summarize exactly what changed and what remains mocked.

## Commands

```bash
cd web
npm install
npm run dev
npm run lint
npm run build
```

Do not claim checks passed unless they were actually run.

## Scope Discipline

If asked to continue development without a specific task, follow `docs/agent/04_ROADMAP.md`.

Do not skip directly to Stripe, teams, analytics, public member dashboards, or advanced SaaS infrastructure.

## Documentation

When implementation materially changes product workflow, architecture, API contracts, or data models, update the matching file under `docs/agent/`.
