# TODO — Remove the bulk YouTube import feature (eventually)

The dashboard bulk-import card and its API endpoints were a **one-time
convenience** for importing captions for ~600 legacy sermons. Once the
backlog is imported, remove the feature and keep only the normal
single-sermon import paths (create-sermon form, per-sermon re-transcribe,
`api/scripts/` CLI).

## What to remove

Frontend:
- `web/src/components/dashboard/YoutubeImportCard.tsx` (the card + button)
- its mount point in `web/src/app/(protected)/app/dashboard/page.tsx`
- `bulkImportYoutubeTranscripts`, `getBulkImportStatus`,
  `cancelBulkImport` in `web/src/lib/api/youtube.ts`
- the `orange` Button variant in `web/src/components/ui/Button.tsx`
  (added for this card)

API:
- `POST /youtube/bulk-import-transcripts`, `GET /youtube/bulk-import-status`,
  `POST /youtube/bulk-import-cancel` in `api/app/routers/youtube.py`
- `api/tests/test_youtube_bulk_import.py`

Keep (still used by single-sermon import):
- worker pacing + YouTube block cooldown in
  `api/app/services/transcription.py`
- `NoEnglishCaptionsError` classification and the `[no-english-captions]`
  marker in `api/app/services/youtube.py` (the sermon list badge and the
  workspace message read it)
- `api/scripts/retry_youtube_transcripts.py` (or remove if no longer needed)

— noted 2026-09-10 by the import-feature session
