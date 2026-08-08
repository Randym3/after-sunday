# After Sunday — Target Architecture

## High-Level Direction

```txt
Next.js Web App
    |
    | Supabase access token
    v
FastAPI
    |
    +---- PostgreSQL
    +---- Object Storage
    +---- Transcription Provider
    +---- AI Provider
    +---- Email Provider
```

## Responsibilities

### Supabase

Initially:

- authentication
- session management

Never expose secret/service keys in browser code.

### Next.js

Owns:

- marketing pages
- protected app UI
- forms
- previews
- client interaction
- authenticated API calls

### FastAPI

Should eventually own:

- sermon persistence
- user/tenant authorization
- source metadata
- upload orchestration
- transcription orchestration
- transcript persistence
- AI generation
- approval state
- recipient/group/campaign logic
- email send orchestration

### PostgreSQL

Store structured application data. Do not store raw MP3/MP4 binaries.

### Object Storage

Store uploaded recordings privately. Use short-lived signed URLs where needed.

### External Providers

Keep providers behind service boundaries:

```txt
StorageService
TranscriptionService
FollowUpGenerationService
EmailService
```

## Media Upload Pattern

Do not:

```txt
Browser
→ huge MP4 body
→ FastAPI
→ storage
```

Prefer:

```txt
Browser
→ request signed upload URL
→ direct upload to private object storage
→ notify FastAPI
→ FastAPI starts transcription
```

## Possible Sermon Fields

```txt
id
church_id
created_by_user_id
title
preacher
scripture_reference
preached_at
source_type
source_url
media_object_key
media_file_name
media_content_type
media_size_bytes
media_duration_seconds
transcript_status
transcript_text
transcription_provider
transcription_provider_job_id
transcription_error
ai_draft_status
follow_up_subject
follow_up_body
approved_at
approved_by_user_id
email_status
created_at
updated_at
```

This is design direction, not a migration to apply blindly.

## Multi-Tenancy

Backend data should eventually belong to a church/workspace.

Authorization must validate:

```txt
authenticated user
→ church membership
→ resource belongs to church
→ action is allowed
```

Do not rely only on Next.js route protection.

## YouTube

Long-term:

```txt
church connects Google/YouTube account
→ choose authorized church video
→ import captions when permitted
→ otherwise use a supported transcription path
```

Do not make arbitrary transcript scraping a core dependency.

## Media Retention

A sensible future default:

```txt
keep transcript
retain raw media temporarily
delete raw media after successful processing + grace period
```
