# After Sunday Frontend Plan

## Goal

After Sunday is a SaaS discipleship tool that helps churches follow up with people who missed Sunday.

The frontend should feel simple, calm, pastoral, and trustworthy. It should not feel like a generic AI dashboard. The main workflow is:

1. Create a sermon
2. Paste or review a transcript
3. Generate a sermon follow-up draft
4. Edit and approve the draft
5. Choose recipients or groups
6. Send a test email
7. Send the campaign

## Frontend Stack

Use:

* Next.js App Router
* TypeScript
* Tailwind CSS
* Server Components by default
* Client Components only when needed
* Supabase Auth later
* API calls to the FastAPI backend

Do not overbuild the frontend early. Start with clean pages, reusable components, and a simple dashboard flow.

## Frontend Route Structure

Use route groups to separate public pages, auth pages, and the protected app.

```txt
src/app/
  (marketing)/
    page.tsx
    about/
      page.tsx
    pricing/
      page.tsx
    blog/
      page.tsx
      [slug]/
        page.tsx

  (auth)/
    login/
      page.tsx
    signup/
      page.tsx

  app/
    layout.tsx
    dashboard/
      page.tsx
    sermons/
      page.tsx
      new/
        page.tsx
      [sermonId]/
        page.tsx
    recipients/
      page.tsx
    groups/
      page.tsx
    email-campaigns/
      page.tsx
      [campaignId]/
        page.tsx
    settings/
      page.tsx

  layout.tsx
  globals.css
```

## Recommended Folder Structure

Keep shared frontend code organized by purpose.

```txt
src/
  app/
    ...
  components/
    ui/
      Button.tsx
      Input.tsx
      Textarea.tsx
      Card.tsx
      Badge.tsx
      Modal.tsx
      EmptyState.tsx
      PageHeader.tsx
    marketing/
      MarketingHeader.tsx
      HeroSection.tsx
      FeatureSection.tsx
      TestimonialSection.tsx
      Footer.tsx
    app/
      AppSidebar.tsx
      AppHeader.tsx
      StatCard.tsx
      SermonStatusBadge.tsx
      CampaignStatusBadge.tsx
    sermons/
      SermonForm.tsx
      SermonList.tsx
      TranscriptEditor.tsx
      FollowUpEditor.tsx
      EmailPreview.tsx
    recipients/
      RecipientForm.tsx
      RecipientList.tsx
      GroupSelector.tsx
  lib/
    api.ts
    env.ts
    utils.ts
    dates.ts
  types/
    sermon.ts
    recipient.ts
    group.ts
    campaign.ts
  hooks/
    useDebounce.ts
```

## Page Best Practices

### 1. Keep pages thin

Pages should mostly handle layout and call small components.

Bad:

```tsx
export default function SermonsPage() {
  // 400 lines of forms, API calls, tables, and UI
}
```

Good:

```tsx
export default function SermonsPage() {
  return (
    <PageShell>
      <PageHeader title="Sermons" description="Manage sermon follow-ups." />
      <SermonList />
    </PageShell>
  );
}
```

### 2. Use Server Components by default

Most pages should be Server Components unless they need browser behavior.

Use Server Components for:

* Loading page data
* Layouts
* Static marketing content
* Read-only dashboard views

Use Client Components for:

* Forms
* Buttons with click handlers
* Modals
* Editors
* Tabs
* Toasts
* Search inputs
* Dropdowns

Any file that uses `useState`, `useEffect`, `onClick`, or browser APIs needs:

```tsx
"use client";
```

### 3. Keep API logic out of components

Create one API helper file.

```txt
src/lib/api.ts
```

Example pattern:

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("API request failed");
  }

  return response.json();
}
```

Later, add auth headers here instead of repeating auth logic across pages.

### 4. Use typed data models

Create types for each main entity.

```txt
src/types/sermon.ts
src/types/recipient.ts
src/types/group.ts
src/types/campaign.ts
```

Example:

```ts
export type Sermon = {
  id: string;
  title: string;
  preacher?: string | null;
  scriptureReference?: string | null;
  preachedAt?: string | null;
  transcriptStatus: "not_started" | "processing" | "completed" | "failed";
  aiDraftStatus: "not_started" | "draft" | "approved";
  emailStatus: "not_started" | "draft" | "sent";
};
```

### 5. Build reusable UI components early

Start with basic components only:

```txt
Button
Input
Textarea
Card
Badge
PageHeader
EmptyState
```

Do not install a huge UI library at the start unless needed. Tailwind is enough for now.

### 6. Make every app page handle empty states

A SaaS dashboard often starts empty. Empty states should guide the church admin.

Example:

```txt
No sermons yet.
Create your first sermon follow-up by adding a sermon and pasting the transcript.
[Create Sermon]
```

### 7. Make statuses clear

This app has a lot of review steps. Use clear status badges.

Sermon statuses:

```txt
Transcript missing
Transcript ready
AI draft ready
Needs review
Approved
Email drafted
Sent
```

Avoid vague statuses like:

```txt
Pending
Done
Complete
```

### 8. Do not auto-send anything

The frontend should always make it clear that AI output is a draft.

Good button labels:

```txt
Generate Draft
Review Follow-Up
Send Test Email
Approve Draft
Send Campaign
```

Avoid:

```txt
Auto Send
Publish
Blast
```

## Main MVP Pages

## Public Landing Page

Route:

```txt
/
```

Purpose:

Explain what After Sunday does.

Sections:

1. Hero
2. Problem
3. How it works
4. Benefits
5. Example follow-up
6. Call to action

Hero copy direction:

```txt
Sermon follow-up for the people who missed Sunday.
```

Main CTA:

```txt
Start free
```

Secondary CTA:

```txt
See how it works
```

## Dashboard

Route:

```txt
/app/dashboard
```

Show:

* Latest sermons
* Drafts needing review
* Recent campaigns
* Quick action to create sermon

Components:

```txt
DashboardStats
RecentSermons
ReviewQueue
RecentCampaigns
```

## Sermons List

Route:

```txt
/app/sermons
```

Show:

* Sermon title
* Date preached
* Preacher
* Transcript status
* AI draft status
* Email status

Actions:

* Create sermon
* Open sermon detail

## New Sermon Page

Route:

```txt
/app/sermons/new
```

Fields:

* Sermon title
* Preacher
* Date preached
* Scripture reference
* Sermon link, optional
* Transcript text

For MVP, allow pasted transcript first. Do not start with upload or YouTube import yet.

## Sermon Detail Page

Route:

```txt
/app/sermons/[sermonId]
```

This is the most important page.

Sections:

1. Sermon info
2. Transcript editor
3. Generate follow-up button
4. Follow-up editor
5. Email preview
6. Approval/send actions

Best practice:

Break this page into smaller components:

```txt
SermonHeader
TranscriptEditor
GenerateFollowUpPanel
FollowUpEditor
EmailPreview
CampaignActions
```

## Recipients Page

Route:

```txt
/app/recipients
```

Show:

* Name
* Email
* Status
* Groups

Actions:

* Add recipient
* Edit recipient
* Mark unsubscribed later

## Groups Page

Route:

```txt
/app/groups
```

Groups can be:

* Homebound members
* Sick or recovering
* Traveling
* Unable to attend
* Small group leaders
* Sermon recap subscribers

Keep this simple for MVP.

## Email Campaigns Page

Route:

```txt
/app/email-campaigns
```

Show:

* Draft campaigns
* Sent campaigns
* Subject
* Sermon
* Recipients
* Status

Important:

Sending should require review and confirmation.

## Settings Page

Route:

```txt
/app/settings
```

Start with:

* Church name
* Timezone
* Sending email

Later:

* YouTube connection
* Email domain settings
* Integrations

## Component Rules

### UI components should be dumb

Components in `components/ui` should not know about sermons, churches, or campaigns.

Good:

```tsx
<Button>Save</Button>
<Card>...</Card>
<Badge>Draft</Badge>
```

Bad:

```tsx
<SermonSaveButton />
```

That belongs in `components/sermons`.

### Feature components can know the business logic

Components in `components/sermons` can know about sermons.

Examples:

```txt
SermonForm
TranscriptEditor
FollowUpEditor
EmailPreview
```

### Keep forms controlled and simple

For MVP, use simple React state.

Later, add:

* react-hook-form
* zod validation

Do not add too many form libraries before the workflow is clear.

## Data Fetching Plan

For now:

* Use `fetch`
* Keep API helper in `src/lib/api.ts`
* Use `cache: "no-store"` for dashboard/app data
* Use static rendering for marketing pages

Later:

* Add TanStack Query if the app needs more client-side caching
* Add optimistic updates only after the workflow is stable

## Styling Direction

The design should feel:

* Warm
* Calm
* Clear
* Trustworthy
* Ministry-focused
* Less “tech startup”, more “pastoral care”

Suggested visual direction:

* Off-white backgrounds
* Deep green accents
* Soft cards
* Rounded corners
* Clear typography
* Plenty of spacing

Avoid:

* Neon AI look
* Overly complex dashboards
* Too many charts
* Dark-only UI
* Crypto/SaaS hype feel

## Accessibility Best Practices

Every page should have:

* One clear `h1`
* Real button elements for actions
* Labels on all form fields
* Good color contrast
* Keyboard-friendly modals and menus
* Loading states
* Error states

Do not rely only on color for status. Pair color with text.

Good:

```txt
Approved
Needs review
Failed
```

## Error and Loading States

Every data page should support:

```txt
Loading
Error
Empty
Success
```

Example:

```txt
Loading sermons...
Could not load sermons.
No sermons yet.
```

Do not leave blank screens.

## MVP Build Order

Build in this order:

1. Marketing homepage
2. App shell layout
3. Dashboard placeholder
4. Sermons list page
5. Create sermon page
6. Sermon detail page
7. Transcript editor
8. Generate follow-up placeholder button
9. Follow-up editor
10. Email preview
11. Recipients page
12. Groups page
13. Campaign draft page
14. Send test email
15. Send campaign

## What Not To Build Yet

Do not build these first:

* YouTube import
* Audio/video upload
* Full CMS
* Advanced analytics
* Complicated billing
* Complex roles/permissions
* Drag-and-drop email builder
* Multiple themes
* Mobile app

## First Frontend Milestone

The first frontend milestone is:

```txt
A church admin can create a sermon, paste a transcript, view a generated follow-up draft placeholder, edit the draft, and see an email preview.
```

Even before real AI is connected, the page should prove the workflow.

## Simple Definition of Done

A page is done when:

* It has a clear heading
* It has loading, error, and empty states
* It uses typed props
* It has no huge component files
* It works on mobile and desktop
* It has simple accessible form labels
* It does not duplicate API logic
* It matches the After Sunday tone
