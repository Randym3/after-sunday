# YouTube Transcript Provider Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make YouTube transcript importing reliable after deployment by adding an official, OAuth-authorized provider for the church’s own channel while preserving the current `youtube-transcript-api` path as a controlled fallback until production verification is complete.

**Architecture:** Keep the existing `POST /youtube/transcript`, sermon-create path, and `transcription_jobs` worker as the public workflow, but route their caption requests through a provider interface. The production provider will use the official YouTube Data API with a channel-owner OAuth connection; the current undocumented scraper remains available only as an explicitly configured fallback. Imported transcripts will record their source, be cached on the sermon, and never be fetched again unless staff explicitly requests a re-import.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, existing `httpx` client, existing AES-GCM settings encryption, YouTube Data API v3 REST endpoints, Google OAuth 2.0, Next.js App Router, React, existing toast/loading components, pytest, and the existing `transcription_jobs` worker.

## Global Constraints

- Keep the currently working `youtube-transcript-api` implementation unchanged until the official provider passes a hosted smoke test.
- Use the official YouTube Data API only for channels the connected Google account is authorized to manage; do not present it as a general public-caption downloader.
- Do not download YouTube video audio as an automatic fallback; use the existing user-upload plus Velma path when captions are unavailable.
- Never log Google access tokens, refresh tokens, client secrets, authorization codes, or complete OAuth callback URLs.
- Store refresh tokens encrypted at rest using the existing AES-GCM crypto service and `SECRET_KEY`.
- Tests must not make requests to Google or YouTube; mock all HTTP responses.
- Preserve the existing pre-create **Import transcript** button and the background worker behavior.
- Cache successful transcripts and provider metadata on the sermon so ordinary page loads and AI generation do not call YouTube again.
- Do not switch the default production provider until the connected church channel has passed the hosted verification checklist in Task 7.

---

## File Map

- Create `api/app/services/youtube_transcripts.py` for the provider protocol, official Data API implementation, scraper adapter, provider selection, and result type.
- Modify `api/app/services/youtube.py` so its existing caption helper delegates through the provider layer without changing callers.
- Create `api/app/services/google_youtube_oauth.py` for authorization URLs, state handling, token exchange, token refresh, and channel identity lookup.
- Create `api/app/models/youtube_connection.py` and migration `0016_add_youtube_connections.py` for the encrypted channel connection.
- Modify `api/app/config.py`, `api/.env.example`, and `api/app/models/setting.py` only for configuration and existing encryption conventions.
- Modify `api/app/routers/youtube.py` for provider status, OAuth connect/callback, and transcript import responses.
- Modify `api/app/models/sermon.py`, `api/app/schemas/sermon.py`, and migration `0017_add_transcript_provenance.py` for transcript source metadata.
- Modify `api/app/services/transcription.py` so worker jobs use the provider layer and persist provenance.
- Modify `web/src/lib/api/youtube.ts`, `web/src/types/sermon.ts`, the YouTube section of `SermonForm.tsx`, and the settings page for connection/status UI.
- Add or modify `api/tests/test_youtube_transcripts.py`, `api/tests/test_google_youtube_oauth.py`, `api/tests/test_youtube_api.py`, and `api/tests/test_transcription_worker.py`.
- Update `docs/agent/02_CURRENT_STATE.md`, `docs/agent/04_ROADMAP.md`, and a deployment runbook under `docs/operations/youtube-transcripts.md`.

---

### Task 1: Define the provider contract and provenance model

**Files:**
- Create: `api/app/services/youtube_transcripts.py`
- Modify: `api/app/services/youtube.py`
- Modify: `api/app/config.py`
- Modify: `api/.env.example`
- Test: `api/tests/test_youtube_transcripts.py`

**Interfaces:**
- Produces `YoutubeTranscriptResult(text: str, video_id: str, language: str, is_generated: bool, provider: str)`.
- Produces `YoutubeTranscriptProvider.fetch(video_id: str) -> YoutubeTranscriptResult`.
- Produces `build_youtube_transcript_provider(db: Session, user_id: UUID | None = None) -> YoutubeTranscriptProvider`.
- Keeps `fetch_auto_captions(video_id)` available as a compatibility wrapper for existing worker tests and callers.

- [ ] **Step 1: Write failing contract tests**

```python
from app.services.youtube_transcripts import YoutubeTranscriptResult


def test_result_records_provider_provenance():
    result = YoutubeTranscriptResult(
        text="A sermon transcript.",
        video_id="dQw4w9WgXcQ",
        language="en",
        is_generated=True,
        provider="youtube_scraper",
    )
    assert result.provider == "youtube_scraper"
    assert result.is_generated is True


def test_provider_selection_defaults_to_current_scraper_without_connection(monkeypatch):
    monkeypatch.setenv("YOUTUBE_TRANSCRIPT_PROVIDER", "scraper")
    provider = build_youtube_transcript_provider(db=None, user_id=None)
    assert provider.provider_name == "youtube_scraper"
```

- [ ] **Step 2: Run the focused tests and confirm the contract is missing**

Run: `cd api && source .venv/bin/activate && python -m pytest tests/test_youtube_transcripts.py -q`

Expected: FAIL because the provider module and result type do not exist.

- [ ] **Step 3: Implement the smallest provider boundary**

Use these configuration values:

```env
YOUTUBE_TRANSCRIPT_PROVIDER=scraper
YOUTUBE_TRANSCRIPT_FALLBACK=none
YOUTUBE_GOOGLE_CLIENT_ID=
YOUTUBE_GOOGLE_CLIENT_SECRET=
YOUTUBE_OAUTH_REDIRECT_URI=http://localhost:8000/youtube/oauth/callback
YOUTUBE_CHANNEL_ID=
```

Implement `YoutubeTranscriptProvider` as a `Protocol`, a `ScraperYoutubeTranscriptProvider` that wraps the existing `YouTubeTranscriptApi().fetch(...)` behavior, and a factory that returns the scraper when `YOUTUBE_TRANSCRIPT_PROVIDER=scraper`.

- [ ] **Step 4: Run tests and preserve the current behavior**

Run: `cd api && source .venv/bin/activate && python -m pytest tests/test_youtube.py tests/test_youtube_transcripts.py -q`

Expected: all existing YouTube tests plus the new provider tests pass.

- [ ] **Step 5: Commit the boundary independently**

```bash
git add api/app/services/youtube_transcripts.py api/app/services/youtube.py api/app/config.py api/.env.example api/tests/test_youtube_transcripts.py
git commit -m "refactor: add youtube transcript provider boundary"
```

---

### Task 2: Add encrypted channel OAuth storage

**Files:**
- Create: `api/app/models/youtube_connection.py`
- Create: `api/alembic/versions/0016_add_youtube_connections.py`
- Modify: `api/app/main.py` to register the model
- Test: `api/tests/test_youtube_connection.py`

**Interfaces:**
- Produces `YoutubeConnection` with `id`, `created_by_user_id`, `channel_id`, `channel_title`, encrypted `refresh_token`, encrypted `access_token`, `access_token_expires_at`, `scopes`, `status`, `created_at`, and `updated_at`.
- Produces `save_youtube_connection(db, user_id, token_response, channel) -> YoutubeConnection`.
- Produces `get_active_youtube_connection(db, user_id) -> YoutubeConnection | None`.
- Uses `app.services.crypto.encrypt_secret` and `decrypt_secret`; plaintext refresh tokens must never be returned by a schema or API response.

- [ ] **Step 1: Write the encryption and uniqueness tests**

```python
def test_youtube_refresh_token_is_encrypted(db_session):
    connection = save_youtube_connection(
        db_session,
        user_id=uuid.uuid4(),
        token_response={"access_token": "access", "refresh_token": "refresh", "expires_in": 3600, "scope": "scope"},
        channel={"id": "UC123", "title": "Grace Church"},
    )
    assert connection.refresh_token != "refresh"
    assert decrypt_secret(connection.refresh_token) == "refresh"


def test_one_active_connection_per_user_and_channel(db_session):
    user_id = uuid.uuid4()
    save_youtube_connection(db_session, user_id, TOKEN_RESPONSE, CHANNEL)
    save_youtube_connection(db_session, user_id, TOKEN_RESPONSE, CHANNEL)
    assert db_session.query(YoutubeConnection).count() == 1
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd api && source .venv/bin/activate && python -m pytest tests/test_youtube_connection.py -q`

Expected: FAIL because the model and service do not exist.

- [ ] **Step 3: Implement the model and migration**

Use a unique constraint on `(created_by_user_id, channel_id)`. Store only encrypted token strings in the database. Store the OAuth scopes as a non-secret string for diagnostics.

- [ ] **Step 4: Apply the migration and test**

Run: `cd api && source .venv/bin/activate && alembic upgrade head && python -m pytest tests/test_youtube_connection.py -q`

Expected: migration succeeds and all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/app/models/youtube_connection.py api/alembic/versions/0016_add_youtube_connections.py api/app/main.py api/tests/test_youtube_connection.py
 git commit -m "feat: store encrypted youtube channel connections"
```

---

### Task 3: Implement Google OAuth and official channel discovery

**Files:**
- Create: `api/app/services/google_youtube_oauth.py`
- Modify: `api/app/routers/youtube.py`
- Modify: `api/app/config.py`
- Test: `api/tests/test_google_youtube_oauth.py`

**Interfaces:**
- Produces `GET /youtube/oauth/start` that redirects to Google with the YouTube scope `https://www.googleapis.com/auth/youtube.force-ssl` plus a signed, one-time state value.
- Produces `GET /youtube/oauth/callback?code=...&state=...` that validates state, exchanges the code, calls `channels.list(part=snippet, mine=true)`, saves the encrypted connection, and redirects to `/app/settings?youtube=connected`.
- Produces `GET /youtube/connection` returning `{connected, channelId, channelTitle, provider}` without tokens.
- Produces `DELETE /youtube/connection` that revokes/disables the stored connection and removes encrypted tokens.
- Uses existing `httpx`; do not add a Google SDK solely for this flow.

- [ ] **Step 1: Write OAuth tests with mocked HTTP**

```python
def test_authorization_url_contains_youtube_scope(monkeypatch):
    url, state = build_google_authorization_url("known-state")
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    assert query["scope"] == ["https://www.googleapis.com/auth/youtube.force-ssl"]
    assert query["state"] == ["known-state"]


def test_callback_rejects_invalid_state(client):
    response = client.get("/youtube/oauth/callback?code=code&state=wrong")
    assert response.status_code == 400


def test_callback_saves_channel_without_exposing_tokens(client, monkeypatch):
    monkeypatch.setattr("app.services.google_youtube_oauth.exchange_code", fake_exchange)
    monkeypatch.setattr("app.services.google_youtube_oauth.fetch_my_channel", fake_channel)
    response = client.get("/youtube/oauth/callback?code=code&state=valid")
    assert response.status_code in {302, 303}
    assert "refresh" not in response.headers.get("location", "")
```

- [ ] **Step 2: Implement state, authorization, exchange, refresh, and channel lookup**

Use Google’s endpoints:

```text
https://accounts.google.com/o/oauth2/v2/auth
https://oauth2.googleapis.com/token
https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true
```

Use `state` to bind the callback to the authenticated app user. Reject missing, expired, reused, or mismatched state values before exchanging a code.

- [ ] **Step 3: Add the connection routes and error handling**

Map Google errors to concise user-facing messages and server logs that contain the HTTP status and operation name but never token bodies.

- [ ] **Step 4: Run focused and full backend tests**

Run: `cd api && source .venv/bin/activate && python -m pytest tests/test_google_youtube_oauth.py tests/test_youtube_connection.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/services/google_youtube_oauth.py api/app/routers/youtube.py api/app/config.py api/tests/test_google_youtube_oauth.py
 git commit -m "feat: connect a church youtube channel with oauth"
```

---

### Task 4: Implement the official caption provider and explicit fallback

**Files:**
- Modify: `api/app/services/youtube_transcripts.py`
- Modify: `api/app/services/youtube.py`
- Modify: `api/app/services/transcription.py`
- Test: `api/tests/test_youtube_transcripts.py`
- Test: `api/tests/test_transcription_worker.py`

**Interfaces:**
- Produces `GoogleYoutubeTranscriptProvider.fetch(video_id) -> YoutubeTranscriptResult`.
- The provider calls `captions.list(part="id,snippet", videoId=video_id)` and selects a non-draft track in this order: manual English, generated English, then the first available English BCP-47 track.
- It calls `captions.download` for the selected track with `tfmt=vtt`, parses VTT text, and applies the existing paragraphizer.
- Provider selection is explicit:
  - `YOUTUBE_TRANSCRIPT_PROVIDER=scraper` uses the current scraper.
  - `YOUTUBE_TRANSCRIPT_PROVIDER=google` requires an active OAuth connection.
  - `YOUTUBE_TRANSCRIPT_FALLBACK=scraper` permits scraper fallback after an official-provider failure.
  - `YOUTUBE_TRANSCRIPT_FALLBACK=none` returns a clear failure without trying the scraper.

- [ ] **Step 1: Write mocked official API tests**

Cover these cases:

```python
def test_google_provider_prefers_manual_english_track(httpx_mock):
    # captions.list returns manual en and generated en tracks.
    # captions.download returns VTT.
    result = asyncio.run(provider.fetch("dQw4w9WgXcQ"))
    assert result.provider == "youtube_google_api"
    assert result.is_generated is False
    assert "Welcome church" in result.text


def test_google_provider_uses_generated_track_when_manual_is_missing(httpx_mock):
    result = asyncio.run(provider.fetch("dQw4w9WgXcQ"))
    assert result.is_generated is True


def test_google_provider_reports_missing_permissions(httpx_mock):
    with pytest.raises(YoutubeTranscriptProviderError, match="channel authorization"):
        asyncio.run(provider.fetch("dQw4w9WgXcQ"))


def test_scraper_fallback_is_only_used_when_enabled(monkeypatch):
    monkeypatch.setenv("YOUTUBE_TRANSCRIPT_FALLBACK", "scraper")
    # Official provider raises; scraper returns a result.
    assert asyncio.run(provider.fetch("dQw4w9WgXcQ")).provider == "youtube_scraper"
```

- [ ] **Step 2: Implement VTT parsing and official REST calls**

Ignore VTT headers, timestamps, cue identifiers, and formatting tags; preserve cue text order; join cues with spaces; then call `_paragraphize_text`.

- [ ] **Step 3: Wire the worker and pre-create endpoint through the provider factory**

`POST /youtube/transcript` must return `provider`, `language`, and `isGenerated` along with the text. The background worker must use the same factory and record the provider used.

- [ ] **Step 4: Test provider failure behavior without retries**

A provider error must create one failed job with a useful message. It must not silently call both providers unless `YOUTUBE_TRANSCRIPT_FALLBACK=scraper` is explicitly enabled.

- [ ] **Step 5: Run the full backend suite**

Run: `cd api && source .venv/bin/activate && python -m pytest -q`

Expected: all existing tests plus provider tests pass without network access.

- [ ] **Step 6: Commit**

```bash
git add api/app/services/youtube_transcripts.py api/app/services/youtube.py api/app/services/transcription.py api/tests/test_youtube_transcripts.py api/tests/test_transcription_worker.py
 git commit -m "feat: add official youtube caption provider"
```

---

### Task 5: Persist transcript provenance and prevent accidental re-imports

**Files:**
- Modify: `api/app/models/sermon.py`
- Create: `api/alembic/versions/0017_add_transcript_provenance.py`
- Modify: `api/app/schemas/sermon.py`
- Modify: `api/app/routers/sermons.py`
- Modify: `api/app/routers/youtube.py`
- Modify: `web/src/types/sermon.ts`
- Modify: `web/src/lib/api/youtube.ts`
- Test: `api/tests/test_youtube_api.py`

**Interfaces:**
- Adds `Sermon.transcript_source` values: `manual`, `youtube_google_api`, `youtube_scraper`, `velma`, or `unknown`.
- Adds `Sermon.transcript_imported_at: datetime | None`.
- `POST /youtube/transcript` returns provenance.
- Creating a YouTube sermon with a supplied transcript stores the returned source and does not create a `transcription_job`.
- Re-import occurs only through an explicit `POST /sermons/{id}/transcribe` action.

- [ ] **Step 1: Write tests for provenance and no duplicate job**

```python
def test_preimported_youtube_transcript_is_ready_without_job(client, db_session):
    response = client.post("/sermons", json={
        "title": "Sunday",
        "sourceType": "youtube",
        "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
        "transcript": "Imported text",
        "transcriptSource": "youtube_google_api",
    })
    assert response.status_code == 201
    assert response.json()["transcriptSource"] == "youtube_google_api"
    assert db_session.query(TranscriptionJob).count() == 0
```

- [ ] **Step 2: Add the migration and schema fields**

Use nullable columns for existing sermons, backfill existing ready YouTube transcripts as `unknown`, and set new manual transcript submissions to `manual`.

- [ ] **Step 3: Set provenance in both pre-create and worker paths**

The pre-create import carries the provider source in the create payload. Worker completion uses the actual provider result. A failed import stores the provider in the job error context but does not mark a transcript source.

- [ ] **Step 4: Run migration and regression tests**

Run: `cd api && source .venv/bin/activate && alembic upgrade head && python -m pytest -q`

Expected: all tests pass and existing sermon rows remain readable.

- [ ] **Step 5: Commit**

```bash
git add api/app/models/sermon.py api/alembic/versions/0017_add_transcript_provenance.py api/app/schemas/sermon.py api/app/routers/sermons.py api/app/routers/youtube.py web/src/types/sermon.ts web/src/lib/api/youtube.ts api/tests/test_youtube_api.py
 git commit -m "feat: record youtube transcript provenance"
```

---

### Task 6: Add channel connection controls and provider status to Settings

**Files:**
- Modify: `web/src/lib/api/youtube.ts`
- Modify: `web/src/components/settings/SettingsPage.tsx` or the existing settings route component
- Create or modify: `web/src/components/settings/YoutubeSettingsForm.tsx`
- Test: `web` lint/build

**Interfaces:**
- Produces `GET /youtube/connection` client function.
- Produces settings UI showing `Not connected` or the connected channel title.
- Produces a **Connect YouTube channel** button that navigates to `/youtube/oauth/start`.
- Produces a **Disconnect** button with a confirmation dialog.
- The sermon form continues to show **Import transcript** and uses the same spinner; it does not expose tokens or provider internals to ordinary users.

- [ ] **Step 1: Add typed API functions**

```ts
export interface YoutubeConnectionStatus {
  connected: boolean;
  channelId: string | null;
  channelTitle: string | null;
  provider: string;
}

export function getYoutubeConnection(): Promise<YoutubeConnectionStatus> {
  return apiFetch<YoutubeConnectionStatus>("/youtube/connection");
}
```

- [ ] **Step 2: Add the settings card**

Show the channel title and a success toast after OAuth returns with `?youtube=connected`. Show an error toast for `?youtube=error` and let staff retry.

- [ ] **Step 3: Verify the user workflow**

Run: `cd web && npm run lint && npm run build`

Expected: PASS. Manually verify that the settings card remains usable when the API reports no connection.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/api/youtube.ts web/src/components/settings/YoutubeSettingsForm.tsx web/src/components/settings
 git commit -m "feat: add youtube channel connection settings"
```

---

### Task 7: Hosted verification and controlled production switch

**Files:**
- Create: `docs/operations/youtube-transcripts.md`
- Modify: `api/.env.example`
- Modify: `docs/agent/02_CURRENT_STATE.md`
- Modify: `docs/agent/04_ROADMAP.md`

**Interfaces:**
- Produces a deployment runbook and an explicit go/no-go checklist.
- Does not change the production default until all checks pass.

- [ ] **Step 1: Configure a separate Google Cloud OAuth client**

Create a Web application OAuth client for the deployed API callback, enable YouTube Data API v3, and grant the channel-owner account access. Keep the client secret only in the hosting provider’s secret manager.

- [ ] **Step 2: Configure staging with the official provider**

Set:

```env
YOUTUBE_TRANSCRIPT_PROVIDER=google
YOUTUBE_TRANSCRIPT_FALLBACK=none
YOUTUBE_OAUTH_REDIRECT_URI=https://<deployed-api-host>/youtube/oauth/callback
```

Connect the church channel through Settings and import at least three videos:

1. one with manual English captions;
2. one with auto-generated English captions;
3. one with no captions or a deliberately unavailable track.

- [ ] **Step 3: Verify operational behavior**

Confirm all of the following:

- OAuth callback succeeds from a clean browser session;
- refresh-token renewal works after access-token expiry;
- official imports complete from the hosted server;
- pre-create import uses the same provider and loading spinner;
- skipping pre-import queues exactly one background job;
- successful imports are cached and do not call YouTube again;
- unavailable captions produce a clear toast and failed-job message;
- no access token or refresh token appears in logs, database responses, or browser responses.

- [ ] **Step 4: Switch production only after the smoke test**

Change the production secret to `YOUTUBE_TRANSCRIPT_PROVIDER=google`. Keep `YOUTUBE_TRANSCRIPT_FALLBACK=none` initially so failures are visible and measurable instead of silently relying on the cloud-fragile scraper.

- [ ] **Step 5: Document rollback**

The rollback is configuration-only:

```env
YOUTUBE_TRANSCRIPT_PROVIDER=scraper
YOUTUBE_TRANSCRIPT_FALLBACK=none
```

Restart the API after changing environment variables. Existing imported transcripts remain available because they are stored on sermon rows.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/operations/youtube-transcripts.md api/.env.example docs/agent/02_CURRENT_STATE.md docs/agent/04_ROADMAP.md
git commit -m "docs: document hosted youtube transcript operations"
```

---

## Self-Review

### Spec coverage

- Current working scraper is preserved: Tasks 1 and 4 keep it behind an adapter and make fallback explicit.
- Official alternative is implemented for the actual use case of a church-owned channel: Tasks 2–4.
- Hosting/IP-block risk is addressed through channel OAuth, not an assumed proxy dependency: Tasks 3 and 7.
- No duplicate YouTube fetches are addressed through cache/provenance and job guards: Task 5.
- Existing pre-create import and loading UX remain intact: Tasks 4–6.
- Security requirements for OAuth tokens and callback state are addressed: Tasks 2–3.
- Deployment validation and rollback are concrete: Task 7.

### Placeholder scan

The plan contains no `TBD`, `TODO`, or unspecified implementation step. The only angle-bracket values are deployment-specific values that must be replaced with the actual deployed API hostname and are explicitly named in the configuration step.

### Type and interface consistency

- `YoutubeTranscriptResult` is produced by both scraper and official providers and consumed by the worker and pre-create endpoint.
- `transcript_source` is returned by the API, represented in the frontend type, and persisted for both pre-create and worker imports.
- The OAuth connection lookup is consumed by the provider factory and surfaced through the settings status endpoint.
- The existing `POST /youtube/transcript` and `POST /sermons/{id}/transcribe` remain the user-facing import/re-import actions.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-19-youtube-transcript-provider-reliability.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task and review between tasks.

**2. Inline Execution** - Execute the tasks in this session with checkpoints.

The current scraper remains the active implementation until Task 7’s hosted verification passes.
