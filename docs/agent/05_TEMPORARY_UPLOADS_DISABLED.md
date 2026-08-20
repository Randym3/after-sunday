# Temporary Recording Uploads Disabled

**Status:** Temporary product decision

**Date:** 2026-08-19

## Decision

New recording uploads are temporarily inaccessible. The active sermon sources are:

- YouTube URL + caption import
- Paste transcript

This is an access gate, not a removal of the recording feature.

## What remains intact

The existing upload implementation remains in the repository, including:

- MP3, M4A, WAV, MP4, and WebM handling
- chunked upload initialization
- chunk upload writing
- upload completion
- local storage integration
- asynchronous Velma transcription
- upload-based sermon records already in the database
- transcription and media viewing for existing uploaded sermons

The upload code should not be deleted or rewritten while this temporary gate is active.

## Current gates

### Frontend

`web/src/components/sermons/SermonForm.tsx` contains:

```ts
const RECORDING_UPLOADS_ENABLED = false;
```

When false:

- YouTube is the default source for new sermons;
- the Upload recording source card is disabled;
- the file picker is disabled;
- global drag-and-drop upload handling is disabled;
- existing upload-based sermons can still be viewed and edited.

### Backend

`api/app/routers/sermons.py` contains:

```python
RECORDING_UPLOADS_ENABLED = False
```

When false, the API returns HTTP `503` with a temporary-disabled message for:

```text
POST /sermons                       # only when sourceType is upload
POST /sermons/{sermon_id}/upload/init
POST /sermons/{sermon_id}/upload/chunk
POST /sermons/{sermon_id}/upload/complete
```

The following remain available for existing uploaded sermons:

```text
GET /sermons/{sermon_id}/media
POST /sermons/{sermon_id}/transcribe
```

The backend gate prevents a direct API caller from bypassing the disabled frontend.

## Re-enabling uploads

When hosting, storage, and the product direction are ready:

1. Set `RECORDING_UPLOADS_ENABLED = true` in `web/src/components/sermons/SermonForm.tsx`.
2. Set `RECORDING_UPLOADS_ENABLED = True` in `api/app/routers/sermons.py`.
3. Change the upload-card copy from “Temporarily unavailable” back to the normal upload instructions.
4. Run the backend upload tests and the full backend suite.
5. Run `npm run lint` and `npm run build` in `web`.
6. Verify an MP3 or M4A upload from the UI through transcription completion.
7. Verify storage persistence in the deployed environment before enabling the source for users.

Do not re-enable the source solely by changing the frontend. The backend gate must be enabled at the same time.
