# After Sunday — Implementation Standards

## Frontend

Keep route pages thin. Prefer focused domain components.

Possible sermon components:

```txt
SermonWorkspace
SermonOverview
SermonSourceSummary
TranscriptEditor
FollowUpEditor
EmailPreview
CampaignActions
SermonStatusBadge
```

Do not split components just to reduce line count; split by meaningful responsibility.

## State

For the prototype:

- local React state is fine
- `sessionStorage` is fine
- avoid Redux/Zustand/etc. unless justified

Once real API persistence exists, do not keep `sessionStorage` as a hidden second source of truth.

## Types

Use domain unions instead of loose strings.

Avoid `status: string` when the state machine is known.

Approval must remain distinct from draft existence.

## Forms

- real labels
- explicit required state
- client validation for UX
- authoritative backend validation later
- meaningful errors
- do not lose user work unexpectedly

## Accessibility

- semantic HTML
- keyboard-accessible controls
- visible focus
- status text not based only on color
- `aria-live` for meaningful async states when appropriate
- descriptive actions

## Styling

Reuse the existing visual system:

```txt
warm off-white
deep green
lime accents
rounded surfaces
calm typography
```

Do not introduce an unrelated design system.

## Loading Language

Prefer:

```txt
Preparing your follow-up
Transcribing sermon
Uploading recording
```

over vague text when a specific status is available.

## Backend

Use the actual repo structure if already established. Otherwise prefer clear separation among routers, schemas, services, models, and database code.

External integrations should live behind services.

## Database

- use migrations
- use timestamps
- model ownership/tenant IDs
- use foreign keys
- index common ownership/status queries
- do not store raw media blobs
- record provider job IDs and error states

## Security

Never expose:

- Supabase secret/service key
- transcription API keys
- AI provider keys
- storage secrets
- email provider secrets

Backend routes must verify authentication and resource ownership.

## Testing

High-value frontend behavior:

```txt
source selection
conditional validation
approval invalidation
generation gating
```

High-value backend behavior:

```txt
authentication
tenant isolation
state transitions
webhook idempotency
authorization
validation
```

## Definition of Done

A task is done when:

1. implementation is complete
2. relevant lint/build/tests were run
3. errors are resolved or documented
4. behavior changes are summarized
5. remaining mocks are stated explicitly
6. docs are updated if architecture/product behavior changed
