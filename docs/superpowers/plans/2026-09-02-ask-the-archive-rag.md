# Ask the Archive — RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let church staff ask questions about the sermon archive ("What has the pastor said about forgiveness?") and get a grounded answer draft with citations to specific sermons, powered by a chunked, embedded transcript index stored in the existing Postgres database.

**Architecture:** When a sermon transcript becomes ready — via the transcription worker, YouTube captions, or a staff-pasted transcript — it is split into paragraph-based chunks and embedded through a swappable provider (OpenAI `text-embedding-3-small` first). Chunks live in a `sermon_chunks` table with a pgvector column and a full-text tsvector expression, enabling hybrid retrieval (vector similarity + keyword match merged by reciprocal rank fusion). A `POST /archive/ask` endpoint retrieves the top passages and asks the existing chat LLM (same `LLM_*` config as follow-up generation) for an answer **draft** that cites only those passages — consistent with the product rule that AI produces drafts and staff review content. A backfill script embeds the ~300-sermon backlog; the vectors then ride along in the local→VM database dump, so nothing re-embeds at deploy time.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pgvector (Postgres extension), the existing `openai` SDK (embeddings + chat, no new dependencies), the existing `transcription_jobs` worker loop, Next.js App Router, React, pytest, and the existing Docker/Compose setup.

## Product Decisions (locked)

- First slice is **ask-the-archive Q&A** (answer draft + citations), not search-only.
- Embedding provider: **OpenAI hosted** (`text-embedding-3-small`, 1536 dims) behind a swappable interface, mock fallback in dev — same pattern as `follow_up.py`.
- Ordering: **RAG pipeline first, then the Oracle VM**; the DB dump carries vectors to the VM.
- Staff-facing only. No auto-send anywhere near this feature. Answers are drafts, never emailed.

## Global Constraints

- No new runtime dependencies: `pgvector` is a Postgres extension shipped in the swap-in Docker image (`pgvector/pgvector:pg16`); its SQLAlchemy type comes from the small `pgvector` Python package, the only new requirements entry.
- Do not modify the recording-upload gate (`RECORDING_UPLOADS_ENABLED = false` stays in both frontend and backend).
- Do not modify the follow-up generation workflow; Q&A is additive.
- Transcripts already leave the machine for Velma/LLM providers; embeddings add no new data-exposure class. Still, never log transcript content or embeddings.
- Tests must not call OpenAI or any external API; mock all embedding/HTTP responses. Tests run on in-memory SQLite, so the embedding column must declare a SQLite-compatible variant (tests never execute vector math).
- Embedding calls are cheap but batched: never embed one chunk per request in the backfill.
- A transcript edit must eventually invalidate its chunks; the flag-based approach below guarantees the backfill sweep converges even if inline re-embedding fails.
- Keep secrets out of Git, Dockerfiles, logs, and client-side env vars. `EMBEDDING_API_KEY` is server-side only.

## Sizing (why this stays simple)

- ~300 sermons × ~7,500 words ≈ ~3M tokens ≈ **~4,000–8,000 chunks** at ~500–800 chars each.
- Vectors: 8,000 × 1536 × 4 bytes ≈ **~50 MB** — trivial for Postgres.
- One-time backfill cost with `text-embedding-3-small` ($0.02/1M tokens): **≈ $0.06**. Re-embedding on transcript edits is negligible.
- No ANN index tuning needed at this scale — plain `pgvector` cosine distance with a GIN keyword index is instant.

---

## File Map

**Create:**
- `api/app/models/sermon_chunk.py` — `SermonChunk` model
- `api/app/services/embeddings.py` — `EmbeddingProvider` protocol + OpenAI-compatible + mock implementations + `build_embedding_provider()`
- `api/app/services/sermon_index.py` — chunking, embedding pipeline, idempotent (re)index, transcript-dirty detection, hybrid retrieval
- `api/app/services/archive_qa.py` — answer prompt builder + answer provider over the existing chat LLM config
- `api/app/routers/archive.py` — `POST /archive/ask`
- `api/alembic/versions/0015_create_sermon_chunks.py` — pgvector extension + table
- `api/scripts/embed_sermon_archive.py` — backfill CLI
- `api/tests/test_sermon_index.py`, `api/tests/test_embeddings.py`, `api/tests/test_archive_qa.py`
- `web/src/types/archive.ts`, `web/src/lib/api/archive.ts`
- `web/src/app/(protected)/app/ask/page.tsx`
- `web/src/components/archive/AskArchive.tsx`

**Modify:**
- `api/requirements.txt` — add `pgvector`
- `api/app/config.py` — `embedding_base_url` / `embedding_api_key` / `embedding_model`
- `api/.env.example` — document the three new vars
- `api/app/models/__init__.py` (or wherever models are registered) — import `sermon_chunk`
- `api/tests/conftest.py` — register the `sermon_chunk` model in metadata
- `api/app/services/transcription.py` — index after the worker flips `transcript_status = "ready"` (line ~341)
- `api/app/routers/sermons.py` — index after `update_transcript` saves a ready transcript (line ~306)
- `api/app/main.py` — register the `archive` router
- `api/docker-compose.yml` + `docker-compose.production.yml` — image `postgres:16-alpine` → `pgvector/pgvector:pg16`; pass `EMBEDDING_*` env in production
- `deploy/.env.production.example` — add `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` / `EMBEDDING_BASE_URL` placeholders
- `web/src/lib/constants/navigation.ts` — sidebar entry "Ask the archive"
- `docs/agent/02_CURRENT_STATE.md`, `docs/agent/04_ROADMAP.md` — new phase notes

---

## Task 1: pgvector infrastructure

- [ ] **Step 1: Swap the Postgres image** in `api/docker-compose.yml` and `docker-compose.production.yml`:
  ```yaml
  image: pgvector/pgvector:pg16
  ```
  Note: the local named volume `after_sunday_pgdata` stays compatible (same PG major version; only the image adds the extension). Verify with:
  ```bash
  docker compose -f api/docker-compose.yml up -d db
  docker exec after-sunday-db psql -U after_sunday -d after_sunday -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extname FROM pg_extension WHERE extname='vector';"
  ```
- [ ] **Step 2: Add `pgvector` to `api/requirements.txt`** and `pip install` into the venv.
- [ ] **Step 3: Add config fields** to `api/app/config.py` (mirror the `llm_*` block):
  ```python
  # Embeddings for the sermon archive index. OpenAI-compatible endpoint via
  # the openai SDK; empty key means the mock provider (dev only).
  embedding_base_url: str = "https://api.openai.com/v1"
  embedding_api_key: str = ""
  embedding_model: str = "text-embedding-3-small"
  ```
- [ ] **Step 4: Document the vars in `api/.env.example`** and add `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` to `docker-compose.production.yml`'s `api.environment` and to `deploy/.env.production.example` (placeholders only).
- [ ] **Step 5: Extend `api/tests/test_config.py`** to cover the new fields' defaults.

## Task 2: Migration 0015 + model

- [ ] **Step 1: Create `api/alembic/versions/0015_create_sermon_chunks.py`** (down_revision = `0014_add_youtube_metadata`):
  ```python
  def upgrade() -> None:
      op.execute("CREATE EXTENSION IF NOT EXISTS vector")
      op.create_table(
          "sermon_chunks",
          sa.Column("id", sa.Uuid(), primary_key=True),
          sa.Column("sermon_id", sa.Uuid(), sa.ForeignKey("sermons.id", ondelete="CASCADE"), nullable=False),
          sa.Column("chunk_index", sa.Integer(), nullable=False),
          sa.Column("content", sa.Text(), nullable=False),
          sa.Column("char_start", sa.Integer(), nullable=False),
          sa.Column("char_end", sa.Integer(), nullable=False),
          sa.Column("embedding_model", sa.String(length=200), nullable=False),
          sa.Column("embedding", Vector(1536), nullable=False),
          sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
          sa.PrimaryKeyConstraint("sermon_id", "chunk_index"),
      )
      op.create_index("ix_sermon_chunks_sermon_id", "sermon_chunks", ["sermon_id"])
      op.create_index(
          "ix_sermon_chunks_embedding",
          "sermon_chunks",
          ["embedding"],
          postgresql_using="hnsw",
          postgresql_ops={"embedding": "vector_cosine_ops"},
      )
      op.create_index(
          "ix_sermon_chunks_fts",
          "sermon_chunks",
          [sa.text("to_tsvector('english', content)")],
          postgresql_using="gin",
      )
  ```
  `downgrade()` drops the table. The HNSW index is optional headroom; a plain seq scan also suffices at this scale.
- [ ] **Step 2: Create `api/app/models/sermon_chunk.py`**. The embedding column must survive SQLite metadata creation in tests:
  ```python
  import uuid
  from datetime import datetime
  import sqlalchemy as sa
  from pgvector.sqlalchemy import Vector
  from sqlalchemy.orm import Mapped, mapped_column
  from app.db import Base

  class SermonChunk(Base):
      __tablename__ = "sermon_chunks"

      id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
      sermon_id: Mapped[uuid.UUID] = mapped_column(Uuid, sa.ForeignKey("sermons.id", ondelete="CASCADE"), nullable=False)
      chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
      content: Mapped[str] = mapped_column(sa.Text, nullable=False)
      char_start: Mapped[int] = mapped_column(sa.Integer, nullable=False)
      char_end: Mapped[int] = mapped_column(sa.Integer, nullable=False)
      embedding_model: Mapped[str] = mapped_column(sa.String(200), nullable=False)
      embedding: Mapped[list[float]] = mapped_column(
          Vector(1536).with_variant(sa.Text, "sqlite"), nullable=False
      )
      created_at: Mapped[datetime] = mapped_column(
          sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
      )

      __table_args__ = (
          sa.PrimaryKeyConstraint("sermon_id", "chunk_index"),
      )
  ```
  (On SQLite the variant stores a JSON string — enough for CRUD tests; all vector math is Postgres-only and excluded from unit tests.)
- [ ] **Step 3: Register the model** — import it in the same place `TranscriptionJob` is registered, and add the import to `api/tests/conftest.py` (mirroring the existing `# noqa: F401` pattern).
- [ ] **Step 4:** Run `alembic upgrade head` against the local Docker DB and `alembic downgrade -1 && alembic upgrade head` to prove reversibility.
- [ ] **Step 5:** Add the dirty-tracking columns to **`sermons`** in the same migration:
  ```python
  op.add_column("sermons", sa.Column("transcript_embedded_at", sa.DateTime(timezone=True), nullable=True))
  op.add_column("sermons", sa.Column("transcript_embedded_model", sa.String(length=200), nullable=True))
  ```
  (mirror on the `Sermon` model). These make re-indexing decisions trivial and race-free enough for a single-user staff tool.

## Task 3: Embedding provider (`api/app/services/embeddings.py`)

Mirror `follow_up.py` structure exactly:

- [ ] **Step 1:** `EmbeddingProvider(abc.ABC)` with `provider_name` / `model_name` attrs and:
  ```python
  @abc.abstractmethod
  async def embed(self, texts: list[str]) -> list[list[float]]: ...
  ```
- [ ] **Step 2:** `OpenAICompatibleEmbeddingProvider(api_key, base_url, model)` using `AsyncOpenAI(...).embeddings.create(model=..., input=texts)`; validate `len(data) == len(texts)` and every vector's dimension is 1536; raise `RuntimeError` with a short message otherwise (never include content in errors).
- [ ] **Step 3:** `MockEmbeddingProvider` (dev): deterministic hash-based 1536-dim vectors, tiny sleep — keeps dev flows and tests fully offline.
- [ ] **Step 4:** `build_embedding_provider()` returning the real one when `settings.embedding_api_key` is set, else mock with a dev-only log line (same convention as `build_follow_up_provider`).
- [ ] **Step 5: Tests** (`test_embeddings.py`): dimension validation, length mismatch, mock determinism — all with the mock or a monkeypatched client; no network.

## Task 4: Indexing service (`api/app/services/sermon_index.py`)

- [ ] **Step 1: Chunking.** Split the transcript into paragraphs (`\n\n`), accumulate paragraphs into chunks targeting ~1,200 chars (hard cap 1,600; hard floor ~200 except for the final chunk), keep one-paragraph overlap between consecutive chunks, and record `char_start` / `char_end` offsets into the transcript. Pure function `chunk_transcript(transcript: str) -> list[Chunk]` — fully unit-testable.
- [ ] **Step 2: Idempotent index update.**
  ```python
  async def index_sermon(db, sermon, *, force: bool = False) -> str
  ```
  - Skip when `sermon.transcript` is empty/not ready, unless `force`.
  - Skip when already indexed with the same model and not dirty:
    `sermon.transcript_embedded_at is not None and sermon.transcript_embedded_model == provider.model_name and not transcript_changed`.
  - Otherwise: chunk → batch-embed (batches of 64 texts) → delete existing rows for the sermon → insert new rows → set `transcript_embedded_at=now()`, `transcript_embedded_model=provider.model_name` → commit.
  - On provider failure: log, leave the dirty columns untouched (the sweep will retry), and **do not** raise into the caller (see hooks below).
- [ ] **Step 3: Dirty detection.** A helper `is_index_stale(sermon, model_name)` implementing the rule above. `update_transcript` and the re-transcribe endpoint clear `transcript_embedded_at = None` on the sermon so staleness is immediate.
- [ ] **Step 4: Hybrid retrieval.**
  ```python
  async def search_archive(db, *, query: str, limit: int = 8) -> list[SearchHit]
  ```
  1. Embed the query once (1 text).
  2. Vector leg: `select(SermonChunk).order_by(SermonChunk.embedding.cosine_distance(qvec)).limit(25)` via pgvector's SQLAlchemy comparator.
  3. Keyword leg: `where(func.to_tsvector('english', SermonChunk.content).op('@@')(func.websearch_to_tsquery('english', query)))` ranked by `ts_rank`, limit 25.
  4. Merge by reciprocal rank fusion (`score = Σ 1/(60 + rank_i)`), dedupe by `(sermon_id, chunk_index)`, take top `limit`.
  5. Each `SearchHit` carries: chunk content, offsets, score, and sermon join data (id, title, preacher, preached_at, scripture_reference).
- [ ] **Step 5: Tests** (`test_sermon_index.py`, SQLite): chunker edge cases (empty, tiny, huge paragraphs, unicode), dirty-flag logic, index idempotency (second call with mock provider = no rewrite), failure path leaves rows untouched. The hybrid SQL legs get one integration test marked to skip unless `DATABASE_URL` points at the Docker Postgres (env-guarded, not CI-required).

## Task 5: Worker + transcript-edit hooks

- [ ] **Step 1: Worker hook** in `_process_transcription_job` right after the successful commit (where `transcript_status = "ready"` is set, line ~341):
  ```python
  try:
      from app.services.sermon_index import index_sermon
      await index_sermon(db, sermon)
  except Exception:
      print(f"[index] Embedding failed for {sermon.id}: sweep will retry")
  ```
- [ ] **Step 2: Paste-transcript hook** in `update_transcript` (line ~306): after commit, when the transcript is non-empty, clear `transcript_embedded_at` and fire the same guarded inline `index_sermon` call. (Endpoints are sync; `index_sermon` is async — call it via `asyncio.run`-free pattern: make the router handler async or offload like the existing follow-up generate endpoint does. Match whatever pattern the file already uses.)
- [ ] **Step 3: Create hook:** `create_sermon` with a supplied transcript ends at `ready` — route through the same guarded inline call.
- [ ] **Step 4: Tests:** worker completion triggers a single index call (mock provider monkeypatched); a transcript edit clears `transcript_embedded_at`; an indexing exception never fails the transcript save.

## Task 6: Backfill script (`api/scripts/embed_sermon_archive.py`)

Style it on `import_youtube_archive.py`:

- [ ] **Step 1:** CLI flags: `--limit N`, `--dry-run`, `--force` (re-embed even if not stale, e.g. after a model change), `--sermon-id UUID` (single).
- [ ] **Step 2:** Sweep all sermons with a non-empty ready transcript; for each, check `is_index_stale`; print a per-sermon line (`indexed | skipped | failed: reason`) and a final summary. Sleep briefly between sermons to stay well under rate limits.
- [ ] **Step 3:** Run it against the local DB after Task 5 to embed the real backlog:
  ```bash
  cd api && python -m scripts.embed_sermon_archive --dry-run   # review
  cd api && python -m scripts.embed_sermon_archive             # ~$0.06
  ```
- [ ] **Step 4:** Sanity-check retrieval manually:
  ```bash
  docker exec after-sunday-db psql -U after_sunday -d after_sunday \
    -c "select count(*) from sermon_chunks;"
  ```

## Task 7: Q&A service + endpoint

- [ ] **Step 1: `api/app/services/archive_qa.py`.** Reuse the chat LLM config (`llm_base_url` / `llm_api_key` / `llm_model`) — no new provider config. Prompt builder:
  ```python
  SYSTEM_PROMPT = (
      "You are a research assistant for a church's staff. Answer the question "
      "using ONLY the numbered sermon excerpts provided. Cite excerpts inline "
      "as [1], [2]. If the excerpts don't contain the answer, say so plainly "
      "— never invent quotes, scripture, or events. Write in a warm, pastoral "
      "tone. Respond only with JSON: {\"answer\": str}."
  )
  ```
  User message: the question, then numbered excerpts each headed `[#] "Title" — Preacher, March 2, 2025 (Mark 4:35–41)`. Parse the JSON with the tolerant `_parse_json_object` approach from `follow_up.py`.
- [ ] **Step 2:** Post-validate: extract `[n]` citations from the answer, keep only valid ones, attach the referenced `SearchHit`s. If retrieval returned zero hits, skip the LLM entirely and return a "nothing found in the archive" response.
- [ ] **Step 3: Endpoint** in `api/app/routers/archive.py` (registered in `main.py`):
  ```txt
  POST /archive/ask  {"question": str}  ->  {"answer": str,
                                            "citations": [{"sermonId", "title", "preacher", "preachedAt",
                                                           "scriptureReference", "excerpt", "score"}],
                                            "retrieved": int}
  ```
  Auth via the existing `get_current_user_uuid` dependency (no ownership scoping yet — consistent with the rest of the API). 422 on blank questions, 503 with a clean message when no LLM key is configured, 502 on provider errors. Cap `question` at ~1,000 chars.
- [ ] **Step 4: Tests** (`test_archive_qa.py`): prompt contains excerpt numbering; JSON parsing failures → 502; zero-retrieval short-circuit; citation filtering; endpoint auth required. All with mocked retrieval + mocked chat client.
- [ ] **Step 5: API contract note:** response camelCase via the existing alias conventions in `api/app/schemas/`.

## Task 8: Frontend — Ask the Archive page

- [ ] **Step 1:** `web/src/types/archive.ts` (`AskResponse`, `ArchiveCitation`) and `web/src/lib/api/archive.ts` (`askArchive(question)` through the existing fetch client).
- [ ] **Step 2:** `web/src/app/(protected)/app/ask/page.tsx` — thin page hosting `AskArchive`; add a sidebar entry ("Ask the archive") in `navigation.ts`.
- [ ] **Step 3:** `web/src/components/archive/AskArchive.tsx`:
  - question input + submit (disabled while loading, enter-to-submit)
  - loading state reusing the existing spinner pattern
  - answer card (whitespace-pre-wrap text, `[n]` markers rendered as small citation chips)
  - citations list: clickable cards linking to `/app/sermons/[sermonId]`, showing title / preacher / date / excerpt
  - error state via the app-wide toast; empty-state copy explaining the archive is still growing while the backfill runs
  - "Ask another question" resets the form; no answer persistence in this slice
- [ ] **Step 4:** Match the visual language (warm off-white surfaces, deep green, rounded cards); `npm run lint` and `npm run build` must pass.

## Task 9: Docs + roadmap

- [ ] **Step 1:** Update `docs/agent/04_ROADMAP.md` — add "Phase 13 — Ask the Archive (RAG)" with status and remaining items (answer history, grounding follow-up drafts, related sermons, audio seek links).
- [ ] **Step 2:** Update `docs/agent/02_CURRENT_STATE.md` — new table, service, endpoint, env vars, and the pgvector image swap; remove "asynchronous jobs" from *Still Mocked* where it is now false.
- [ ] **Step 3:** Note in `docs/operations/oracle-vm.md` → VM Details that the DB image is `pgvector/pgvector:pg16` (one line, keeps deploy day accurate).

---

## Later milestones (deliberately out of scope here)

1. **Answer history** — persist Q&A threads per user (new table) once staff actually uses it.
2. **Ground follow-up drafts** — feed retrieved past-sermon passages into the follow-up provider for series continuity.
3. **Related sermons** on the workspace ("previous sermons on this passage").
4. **Audio seek links** — store utterance timestamps (Phase 6 leftover) so a cited paragraph can deep-link to the moment in the recording.
5. **Re-index model migrations** — bumping `EMBEDDING_MODEL` makes every sermon stale by the dirty-flag rule; the backfill sweep then re-embeds at ~$0.06 per pass. No special tooling needed.

## Verification checklist

- [ ] `alembic upgrade head` + downgrade round-trip on the Docker Postgres
- [ ] `pytest` green with no network access
- [ ] Backfill dry-run lists the expected sermon count; real run embeds all ready transcripts
- [ ] `POST /archive/ask` with a real question returns an answer whose citations all resolve to real sermons
- [ ] Transcript edit → `transcript_embedded_at` cleared → sweep re-embeds only that sermon
- [ ] `web` lint + build pass; the ask page handles loading / error / empty / success
- [ ] `docker compose config` renders for the production stack with the new env vars
