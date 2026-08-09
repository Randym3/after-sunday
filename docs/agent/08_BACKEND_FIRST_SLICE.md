# After Sunday — First Backend Slice

> **Status: implemented 2026-08-08.** The slice is live against a local Docker Postgres (host port 5433; a native Postgres 17 already occupies 5432). API verified end-to-end via TestClient against the real database (17/17 checks) plus curl (401 without token, CORS preflight, health). Frontend lint and build pass. Remaining before declaring the milestone fully done: an in-browser check of the stop condition below with a real Supabase session (create pasted-transcript sermon → refresh → still there → edit transcript → refresh → edit still there). Follow-up draft server persistence and the sermons list page wiring are intentionally not part of this slice.

Use this after frontend stabilization.

## Objective

Replace `sessionStorage` for **manual/pasted-transcript sermons** with real persistence first.

## Why This First

It validates:

- FastAPI structure
- PostgreSQL migrations
- Supabase JWT verification
- tenant/resource ownership
- frontend API client
- create/read/update sermon flow
- transcript editing

without adding storage and transcription at the same time.

## First Vertical Slice

```txt
Logged-in user
→ Create Sermon with pasted transcript
→ POST /sermons
→ FastAPI verifies token
→ save to PostgreSQL
→ redirect using real sermon ID
→ GET /sermons/{id}
→ workspace renders persisted sermon
→ PATCH transcript
```

Keep mock AI generation temporarily if helpful.

## Suggested Endpoints

```txt
POST  /sermons
GET   /sermons
GET   /sermons/{sermon_id}
PATCH /sermons/{sermon_id}
PATCH /sermons/{sermon_id}/transcript
```

## Frontend API Layer

Prefer:

```txt
web/src/lib/api/client.ts
web/src/lib/api/sermons.ts
```

The client should eventually attach:

```txt
Authorization: Bearer <supabase_access_token>
```

## Security

Every protected request must validate:

```txt
Supabase access token
authenticated user
resource ownership/church ownership
```

## Stop Condition

Complete when:

```txt
create pasted-transcript sermon
→ refresh
→ sermon still exists
→ edit transcript
→ refresh
→ edit still exists
```

Then move to signed media uploads.
