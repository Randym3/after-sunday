# After Sunday — Product Specification

## Problem

Churches often record Sunday sermons, but follow-up with people who missed the gathering is manual, inconsistent, or nonexistent.

Staff may need to:

- locate the recording
- obtain or prepare a transcript
- identify the main message
- write takeaways
- write reflection/discussion questions
- compose an email
- determine recipients
- send it

After Sunday should reduce that administrative work while preserving pastoral review and church voice.

## Product Promise

A church should be able to give After Sunday the **sermon**, not necessarily a prepared transcript.

```txt
Give us the sermon
→ get/review the transcript
→ generate the follow-up
→ church staff approves it
→ send it
```

## Primary Users

- pastors
- church administrators
- ministry leaders
- communications staff
- discipleship staff

These users operate inside protected `/app/*` routes.

## Recipient

Recipients may be members who missed Sunday or selected church groups. They do not need After Sunday accounts for MVP.

## Core MVP

### Authentication

- sign up
- log in
- log out
- protect `/app/*`

Supabase currently handles auth.

### Sermon Creation

Collect:

- title
- preacher
- scripture reference
- preached date
- source type

Source types:

```txt
upload
youtube
transcript
```

### Transcript Acquisition

Upload without transcript:

```txt
upload media
→ asynchronous transcription
→ transcript ready
```

Upload with transcript:

```txt
upload media
+
provided transcript
→ transcript ready
```

YouTube may use an authorized church-owned video/caption flow later. If transcript is supplied, use it.

Paste Transcript requires transcript text.

### Transcript Review

Staff must be able to read, edit, and save transcript corrections before generating follow-up content.

### Follow-Up Generation

Generate a draft from the reviewed transcript. It should eventually support:

- subject
- pastoral introduction
- sermon summary
- key takeaways
- reflection/discussion questions
- closing

The current prototype uses an editable subject/body pair.

### Human Review

Staff must be able to:

- edit generated content
- save draft
- preview recipient-facing email
- approve draft

Editing approved content should invalidate approval.

### Recipients and Sending

Add recipients/groups only after sermon-to-approval is real.

Email sending occurs only after human approval.

## Future Features — Not MVP Priority

- billing/subscriptions
- complex roles/permissions
- team invitations
- advanced analytics
- public member dashboards
- public sermon pages
- drag/drop email designer
- native mobile app
- live transcription
- automated YouTube polling

## UX Principles

Pastoral, not robotic.

Prefer:

```txt
Preparing your follow-up
Draft ready for review
Review before sending
```

over:

```txt
AI output generated successfully
LLM processing completed
```

Prefer specific statuses:

```txt
Transcribing
Transcript Ready
Needs Review
Approved
Ready to Send
Sent
```
