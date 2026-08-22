# Oracle VM — Hosted Smoke Test Checklist

Run these against the live deployment **after** the stack is healthy. No
credentials go in this file.

## 1. Authentication

- [ ] Open `https://app.example.com/signup` in an incognito window.
- [ ] Complete Google sign-in; confirm redirect to `/app/dashboard`.
- [ ] Refresh; confirm the session persists.
- [ ] Log out; confirm protected routes redirect to `/login`.

## 2. YouTube pre-import

- [ ] Open `/app/sermons/new`; YouTube is the default source.
- [ ] Paste a church YouTube URL; metadata prefills.
- [ ] Click **Import transcript**; the loading spinner appears and the
      transcript fills in before creation.
- [ ] Create the sermon; transcript is ready and no duplicate caption job is
      created (check API logs for a second `youtube_captions` job).

## 3. Paste-transcript flow

- [ ] Select Paste transcript; paste a transcript and create the sermon.
- [ ] Generate an AI draft; save and approve it.
- [ ] Provider/model metadata is shown on the AI tab.

## 4. Temporary upload gate

- [ ] The Upload recording card is disabled; the file picker cannot open.
- [ ] `POST /api/sermons/{id}/upload/init` returns HTTP 503 with the
      temporary-disabled message.
- [ ] Do **not** re-enable uploads as part of this deployment.

## 5. Worker

- [ ] `docker compose --env-file .env.production -f docker-compose.production.yml logs -f api`
      shows the worker starting once without crashing.
- [ ] An intentionally queued non-upload job (YouTube captions) completes.

## 6. Email configuration

- [ ] From a sermon with a draft, send one test email to an approved address.
- [ ] Resend succeeds; no API key appears in browser responses or logs.
