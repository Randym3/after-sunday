# One-Shot Campaign Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace weekly-recurring campaign scheduling with one-shot scheduling (a concrete `send_at`), keeping the "Sunday night / Monday morning" slot picker as a convenience that computes the next occurrence.

**Architecture:** Campaigns are tied to one sermon's approved follow-up draft, so recurrence is semantically wrong; the only scheduling field becomes `send_at`. The frontend form offers two ergonomic ways to set it — an exact datetime, or "next {day} at {slot}" which computes the next occurrence and shows a live preview before saving. Backend drops the `weekly_day`/`weekly_time` columns and enforces that `send_at` is present and in the future.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (Postgres), Pydantic v2; Next.js 16 App Router, React 19, TypeScript, Tailwind v4.

## Global Constraints

- Follow repo conventions (read `AGENTS.md` and `docs/agent/02_CURRENT_STATE.md` first). Commits use the repo style: one short lowercase line, no emoji, no AI signature/footer.
- `send_at` becomes the **only** scheduling column on `campaigns`. Do not add new scheduling columns.
- API speaks camelCase (aliases in `app/schemas/aliases.py`); keep the existing `CampaignCreate`/`CampaignRead` shapes otherwise intact.
- Reuse existing UI (`Card`, `Button`, the `inputClass` string in `CampaignForm.tsx`); preserve the visual language.
- No new runtime dependencies. `pytest` may be added to `api/requirements.txt` as the only new (dev) dependency.
- The schedule must remain editable on the edit page (single datetime input).
- Naive datetimes from the browser are treated as UTC for the future-check (documented imprecision, acceptable for MVP — do not build timezone plumbing).

---

### Task 1: Drop weekly columns (migration + model)

**Files:**
- Create: `api/alembic/versions/0011_drop_campaign_weekly.py`
- Modify: `api/app/models/campaign.py`

**Interfaces:**
- Consumes: migration `0010_add_campaign_schedule` (revision id `0010_add_campaign_schedule`)
- Produces: DB schema where `campaigns` has `send_at` but no `weekly_day`/`weekly_time`; model `Campaign` has only `send_at` among schedule fields

- [ ] **Step 1: Write the migration**

Create `api/alembic/versions/0011_drop_campaign_weekly.py`:

```python
"""drop weekly campaign schedule columns

Revision ID: 0011_drop_campaign_weekly
Revises: 0010_add_campaign_schedule
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_drop_campaign_weekly"
down_revision: Union[str, None] = "0010_add_campaign_schedule"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("campaigns", "weekly_time")
    op.drop_column("campaigns", "weekly_day")


def downgrade() -> None:
    op.add_column("campaigns", sa.Column("weekly_day", sa.Integer(), nullable=True))
    op.add_column("campaigns", sa.Column("weekly_time", sa.Time(), nullable=True))
```

- [ ] **Step 2: Apply the migration**

Run: `cd api && source .venv/bin/activate && alembic upgrade head`
Expected: `Running upgrade 0010_add_campaign_schedule -> 0011_drop_campaign_weekly`

- [ ] **Step 3: Update the model**

In `api/app/models/campaign.py`, delete these two mapped columns (keep `send_at`):

```python
    weekly_day: Mapped[int | None] = mapped_column(nullable=True)
    weekly_time: Mapped[time | None] = mapped_column(nullable=True)
```

Also remove the now-unused `time` import (change `from datetime import datetime, time` back to `from datetime import datetime`).

- [ ] **Step 4: Verify and commit**

Run: `cd api && source .venv/bin/activate && python -m compileall -q app`
Expected: no output, exit 0.

```bash
cd api && source .venv/bin/activate && alembic upgrade head
git add api/alembic/versions/0011_drop_campaign_weekly.py api/app/models/campaign.py
git commit -m "drop weekly campaign schedule columns"
```

---

### Task 2: Enforce one-shot `send_at` in schemas

**Files:**
- Modify: `api/app/schemas/campaign.py`

**Interfaces:**
- Consumes: nothing new (pure Pydantic)
- Produces: module-level `_validate_send_at(send_at: datetime | None) -> None` raising `ValueError` on missing/past values; `CampaignCreate.send_at: datetime` (required, future), `CampaignUpdate.send_at: datetime | None` (future when provided); `CampaignRead` without weekly fields; `extra="forbid"` on create/update configs

- [ ] **Step 1: Write the failing test**

Create `api/tests/__init__.py` (empty) and `api/tests/test_campaign_schedule.py`:

```python
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas.campaign import CampaignCreate, _validate_send_at


def test_missing_send_at_rejected():
    with pytest.raises(ValueError, match="Choose when"):
        _validate_send_at(None)


def test_past_send_at_rejected():
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    with pytest.raises(ValueError, match="future"):
        _validate_send_at(past)


def test_future_send_at_accepted():
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    _validate_send_at(future)  # must not raise


def test_create_requires_send_at():
    with pytest.raises(ValidationError):
        CampaignCreate(name="Test", sermon_id=uuid.uuid4(), group_id=uuid.uuid4())


def test_weekly_fields_rejected():
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    with pytest.raises(ValidationError):
        CampaignCreate(
            name="Test",
            sermon_id=uuid.uuid4(),
            group_id=uuid.uuid4(),
            send_at=future,
            weekly_day=0,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && source .venv/bin/activate && python -m pytest tests/test_campaign_schedule.py -v`
Expected: FAIL — `_validate_send_at` is not defined / `weekly_day` not forbidden.

- [ ] **Step 3: Update the schemas**

In `api/app/schemas/campaign.py`:

1. Replace the whole `_validate_schedule(...)` function with:

```python
def _validate_send_at(send_at: datetime | None) -> None:
    if send_at is None:
        raise ValueError("Choose when the campaign should go out.")
    if send_at.tzinfo is None:
        send_at = send_at.replace(tzinfo=timezone.utc)
    if send_at <= datetime.now(timezone.utc):
        raise ValueError("The send time must be in the future.")
```

2. Add imports: `from datetime import datetime, timezone` (drop `time`), and `from pydantic import ... field_validator`.

3. `CampaignCreate`:

```python
class CampaignCreate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    name: str = Field(min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=300)
    body: str | None = None
    sermon_id: uuid.UUID
    group_id: uuid.UUID | None = None
    member_ids: list[uuid.UUID] = []
    send_at: datetime

    @field_validator("send_at", mode="after")
    @classmethod
    def send_at_must_be_future(cls, value: datetime) -> datetime:
        _validate_send_at(value)
        return value

    @model_validator(mode="after")
    def validate_recipients(self):
        if (self.group_id is None) == (len(self.member_ids) == 0):
            raise ValueError("Choose a group or at least one explicit member.")
        return self
```

4. `CampaignUpdate`:

```python
class CampaignUpdate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    name: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=300)
    body: str | None = None
    send_at: datetime | None = None

    @field_validator("send_at", mode="after")
    @classmethod
    def send_at_must_be_future(cls, value: datetime) -> datetime:
        _validate_send_at(value)
        return value
```

5. `CampaignRead`: remove `weekly_day: int | None` and `weekly_time: time | None`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && source .venv/bin/activate && python -m pytest tests/test_campaign_schedule.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add api/requirements.txt api/tests/ api/app/schemas/campaign.py
git commit -m "require one-shot send time on campaigns"
```

> Note: if `pytest` is not installed in `.venv`, add `pytest==8.4.1` to `api/requirements.txt` and run `pip install -r requirements.txt` before the test steps.

---

### Task 3: Drop weekly fields from the campaign router

**Files:**
- Modify: `api/app/routers/campaigns.py`

**Interfaces:**
- Consumes: `CampaignRead` from Task 2 (no weekly fields)
- Produces: `create_campaign` that stores only `send_at`; existing GET/PATCH/DELETE/bulk-delete endpoints unchanged in behavior

- [ ] **Step 1: Edit `create_campaign`**

In `api/app/routers/campaigns.py`, change the `Campaign(...)` constructor call from:

```python
        send_at=payload.send_at, weekly_day=payload.weekly_day, weekly_time=payload.weekly_time,
```

to:

```python
        send_at=payload.send_at,
```

- [ ] **Step 2: Verify and commit**

Run: `cd api && source .venv/bin/activate && python -m compileall -q app && python -c "from app.main import app; import app.routers.campaigns as c; print(sorted({r.path for r in c.router.routes}))"`
Expected: no errors; routes include `/campaigns`, `/campaigns/bulk-delete`, `/campaigns/{campaign_id}`, `/campaigns/{campaign_id}/recipients`.

```bash
git add api/app/routers/campaigns.py
git commit -m "remove weekly fields from campaign create"
```

---

### Task 4: Update frontend types and list display

**Files:**
- Modify: `web/src/types/campaign.ts`
- Modify: `web/src/components/campaigns/CampaignList.tsx`

**Interfaces:**
- Consumes: backend `CampaignRead` (no weekly fields, `sendAt` always present)
- Produces: `Campaign.sendAt: string` (required), `CreateCampaignInput.sendAt: string` (required), no weekly fields anywhere in the frontend

- [ ] **Step 1: Update types**

In `web/src/types/campaign.ts`:

- Remove `weeklyDay?: number | null;` and `weeklyTime?: string | null;` from `Campaign`; change `sendAt?: string | null;` to `sendAt: string;`
- Remove `weeklyDay?: number;` and `weeklyTime?: string;` from `CreateCampaignInput`; change `sendAt?: string;` to `sendAt: string;`

- [ ] **Step 2: Simplify the list schedule formatter**

In `web/src/components/campaigns/CampaignList.tsx`, replace `formatSchedule` with:

```tsx
function formatSchedule(campaign: Campaign): string {
  const date = new Date(campaign.sendAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
```

- [ ] **Step 3: Verify and commit**

Run: `cd web && npm run lint && npm run build`
Expected: both pass.

```bash
git add web/src/types/campaign.ts web/src/components/campaigns/CampaignList.tsx
git commit -m "make campaign send time one-shot in the frontend"
```

---

### Task 5: Rework the schedule section of the campaign form

**Files:**
- Modify: `web/src/components/campaigns/CampaignForm.tsx`

**Interfaces:**
- Consumes: `Campaign.sendAt: string`, `CampaignFormValues` (from this file), `campaign?: Campaign | null`
- Produces: `CampaignFormValues.sendAt: string` — always a concrete `"YYYY-MM-DDTHH:MM"` value; edit mode submits a datetime-local value; no weekly fields in `CampaignFormValues`

- [ ] **Step 1: Add helpers**

After the `TIME_SLOTS` constant in `web/src/components/campaigns/CampaignForm.tsx`, add:

```tsx
function nextOccurrence(day: number, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const candidate = new Date();
  candidate.setHours(hours, minutes, 0, 0);
  const daysAhead = (day - candidate.getDay() + 7) % 7;
  if (daysAhead === 0 && candidate.getTime() <= Date.now()) {
    candidate.setDate(candidate.getDate() + 7);
  } else {
    candidate.setDate(candidate.getDate() + daysAhead);
  }
  return candidate;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
```

- [ ] **Step 2: Replace schedule state**

Replace the three schedule state lines:

```tsx
  const [scheduleMode, setScheduleMode] = useState<"specific" | "weekly">(campaign?.weeklyDay != null ? "weekly" : "specific");
  const [sendAt, setSendAt] = useState(isoToLocalInput(campaign?.sendAt));
  const [weeklyDay, setWeeklyDay] = useState(campaign?.weeklyDay ?? 0);
  const [weeklyTime, setWeeklyTime] = useState(campaign?.weeklyTime ? campaign.weeklyTime.slice(0, 5) : "19:00");
```

with:

```tsx
  const [scheduleMode, setScheduleMode] = useState<"specific" | "dayTime">("dayTime");
  const [sendAt, setSendAt] = useState(isoToLocalInput(campaign?.sendAt));
  const [weeklyDay, setWeeklyDay] = useState(0);
  const [weeklyTime, setWeeklyTime] = useState("08:00");
```

Add after the existing derived values:

```tsx
  const computedSendAt = useMemo(
    () => (scheduleMode === "dayTime" ? toLocalInput(nextOccurrence(weeklyDay, weeklyTime)) : sendAt),
    [scheduleMode, weeklyDay, weeklyTime, sendAt],
  );
  const computedDate = useMemo(
    () => (scheduleMode === "dayTime" ? nextOccurrence(weeklyDay, weeklyTime) : null),
    [scheduleMode, weeklyDay, weeklyTime],
  );
```

- [ ] **Step 3: Update submit to always send `sendAt`**

In `submit`, replace the schedule spread:

```tsx
      ...(scheduleMode === "specific"
        ? { sendAt }
        : { weeklyDay: Number(weeklyDay), weeklyTime }),
```

with:

```tsx
      sendAt: computedSendAt,
```

and remove the early-return guard `if (scheduleMode === "specific" && !sendAt) return;`.

- [ ] **Step 4: Replace the schedule JSX**

Replace the entire `When should it go out?` fieldset with:

```tsx
      {editing ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">When should it go out?</legend>
          <input
            type="datetime-local"
            value={sendAt}
            onChange={(e) => setSendAt(e.target.value)}
            className={`${inputClass} mt-1`}
            required
          />
        </fieldset>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">When should it go out?</legend>
          <div className="flex gap-5 text-sm">
            <label>
              <input type="radio" checked={scheduleMode === "specific"} onChange={() => setScheduleMode("specific")} className="mr-2 accent-primary" />
              Specific date &amp; time
            </label>
            <label>
              <input type="radio" checked={scheduleMode === "dayTime"} onChange={() => setScheduleMode("dayTime")} className="mr-2 accent-primary" />
              Next day &amp; time
            </label>
          </div>
          {scheduleMode === "specific" ? (
            <input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className={`${inputClass} mt-3`} required />
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-3">
                <select value={weeklyDay} onChange={(e) => setWeeklyDay(Number(e.target.value))} className={inputClass} style={{ width: "auto" }}>
                  {DAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>{label}</option>
                  ))}
                </select>
                <select value={weeklyTime} onChange={(e) => setWeeklyTime(e.target.value)} className={inputClass} style={{ width: "auto" }}>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>{slot.label}</option>
                  ))}
                </select>
              </div>
              {computedDate ? (
                <p className="mt-2 text-sm font-medium text-ink-soft">
                  This will go out {computedDate.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
                </p>
              ) : null}
            </>
          )}
        </fieldset>
      )}
```

- [ ] **Step 5: Verify and commit**

Run: `cd web && npm run lint && npm run build`
Expected: both pass.

```bash
git add web/src/components/campaigns/CampaignForm.tsx
git commit -m "schedule campaigns one-shot with day and time slots"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Backend checks**

Run:
```bash
cd api && source .venv/bin/activate && alembic upgrade head && python -m compileall -q app && python -m pytest tests/ -v
```
Expected: migrations at head, compile clean, `5 passed`.

- [ ] **Step 2: Frontend checks**

Run: `cd web && npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 3: Manual smoke (dev servers already running)**

In the running app (http://localhost:3000):

1. Create a campaign, pick "Next day & time" → confirm the preview shows a concrete date.
2. Save → confirm the list shows a concrete date (e.g. "Mon, Aug 17 at 8:00 AM") and the campaign appears under it.
3. Open the edit page → confirm the schedule input is prefilled with that date/time.
4. Confirm the API rejects a past time: `curl -s -X POST http://localhost:8000/campaigns -H 'Content-Type: application/json' -d '{"name":"x","sermonId":"00000000-0000-0000-0000-000000000000","groupId":"00000000-0000-0000-0000-000000000000","sendAt":"2020-01-01T09:00"}'` → expect `422` with a message about the future (auth will 401 first without a token; verify via the UI instead if so).

- [ ] **Step 4: Update the roadmap doc**

In `docs/agent/04_ROADMAP.md`, update the Phase 9 bullet to drop "weekly" wording, e.g.:

```txt
- campaign creation/listing + recipient resolution (migration 0008), sermon-linked
  email drafts, one-shot scheduling (migration 0011), and edit/delete/bulk-delete
  implemented; email sending remains pending
```

- [ ] **Step 5: Commit**

```bash
git add docs/agent/04_ROADMAP.md
git commit -m "document one-shot campaign scheduling"
```

---

## Self-Review Notes

- **Spec coverage:** every requirement of the design decision (drop recurrence, keep slot UX as one-shot, required future `send_at`, editable in edit page, list shows concrete date) maps to Tasks 1–6. No stray requirements.
- **Placeholder scan:** all code steps contain concrete code; no TBD/TODO. The only conditional is the pytest install note in Task 2, which is explicit.
- **Type consistency:** `sendAt` is `string` in `Campaign`/`CreateCampaignInput`/`CampaignFormValues` and `datetime` in Pydantic (camelCase alias) — matched across tasks. `_validate_send_at` is module-level in `schemas/campaign.py` and imported by tests exactly as named. `weeklyDay`/`weeklyTime` persist only as transient form state (Task 5) and are never sent to the API.
