# Members ↔ Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let church staff organize members into groups (Men's Ministry, Women's Ministry, etc.) — a group has a name/description, and members can belong to any number of groups — with full CRUD and member-management UI, designed so a future campaign/send engine can target a group, a campaign-with-a-group, or a single recipient.

**Architecture:** A `groups` table plus a `group_members` association table (composite PK `(group_id, member_id)`, DB-level `ON DELETE CASCADE` both ways). Groups get their own FastAPI router (`/groups`) with CRUD + membership endpoints; the members API gains a `groupIds` field so a member's groups are visible in the member form and synced on create/update. The frontend reuses the proven template: `DataTable` for the groups list, route-based `/app/groups/new` + `/app/groups/[groupId]` pages, and a groups multi-select in `MemberForm`. A future `campaigns` table can resolve recipients by `group_id` (reusing `group_members`) or store explicit recipient ids — the resolution primitive (member_ids from a group) is exactly what the send engine will need later.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (Mapped style), Alembic, Pydantic v2 (camelCase aliases), Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4. No new dependencies.

## Global Constraints

- **No new dependencies** (API or web). Use what's already installed: FastAPI, SQLAlchemy, Pydantic, Next.js, Tailwind.
- **Follow existing patterns exactly:** camelCase API fields via `to_camel` in `api/app/schemas/aliases.py`; explicit query style (no SQLAlchemy `relationship()` — mirror `api/app/routers/members.py`); the shared `DataTable` template for list views; `PageHeader` with the action button in the header; route-based create/edit pages (`/app/groups/new`, `/app/groups/[groupId]`).
- **No automated test harness exists in this repo.** Verification uses the project's established loop: `alembic upgrade head` + `psql` for migrations, `curl` against the running API (port 8000, requires a Supabase bearer token — see Task 2 verification for how to obtain one), `npm run lint` + `npm run build` for the web app, and live browser checks at `http://localhost:3000` (dev server on port 3000).
- **DB details:** local Docker Postgres 16 via `api/docker-compose.yml`, host port **5433** (5432 is occupied by native Postgres on this machine). Container `after-sunday-db`, user/db/password all `after_sunday`. Run alembic from `api/` with `.venv/bin/alembic`.
- **Group names:** `String(100)`, not null, unique — uniqueness enforced case-insensitively with a 409 on conflict (mirror the members email 409 pattern).
- **Membership is many-to-many:** a member can be in any number of groups; deleting a group or a member removes only their memberships (cascade), never the other entity.
- **Visual style preserved:** warm off-white surfaces, deep green `#012f11` brand, lime accents, rounded cards (`rounded-2xl`), `cursor: pointer` already global.
- **Routes that already exist in the sidebar:** `/app/groups` currently 404s (empty dir) — this plan makes it real. `/app/email-campaigns` and `/app/settings` stay 404 (out of scope).
- **Email sending / campaigns are OUT OF SCOPE** in this plan (separate follow-up plan). This plan only builds the groups data model + UI that sending will later target.

---

## File Structure

**New backend files:**
- `api/alembic/versions/0007_create_groups.py` — `groups` + `group_members` tables
- `api/app/models/group.py` — `Group` and `GroupMember` models
- `api/app/schemas/group.py` — `GroupCreate`, `GroupUpdate`, `GroupRead`, `MemberIdsRequest`, `BulkDeleteRequest`
- `api/app/routers/groups.py` — CRUD + membership endpoints

**Modified backend files:**
- `api/app/models/__init__.py` — export `Group`, `GroupMember`
- `api/app/main.py` — include the groups router
- `api/app/schemas/member.py` — add `group_ids` to `MemberCreate` / `MemberUpdate` / `MemberRead`
- `api/app/routers/members.py` — sync + return `group_ids`

**New frontend files:**
- `web/src/types/group.ts` — `Group`, `CreateGroupInput`
- `web/src/lib/api/groups.ts` — typed API functions
- `web/src/app/(protected)/app/groups/page.tsx` — list page
- `web/src/app/(protected)/app/groups/new/page.tsx` — create page
- `web/src/app/(protected)/app/groups/[groupId]/page.tsx` — detail/manage page
- `web/src/components/groups/GroupList.tsx` — DataTable config for groups
- `web/src/components/groups/GroupForm.tsx` — name/description form (create + edit)
- `web/src/components/groups/GroupCreate.tsx` — create flow (submit → redirect)
- `web/src/components/groups/GroupEdit.tsx` — detail page: form + member management

**Modified frontend files:**
- `web/src/types/member.ts` — add `groupIds` to `Member` and `CreateMemberInput`
- `web/src/components/members/MemberForm.tsx` — groups multi-select, submits `groupIds`

**Docs:**
- `docs/agent/02_CURRENT_STATE.md`, `docs/agent/04_ROADMAP.md` — mark Phase 9 groups complete

---

### Task 1: Migration — `groups` + `group_members` tables

**Files:**
- Create: `api/alembic/versions/0007_create_groups.py`

**Interfaces:**
- Consumes: latest alembic head (`0006_add_sermon_transcript_error`)
- Produces: `groups` and `group_members` tables (columns below); Task 2's models map onto them

- [ ] **Step 1: Create the migration file**

```python
"""create groups and group_members tables

Revision ID: 0007_create_groups
Revises: 0006_add_sermon_transcript_error
Create Date: 2026-08-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_create_groups"
down_revision: Union[str, None] = "0006_add_sermon_transcript_error"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("church_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_groups_name", "groups", ["name"], unique=True)
    op.create_index(
        "ix_groups_created_by_user_id", "groups", ["created_by_user_id"]
    )

    op.create_table(
        "group_members",
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("member_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["member_id"], ["members.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("group_id", "member_id"),
    )
    op.create_index(
        "ix_group_members_member_id", "group_members", ["member_id"]
    )


def downgrade() -> None:
    op.drop_table("group_members")
    op.drop_index("ix_groups_created_by_user_id", table_name="groups")
    op.drop_index("ix_groups_name", table_name="groups")
    op.drop_table("groups")
```

- [ ] **Step 2: Verify up/down/up**

Run (from `api/`):
```bash
.venv/bin/alembic upgrade head
```
Expected: applies `0007_create_groups`, no error.

Then:
```bash
docker exec after-sunday-db psql -U after_sunday -d after_sunday -c "\d groups"
docker exec after-sunday-db psql -U after_sunday -d after_sunday -c "\d group_members"
```
Expected: `groups` has id, church_id, created_by_user_id, name (unique index), description, created_at, updated_at. `group_members` has group_id + member_id composite PK, both FKs with `ON DELETE CASCADE`, index on member_id.

Then:
```bash
.venv/bin/alembic downgrade -1 && .venv/bin/alembic upgrade head
```
Expected: both commands succeed; tables return.

- [ ] **Step 3: Commit**

```bash
git add api/alembic/versions/0007_create_groups.py
git commit -m "Add groups and group_members tables"
```

---

### Task 2: Groups backend — model, schemas, CRUD router

**Files:**
- Create: `api/app/models/group.py`
- Create: `api/app/schemas/group.py`
- Create: `api/app/routers/groups.py`
- Modify: `api/app/models/__init__.py`
- Modify: `api/app/main.py`

**Interfaces:**
- Consumes: `Base` from `app.db`, `get_db` from `app.db`, `get_current_user_uuid` from `app.auth`, `to_camel` from `app.schemas.aliases`
- Produces: router `groups` (prefix `/groups`) with:
  - `POST /groups` → 201 `GroupRead` (409 on duplicate name)
  - `GET /groups` → `list[GroupRead]` ordered by name asc, each with `memberCount`
  - `GET /groups/{group_id}` → `GroupRead` (404 if missing)
  - `PATCH /groups/{group_id}` → `GroupRead` (409 on duplicate name)
  - `DELETE /groups/{group_id}` → `GroupRead`
  - `POST /groups/bulk-delete` → `{"deleted": int}` (must be registered BEFORE `/{group_id}` routes or FastAPI matches `"bulk-delete"` as a group_id — see the route order note below)
- Produces (for Task 3): `GroupRead` with `member_count: int`; the `_get_group_or_404` helper pattern
- Produces (for Task 4): `Group` and `GroupMember` models exported from `app.models`

- [ ] **Step 1: Create `api/app/models/group.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    church_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("members.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
```

- [ ] **Step 2: Create `api/app/schemas/group.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.aliases import to_camel


class GroupCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class GroupUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None


class GroupRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: uuid.UUID
    name: str
    description: str | None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class MemberIdsRequest(BaseModel):
    member_ids: list[uuid.UUID]


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]
```

- [ ] **Step 3: Create `api/app/routers/groups.py`**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user_uuid
from app.db import get_db
from app.models.group import Group, GroupMember
from app.schemas.group import (
    BulkDeleteRequest,
    GroupCreate,
    GroupRead,
    GroupUpdate,
    MemberIdsRequest,
)

router = APIRouter(prefix="/groups", tags=["groups"])


def _get_group_or_404(db: Session, group_id: uuid.UUID) -> Group:
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def _name_taken(
    db: Session, name: str, exclude_id: uuid.UUID | None = None
) -> bool:
    query = select(Group).where(func.lower(Group.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Group.id != exclude_id)
    return db.scalar(query) is not None


def _member_count(db: Session, group_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count())
        .select_from(GroupMember)
        .where(GroupMember.group_id == group_id)
    ) or 0


def _to_read(group: Group, member_count: int) -> GroupRead:
    return GroupRead(
        id=group.id,
        name=group.name,
        description=group.description,
        member_count=member_count,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


# NOTE: POST /bulk-delete never collides with the /{group_id} routes (those
# use GET/PATCH/DELETE), so route order is cosmetic — keep it near the other
# list-level routes for readability, matching the members.py layout.


@router.post("", response_model=GroupRead, status_code=201)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    name = payload.name.strip()
    if _name_taken(db, name):
        raise HTTPException(
            status_code=409, detail="A group with this name already exists."
        )
    group = Group(
        created_by_user_id=_user,
        name=name,
        description=payload.description.strip() if payload.description else None,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return _to_read(group, 0)


@router.post("/bulk-delete", response_model=dict)
def bulk_delete_groups(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    groups = db.scalars(
        select(Group).where(Group.id.in_(payload.ids))
    ).all()
    for group in groups:
        db.delete(group)
    db.commit()
    return {"deleted": len(groups)}


@router.get("", response_model=list[GroupRead])
def list_groups(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    groups = db.scalars(select(Group).order_by(Group.name.asc())).all()
    counts = dict(
        db.execute(
            select(GroupMember.group_id, func.count(GroupMember.member_id))
            .group_by(GroupMember.group_id)
        ).all()
    )
    return [_to_read(g, counts.get(g.id, 0)) for g in groups]


@router.get("/{group_id}", response_model=GroupRead)
def get_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    group = _get_group_or_404(db, group_id)
    return _to_read(group, _member_count(db, group_id))


@router.patch("/{group_id}", response_model=GroupRead)
def update_group(
    group_id: uuid.UUID,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    group = _get_group_or_404(db, group_id)
    data = payload.model_dump(exclude_unset=True)

    if data.get("name") is not None:
        data["name"] = data["name"].strip()
        if _name_taken(db, data["name"], exclude_id=group_id):
            raise HTTPException(
                status_code=409,
                detail="A group with this name already exists.",
            )

    if data.get("description") is not None:
        data["description"] = data["description"].strip()

    for field, value in data.items():
        setattr(group, field, value)

    db.commit()
    db.refresh(group)
    return _to_read(group, _member_count(db, group_id))


@router.delete("/{group_id}", response_model=GroupRead)
def delete_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    group = _get_group_or_404(db, group_id)
    db.delete(group)
    db.commit()
    return _to_read(group, 0)
```

- [ ] **Step 4: Register the router + models**

`api/app/models/__init__.py` — replace the whole file:

```python
from app.models.group import Group, GroupMember
from app.models.member import Member
from app.models.sermon import Sermon

__all__ = ["Group", "GroupMember", "Member", "Sermon"]
```

`api/app/main.py` — find where `members.router` is included (pattern: `from app.routers.members import router as members_router` then `app.include_router(members_router)`). Add, next to the members import/include:

```python
from app.routers.groups import router as groups_router

# in the include block:
app.include_router(groups_router)
```

- [ ] **Step 5: Verify imports compile**

Run (from `api/`):
```bash
.venv/bin/python -c "from app.main import app; print('ok')"
```
Expected: prints `ok`, no import errors.

- [ ] **Step 6: Restart API + verify CRUD with curl**

Restart the API (kill the uvicorn process on port 8000, then):
```bash
cd api && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Obtain a bearer token: open `http://localhost:3000` in the browser, log in, open devtools console, run:
```js
(await supabase.auth.getSession()).data.session.access_token
```
(If `supabase` isn't on the page scope, copy the `Authorization` header from any `/sermons` network request.) Then export it:
```bash
export TOKEN="<paste-token>"
```

Verify with curl (run from anywhere):
```bash
curl -s -X POST http://localhost:8000/groups -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Men'\''s Ministry","description":"Men'\''s discipleship group"}' -w "\n%{http_code}\n"
```
Expected: `201`, body has `id`, `name: "Men's Ministry"`, `memberCount: 0`.

```bash
curl -s -X POST http://localhost:8000/groups -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"mens ministry"}' -w "\n%{http_code}\n"
```
Expected: `409` (case-insensitive duplicate).

```bash
curl -s http://localhost:8000/groups -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8000/groups/<group-id> -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH http://localhost:8000/groups/<group-id> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"description":"Updated description"}'
curl -s -X DELETE http://localhost:8000/groups/<group-id> -H "Authorization: Bearer $TOKEN"
```
Expected: list shows the group with `memberCount: 0`; get returns it; patch updates description; delete returns it and a subsequent get is `404`.

- [ ] **Step 7: Commit**

```bash
git add api/app/models/group.py api/app/schemas/group.py api/app/routers/groups.py api/app/models/__init__.py api/app/main.py
git commit -m "Add groups CRUD backend"
```

---

### Task 3: Group membership endpoints

**Files:**
- Modify: `api/app/routers/groups.py`

**Interfaces:**
- Consumes: `GroupMember`, `Member` models; `MemberRead` from `app.schemas.member`; `MemberIdsRequest` from `app.schemas.group`
- Produces:
  - `GET /groups/{group_id}/members` → `list[MemberRead]` (ordered last_name, first_name)
  - `POST /groups/{group_id}/members` body `{"memberIds": [...]}` → `{"added": int}` (idempotent — already-members are skipped; non-existent member ids are silently skipped)
  - `DELETE /groups/{group_id}/members` body `{"memberIds": [...]}` → `{"removed": int}`
- Consumed by Task 7 (group detail page: list members, add, remove)

- [ ] **Step 1: Add the three endpoints to `api/app/routers/groups.py`**

Add imports at the top of the file (extend the existing `from app.models.group import ...` line area):

```python
from app.models.member import Member
from app.schemas.member import MemberRead
```

Add these endpoints at the END of the file (after `delete_group`):

```python
@router.get("/{group_id}/members", response_model=list[MemberRead])
def list_group_members(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    _get_group_or_404(db, group_id)
    return db.scalars(
        select(Member)
        .join(GroupMember, GroupMember.member_id == Member.id)
        .where(GroupMember.group_id == group_id)
        .order_by(Member.last_name.asc(), Member.first_name.asc())
    ).all()


@router.post("/{group_id}/members", response_model=dict)
def add_group_members(
    group_id: uuid.UUID,
    payload: MemberIdsRequest,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    _get_group_or_404(db, group_id)

    existing = set(
        db.scalars(
            select(GroupMember.member_id).where(
                GroupMember.group_id == group_id
            )
        ).all()
    )
    valid_ids = set(
        db.scalars(
            select(Member.id).where(Member.id.in_(payload.member_ids))
        ).all()
    )
    to_add = valid_ids - existing

    for member_id in to_add:
        db.add(GroupMember(group_id=group_id, member_id=member_id))
    db.commit()
    return {"added": len(to_add)}


@router.delete("/{group_id}/members", response_model=dict)
def remove_group_members(
    group_id: uuid.UUID,
    payload: MemberIdsRequest,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    _get_group_or_404(db, group_id)

    memberships = db.scalars(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.member_id.in_(payload.member_ids),
        )
    ).all()
    for membership in memberships:
        db.delete(membership)
    db.commit()
    return {"removed": len(memberships)}
```

- [ ] **Step 2: Verify with curl**

Restart the API. Create a group and capture its id, and note an existing member's id (from `GET /members`). Then:

```bash
curl -s -X POST http://localhost:8000/groups/<group-id>/members -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"memberIds":["<member-id>"]}'
```
Expected: `{"added": 1}`.

```bash
curl -s -X POST http://localhost:8000/groups/<group-id>/members -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"memberIds":["<member-id>"]}'
```
Expected: `{"added": 0}` (idempotent).

```bash
curl -s http://localhost:8000/groups/<group-id> -H "Authorization: Bearer $TOKEN"
```
Expected: `memberCount: 1`.

```bash
curl -s http://localhost:8000/groups/<group-id>/members -H "Authorization: Bearer $TOKEN"
```
Expected: the member's `MemberRead` (with `firstName`, `lastName`, etc.).

```bash
curl -s -X DELETE http://localhost:8000/groups/<group-id>/members -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"memberIds":["<member-id>"]}'
```
Expected: `{"removed": 1}`; a follow-up `GET /groups/<group-id>` shows `memberCount: 0`.

- [ ] **Step 3: Commit**

```bash
git add api/app/routers/groups.py
git commit -m "Add group membership endpoints"
```

---

### Task 4: Members API syncs group membership

**Files:**
- Modify: `api/app/schemas/member.py`
- Modify: `api/app/routers/members.py`

**Interfaces:**
- Consumes: `GroupMember` from `app.models.group`; `Group` from `app.models.group` (for validating ids)
- Produces: `MemberRead.group_ids: list[uuid.UUID]` (also camelCase `groupIds` to the frontend); `MemberCreate.group_ids` / `MemberUpdate.group_ids` accepted and synced
- Consumed by Task 5 (frontend types must match `groupIds`)

- [ ] **Step 1: Update `api/app/schemas/member.py`**

In `MemberCreate`, after `notes`:

```python
    notes: str | None = None
    group_ids: list[uuid.UUID] | None = None
```

In `MemberUpdate`, after `notes`:

```python
    notes: str | None = None
    group_ids: list[uuid.UUID] | None = None
```

In `MemberRead`, after `notes`:

```python
    notes: str | None
    group_ids: list[uuid.UUID] = []
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2: Update `api/app/routers/members.py`**

Extend the imports at the top:

```python
from sqlalchemy import delete, select

from app.models.group import Group, GroupMember
```

Add three helpers after `_email_taken`:

```python
def _sync_member_groups(
    db: Session, member_id: uuid.UUID, group_ids: list[uuid.UUID] | None
) -> None:
    if group_ids is None:
        return
    valid = set(
        db.scalars(select(Group.id).where(Group.id.in_(group_ids))).all()
    )
    existing = set(
        db.scalars(
            select(GroupMember.group_id).where(
                GroupMember.member_id == member_id
            )
        ).all()
    )
    for group_id in valid - existing:
        db.add(GroupMember(group_id=group_id, member_id=member_id))
    for group_id in existing - valid:
        db.execute(
            delete(GroupMember).where(
                GroupMember.member_id == member_id,
                GroupMember.group_id == group_id,
            )
        )


def _member_group_ids(db: Session, member_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        db.scalars(
            select(GroupMember.group_id).where(
                GroupMember.member_id == member_id
            )
        ).all()
    )


def _to_read(member: Member, group_ids: list[uuid.UUID]) -> MemberRead:
    return MemberRead(
        id=member.id,
        first_name=member.first_name,
        last_name=member.last_name,
        email=member.email,
        phone=member.phone,
        status=member.status,
        role=member.role,
        notes=member.notes,
        group_ids=group_ids,
        created_at=member.created_at,
        updated_at=member.updated_at,
    )
```

In `create_member`, after `db.refresh(member)` and before `return member`:

```python
    _sync_member_groups(db, member.id, payload.group_ids)
    db.commit()
    return _to_read(member, _member_group_ids(db, member.id))
```

In `update_member`, pop `group_ids` BEFORE the `setattr` loop (so it never gets set on the model), then sync before commit. Replace the current tail of `update_member`:

```python
    group_ids = data.pop("group_ids", None)

    for field, value in data.items():
        setattr(member, field, value)

    _sync_member_groups(db, member.id, group_ids)
    db.commit()
    db.refresh(member)
    return _to_read(member, _member_group_ids(db, member.id))
```

In `get_member`, change `return _get_member_or_404(db, member_id)` to:

```python
    member = _get_member_or_404(db, member_id)
    return _to_read(member, _member_group_ids(db, member.id))
```

In `list_members`, replace the return statement:

```python
    members = db.scalars(
        select(Member).order_by(
            Member.last_name.asc(), Member.first_name.asc()
        )
    ).all()
    by_member: dict[uuid.UUID, list[uuid.UUID]] = {}
    for row in db.execute(
        select(GroupMember.member_id, GroupMember.group_id)
    ).all():
        by_member.setdefault(row.member_id, []).append(row.group_id)
    return [_to_read(m, by_member.get(m.id, [])) for m in members]
```

(We return explicit `MemberRead` objects via `_to_read` everywhere instead of the bare ORM object, because `MemberRead` now carries `group_ids` which the `Member` model doesn't have.)

- [ ] **Step 3: Verify with curl**

Restart the API. Create a group, then create a member with `groupIds`:

```bash
curl -s -X POST http://localhost:8000/members -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"firstName":"Test","lastName":"Grouped","email":"test.grouped@example.com","groupIds":["<group-id>"]}'
```
Expected: `201`, body has `groupIds: ["<group-id>"]`.

```bash
curl -s http://localhost:8000/members -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:8000/groups/<group-id> -H "Authorization: Bearer $TOKEN"
```
Expected: the list shows `groupIds` on the new member; the group shows `memberCount: 1`.

```bash
curl -s -X PATCH http://localhost:8000/members/<member-id> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"groupIds":[]}'
```
Expected: `groupIds: []`; group `memberCount` drops to 0.

Clean up the test member: `curl -s -X DELETE http://localhost:8000/members/<member-id> -H "Authorization: Bearer $TOKEN"`.

- [ ] **Step 4: Commit**

```bash
git add api/app/schemas/member.py api/app/routers/members.py
git commit -m "Sync and expose member group membership"
```

---

### Task 5: Frontend types + API client for groups

**Files:**
- Create: `web/src/types/group.ts`
- Create: `web/src/lib/api/groups.ts`
- Modify: `web/src/types/member.ts`

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/api/client` (the existing bearer-token fetch wrapper)
- Produces (for Tasks 6–8): `Group` type, `CreateGroupInput`, and these functions with exact signatures:
  - `listGroups(): Promise<Group[]>`
  - `getGroup(groupId: string): Promise<Group>`
  - `createGroup(input: CreateGroupInput): Promise<Group>`
  - `updateGroup(groupId: string, patch: Partial<CreateGroupInput>): Promise<Group>`
  - `deleteGroup(groupId: string): Promise<Group>`
  - `bulkDeleteGroups(ids: string[]): Promise<{deleted: number}>`
  - `listGroupMembers(groupId: string): Promise<Member[]>`
  - `addGroupMembers(groupId: string, memberIds: string[]): Promise<{added: number}>`
  - `removeGroupMembers(groupId: string, memberIds: string[]): Promise<{removed: number}>`
- Produces: `Member.groupIds: string[]` and `CreateMemberInput.groupIds?: string[]`

- [ ] **Step 1: Create `web/src/types/group.ts`**

```ts
export interface Group {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
}
```

- [ ] **Step 2: Create `web/src/lib/api/groups.ts`**

```ts
import { apiFetch } from "@/lib/api/client";
import type { Member } from "@/types/member";
import type { CreateGroupInput, Group } from "@/types/group";

export function listGroups(): Promise<Group[]> {
  return apiFetch<Group[]>("/groups");
}

export function getGroup(groupId: string): Promise<Group> {
  return apiFetch<Group>(`/groups/${groupId}`);
}

export function createGroup(input: CreateGroupInput): Promise<Group> {
  return apiFetch<Group>("/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGroup(
  groupId: string,
  patch: Partial<CreateGroupInput>
): Promise<Group> {
  return apiFetch<Group>(`/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteGroup(groupId: string): Promise<Group> {
  return apiFetch<Group>(`/groups/${groupId}`, {
    method: "DELETE",
  });
}

export function bulkDeleteGroups(
  ids: string[]
): Promise<{deleted: number}> {
  return apiFetch<{deleted: number}>("/groups/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function listGroupMembers(groupId: string): Promise<Member[]> {
  return apiFetch<Member[]>(`/groups/${groupId}/members`);
}

export function addGroupMembers(
  groupId: string,
  memberIds: string[]
): Promise<{added: number}> {
  return apiFetch<{added: number}>(`/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ memberIds }),
  });
}

export function removeGroupMembers(
  groupId: string,
  memberIds: string[]
): Promise<{removed: number}> {
  return apiFetch<{removed: number}>(`/groups/${groupId}/members`, {
    method: "DELETE",
    body: JSON.stringify({ memberIds }),
  });
}
```

- [ ] **Step 3: Update `web/src/types/member.ts`**

In the `Member` interface, after `notes`:

```ts
  groupIds: string[];
```

In `CreateMemberInput`, after `notes`:

```ts
  groupIds?: string[];
```

- [ ] **Step 4: Verify lint + build**

Run (from `web/`):
```bash
npx eslint src/types/group.ts src/lib/api/groups.ts src/types/member.ts
npm run build
```
Expected: eslint clean; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/types/group.ts web/src/lib/api/groups.ts web/src/types/member.ts
git commit -m "Add frontend groups types and API client"
```

---

### Task 6: Groups list + create pages

**Files:**
- Create: `web/src/components/groups/GroupList.tsx`
- Create: `web/src/components/groups/GroupForm.tsx`
- Create: `web/src/components/groups/GroupCreate.tsx`
- Create: `web/src/app/(protected)/app/groups/page.tsx`
- Create: `web/src/app/(protected)/app/groups/new/page.tsx`

**Interfaces:**
- Consumes: `Group`, `CreateGroupInput` from `@/types/group`; `listGroups`, `createGroup`, `deleteGroup`, `bulkDeleteGroups` from `@/lib/api/groups`; `DataTable`, `PageHeader`, `Button`, `Card` (existing UI components)
- Produces: `GroupForm` with `onSubmit(values: CreateGroupInput)` + `onCancel()` (used by Task 7's `GroupEdit` too); route `/app/groups` (list) and `/app/groups/new` (create)

- [ ] **Step 1: Create `web/src/components/groups/GroupList.tsx`**

```tsx
"use client";

import Link from "next/link";

import { bulkDeleteGroups, deleteGroup, listGroups } from "@/lib/api/groups";
import type { Group } from "@/types/group";

import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { DataTableColumn } from "@/components/ui/DataTable";
import type { FilterColumn } from "@/components/ui/FilterMenu";

const COLUMNS: DataTableColumn<Group>[] = [
  {
    key: "name",
    label: "Name",
    render: (group) => (
      <Link
        href={`/app/groups/${group.id}`}
        className="font-medium text-[#102015] transition hover:text-[#012f11]"
      >
        {group.name}
      </Link>
    ),
  },
  {
    key: "description",
    label: "Description",
    render: (group) => group.description || "—",
  },
  {
    key: "memberCount",
    label: "Members",
    render: (group) => (
      <span className="font-medium text-stone-700">{group.memberCount}</span>
    ),
  },
];

const FILTER_COLUMNS: FilterColumn[] = [
  { key: "name", label: "Name", type: "entity" },
  { key: "description", label: "Description", type: "text" },
];

export function GroupList() {
  return (
    <DataTable
      columns={COLUMNS}
      filterColumns={FILTER_COLUMNS}
      fetchRows={listGroups}
      getRowId={(group) => group.id}
      defaultSort={{ key: "name", dir: "asc" }}
      countLabel={(count) => `${count} ${count === 1 ? "group" : "groups"}`}
      editHref={(group) => `/app/groups/${group.id}`}
      onDelete={async (group) => {
        await deleteGroup(group.id);
      }}
      onBulkDelete={async (ids) => {
        await bulkDeleteGroups(ids);
      }}
      deleteConfirmTitle={() => "Delete group?"}
      deleteConfirmDescription={(group) =>
        `"${group.name}" will be permanently deleted. Members are not deleted — only their membership in this group.`
      }
      errorMessage="Could not load groups."
      emptyTitle="No groups yet"
      emptyDescription="Create groups like Men's Ministry or Women's Ministry to organize your members."
      emptyAction={
        <Link href="/app/groups/new">
          <Button>Add Group</Button>
        </Link>
      }
    />
  );
}
```

- [ ] **Step 2: Create `web/src/components/groups/GroupForm.tsx`**

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CreateGroupInput, Group } from "@/types/group";

interface GroupFormProps {
  group?: Group | null;
  onCancel: () => void;
  onSubmit: (values: CreateGroupInput) => Promise<void>;
}

const inputClass =
  "w-full rounded-xl border border-[#ddd8c8] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#012f11]";

export function GroupForm({ group, onCancel, onSubmit }: GroupFormProps) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-[#102015]">
        {group ? "Edit group" : "Add group"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div>
          <label
            htmlFor="groupName"
            className="mb-1 block text-sm font-medium text-stone-800"
          >
            Name
          </label>
          <input
            id="groupName"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Men's Ministry"
          />
        </div>

        <div>
          <label
            htmlFor="groupDescription"
            className="mb-1 block text-sm font-medium text-stone-800"
          >
            Description <span className="text-stone-400">(optional)</span>
          </label>
          <textarea
            id="groupDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y leading-6`}
            placeholder="Who is this group for?"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : group ? "Save changes" : "Add group"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Create `web/src/components/groups/GroupCreate.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { createGroup } from "@/lib/api/groups";
import type { CreateGroupInput } from "@/types/group";

import { GroupForm } from "@/components/groups/GroupForm";

export function GroupCreate() {
  const router = useRouter();

  async function handleSubmit(values: CreateGroupInput) {
    await createGroup(values);
    router.push("/app/groups");
    router.refresh();
  }

  function handleCancel() {
    router.push("/app/groups");
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#012f11]"
        >
          <span aria-hidden="true">←</span>
          Back to groups
        </Link>
      </div>

      <GroupForm onCancel={handleCancel} onSubmit={handleSubmit} />
    </div>
  );
}
```

- [ ] **Step 4: Create `web/src/app/(protected)/app/groups/page.tsx`**

```tsx
import Link from "next/link";

import { GroupList } from "@/components/groups/GroupList";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function GroupsPage() {
  return (
    <>
      <PageHeader
        title="Groups"
        action={
          <Link href="/app/groups/new">
            <Button>Add Group</Button>
          </Link>
        }
      />

      <GroupList />
    </>
  );
}
```

- [ ] **Step 5: Create `web/src/app/(protected)/app/groups/new/page.tsx`**

```tsx
import { GroupCreate } from "@/components/groups/GroupCreate";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewGroupPage() {
  return (
    <>
      <PageHeader title="Add a group" />
      <GroupCreate />
    </>
  );
}
```

- [ ] **Step 6: Verify lint + build**

Run (from `web/`):
```bash
npx eslint src/components/groups/ "src/app/(protected)/app/groups/"
npm run build
```
Expected: eslint clean; build succeeds (the `/app/groups` route no longer 404s).

- [ ] **Step 7: Verify in the browser**

Frontend dev server on port 3000 (`cd web && npm run dev`). Navigate to `http://localhost:3000/app/groups`:
- Header shows "Groups" + **Add Group** button (top right), count "0 groups" top-left
- Click **Add Group** → form at `/app/groups/new` → fill name "Women's Ministry" → **Add group** → redirects to list showing "1 group" with the row
- Filter sidebar works (filter by Name), delete/trash row action + confirm dialog work, bulk select + trashcan works

- [ ] **Step 8: Commit**

```bash
git add web/src/components/groups/ "web/src/app/(protected)/app/groups/"
git commit -m "Add groups list and create pages"
```

---

### Task 7: Group detail page — edit group + manage members

**Files:**
- Create: `web/src/components/groups/GroupEdit.tsx`
- Create: `web/src/app/(protected)/app/groups/[groupId]/page.tsx`

**Interfaces:**
- Consumes: `getGroup`, `updateGroup`, `listGroupMembers`, `addGroupMembers`, `removeGroupMembers` from `@/lib/api/groups`; `listMembers` from `@/lib/api/members`; `GroupForm` (from Task 6); `DataTable` (for the members-in-group list); `ConfirmDialog` (for remove confirmation)
- Produces: route `/app/groups/[groupId]` — a two-section page: group name/description form + "Members in this group" management (add via dropdown, remove via trash + confirm)
- Consumed by nothing further; it is the member-management surface for groups

- [ ] **Step 1: Create `web/src/components/groups/GroupEdit.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  addGroupMembers,
  getGroup,
  listGroupMembers,
  removeGroupMembers,
  updateGroup,
} from "@/lib/api/groups";
import { listMembers } from "@/lib/api/members";
import type { CreateGroupInput, Group } from "@/types/group";
import type { Member } from "@/types/member";

import { GroupForm } from "@/components/groups/GroupForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import type { DataTableColumn } from "@/components/ui/DataTable";
import type { FilterColumn } from "@/components/ui/FilterMenu";

function apiErrorToMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401)
    return "Your session has expired. Please log out and in again.";
  if (err instanceof Error) return err.message;
  return "Could not load this group.";
}

const COLUMNS: DataTableColumn<Member>[] = [
  {
    key: "firstName",
    label: "First",
    render: (member) => (
      <span className="font-medium text-[#102015]">
        {member.firstName}
      </span>
    ),
  },
  {
    key: "lastName",
    label: "Last",
    render: (member) => (
      <span className="font-medium text-[#102015]">{member.lastName}</span>
    ),
  },
  {
    key: "email",
    label: "Email",
    render: (member) => member.email,
  },
  {
    key: "role",
    label: "Role",
    render: (member) => (
      <Badge variant="neutral">
        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
      </Badge>
    ),
  },
];

const FILTER_COLUMNS: FilterColumn[] = [
  { key: "firstName", label: "First", type: "entity" },
  { key: "lastName", label: "Last", type: "entity" },
  { key: "email", label: "Email", type: "entity" },
];

interface GroupEditProps {
  groupId: string;
}

export function GroupEdit({ groupId }: GroupEditProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState("");
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGroup(groupId), listMembers()])
      .then(([g, members]) => {
        if (!cancelled) {
          setGroup(g);
          setAllMembers(members);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiErrorToMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  async function handleFormSubmit(values: CreateGroupInput) {
    const updated = await updateGroup(groupId, values);
    setGroup(updated);
    setAddMessage("Group details saved.");
  }

  function handleCancel() {
    router.push("/app/groups");
  }

  async function handleAddMember() {
    if (!selectedMemberId) return;
    setAdding(true);
    setAddMessage("");
    try {
      await addGroupMembers(groupId, [selectedMemberId]);
      setSelectedMemberId("");
      setAddMessage("Member added to group.");
      setReloadSignal((s) => s + 1);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(member: Member) {
    await removeGroupMembers(groupId, [member.id]);
    setPendingRemove(null);
    setAddMessage("Member removed from group.");
    setReloadSignal((s) => s + 1);
  }

  if (error) {
    return (
      <div className="space-y-6 py-10">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#012f11]"
        >
          <span aria-hidden="true">←</span>
          Back to groups
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-[#102015]">
            Unable to load this group
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">{error}</p>
        </div>
      </div>
    );
  }

  if (group === null) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-stone-500">
          Loading group…
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#012f11]"
        >
          <span aria-hidden="true">←</span>
          Back to groups
        </Link>
      </div>

      <GroupForm group={group} onCancel={handleCancel} onSubmit={handleFormSubmit} />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#102015]">
              Members in this group
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-56 rounded-xl border border-[#ddd8c8] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#012f11]"
              aria-label="Add member"
            >
              <option value="">Add a member…</option>
              {allMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <Button
              type="button"
              onClick={handleAddMember}
              disabled={!selectedMemberId || adding}
            >
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>

        {addMessage ? (
          <p className="mt-3 text-sm font-medium text-green-800">
            {addMessage}
          </p>
        ) : null}

        <div className="mt-5">
          <DataTable
            columns={COLUMNS}
            filterColumns={FILTER_COLUMNS}
            fetchRows={() => listGroupMembers(groupId)}
            getRowId={(member) => member.id}
            defaultSort={{ key: "lastName", dir: "asc" }}
            countLabel={(count) =>
              `${count} ${count === 1 ? "member" : "members"}`
            }
            onDelete={(member) => setPendingRemove(member)}
            deleteConfirmTitle={() => "Remove from group?"}
            deleteConfirmDescription={(member) =>
              `${member.firstName} ${member.lastName} will be removed from this group. They are not deleted from your member directory.`
            }
            errorMessage="Could not load group members."
            emptyTitle="No members in this group"
            emptyDescription="Use the dropdown above to add members to this group."
            reloadSignal={reloadSignal}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove from group?"
        description={
          pendingRemove
            ? `${pendingRemove.firstName} ${pendingRemove.lastName} will be removed from this group. They are not deleted from your member directory.`
            : ""
        }
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) handleRemoveMember(pendingRemove);
        }}
      />
    </div>
  );
}
```

> **Note on the members-in-group list:** the add-member dropdown lists ALL members — intentional, because a member can be in multiple groups. The inner DataTable shows the live member count via its own `countLabel` (refetched on `reloadSignal` after add/remove), so the header keeps only the section title — no stale duplicate count.

- [ ] **Step 2: Create `web/src/app/(protected)/app/groups/[groupId]/page.tsx`**

```tsx
import { GroupEdit } from "@/components/groups/GroupEdit";

interface GroupPageProps {
  params: Promise<{
    groupId: string;
  }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { groupId } = await params;
  return <GroupEdit groupId={groupId} />;
}
```

- [ ] **Step 3: Verify lint + build**

Run (from `web/`):
```bash
npx eslint src/components/groups/ "src/app/(protected)/app/groups/"
npm run build
```
Expected: eslint clean; build succeeds.

- [ ] **Step 4: Verify in the browser**

With a group created (Task 6) and members present (the directory has at least Randy Meneses):
- Open the group from `/app/groups` → detail page shows the GroupForm (edit name/description → Save changes → "Group details saved.") and the members section
- Add a member via the dropdown → row appears, count updates, "Member added to group." shows
- Remove via trash icon → ConfirmDialog → member gone from the list, count updates
- Back on `/app/groups`, the row's Members column reflects the new count

- [ ] **Step 5: Commit**

```bash
git add web/src/components/groups/GroupEdit.tsx "web/src/app/(protected)/app/groups/[groupId]/page.tsx"
git commit -m "Add group detail page with member management"
```

---

### Task 8: Member form — groups multi-select

**Files:**
- Modify: `web/src/components/members/MemberForm.tsx`

**Interfaces:**
- Consumes: `listGroups` from `@/lib/api/groups`; `Member.groupIds` / `CreateMemberInput.groupIds` (from Task 5); `MemberForm`'s existing props (`member?`, `onCancel`, `onSubmit`)
- Produces: `MemberForm` submits `groupIds: string[]` in its `onSubmit` payload; `MemberCreate` and `MemberEdit` pass it through unchanged to `createMember` / `updateMember` (their payload types already accept it — no changes needed in those files)
- Consumed by: nothing further

- [ ] **Step 1: Update `MemberForm.tsx`**

Add to the imports:

```tsx
import { useEffect, useState } from "react";

import { listGroups } from "@/lib/api/groups";
import type { Group } from "@/types/group";
```

(Replace the existing `import { useState } from "react";` line with the combined import above.)

Add state + effect inside the component, right after the existing `const [notes, setNotes] = useState(member?.notes ?? "");` line:

```tsx
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    member?.groupIds ?? []
  );

  useEffect(() => {
    let cancelled = false;
    listGroups()
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch(() => {
        // Groups are optional; a failed fetch just hides the picker.
      });
    return () => {
      cancelled = true;
    };
  }, []);
```

Add a `toggleGroup` helper after the state declarations:

```tsx
  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }
```

Update the `onSubmit` payload in `handleSubmit` — add `groupIds: selectedGroupIds,` after `notes`:

```tsx
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        status,
        role,
        notes: notes.trim() || undefined,
        groupIds: selectedGroupIds,
      });
```

Add the groups picker JSX right after the Notes textarea block and before the submit button row:

```tsx
        {groups.length > 0 ? (
          <div>
            <span className="mb-1 block text-sm font-medium text-stone-800">
              Groups <span className="text-stone-400">(optional)</span>
            </span>
            <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-[#ddd8c8] bg-white p-2 sm:grid-cols-2">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-700 transition hover:bg-stone-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                    className="h-4 w-4 rounded border-stone-300 text-[#012f11] focus:ring-[#012f11]"
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}
```

- [ ] **Step 2: Verify lint + build**

Run (from `web/`):
```bash
npx eslint src/components/members/MemberForm.tsx
npm run build
```
Expected: eslint clean; build succeeds.

- [ ] **Step 3: Verify in the browser**

- `/app/members/new` → the Groups picker appears (checkboxes for each group) → create a member with "Men's Ministry" checked → redirects to list
- Open the new member's edit page → the picker shows "Men's Ministry" pre-checked (proves `getMember` → `groupIds` round-trip)
- `/app/groups` → the group's Members count incremented; open the group → the new member is in the list
- Uncheck the group on the member edit page → Save → group no longer contains the member

- [ ] **Step 4: Commit**

```bash
git add web/src/components/members/MemberForm.tsx
git commit -m "Let member form assign groups"
```

---

### Task 9: Docs + full end-to-end verification

**Files:**
- Modify: `docs/agent/02_CURRENT_STATE.md`
- Modify: `docs/agent/04_ROADMAP.md`

**Interfaces:**
- Consumes: everything from Tasks 1–8
- Produces: accurate project docs; a green end-to-end pass

- [ ] **Step 1: Update `docs/agent/02_CURRENT_STATE.md`**

- Add `/app/groups`, `/app/groups/new`, `/app/groups/[groupId]` to the Protected Routes list; remove `/app/groups` from the "empty directories, visiting them 404s" list.
- Add a **Groups** subsection to the frontend notes: shared `DataTable` list (Name / Description / Members columns, filters, bulk delete), route-based create/edit, group detail page with member add/remove, `MemberForm` groups multi-select.
- In the Backend section, add the `/groups` endpoints to the endpoint list and mention migration `0007_create_groups` + `group_members` in the migrations line. Note `MemberRead` now includes `groupIds`.
- Update the "Still Mocked" section: remove nothing about groups (groups were never listed), but note that campaigns/email sending remain future work that will target groups.

- [ ] **Step 2: Update `docs/agent/04_ROADMAP.md`**

Under Phase 9 (Recipients and Groups), replace the one-liner with:

```txt
Status: groups complete (2026-08-12); email campaigns pending.

- groups + group_members tables (migration 0007)
- /groups CRUD + membership endpoints; MemberRead carries groupIds
- groups list/create/detail pages; member form group multi-select
- campaign/send engine (recipients resolved from a group, a
  campaign-with-group, or explicit member ids) is the next slice
```

- [ ] **Step 3: Full verification pass**

Backend (from `api/`):
```bash
.venv/bin/alembic upgrade head
.venv/bin/python -c "from app.main import app; print('ok')"
```
Restart uvicorn. Then smoke-test the happy path with curl (create group → add member → list group members → remove → delete).

Frontend (from `web/`):
```bash
npm run lint
npm run build
```
Expected: both clean.

Browser walkthrough (port 3000):
1. `/app/groups` — list renders, count, filters, Add Group
2. Create "Men's Ministry", then "Women's Ministry"
3. Open a group → add Randy Meneses; also create a new member with the group assigned via the form (both directions)
4. Confirm counts reflect on the list page and on the group page
5. Bulk-select two groups → trashcan → confirm → both gone (cascade removes memberships; members still in directory)

DB sanity (optional):
```bash
docker exec after-sunday-db psql -U after_sunday -d after_sunday -c "SELECT g.name, count(gm.member_id) FROM groups g LEFT JOIN group_members gm ON gm.group_id = g.id GROUP BY g.id, g.name ORDER BY g.name;"
```

- [ ] **Step 4: Commit**

```bash
git add docs/agent/02_CURRENT_STATE.md docs/agent/04_ROADMAP.md
git commit -m "Document groups feature and update roadmap"
```

---

## Future (explicitly out of scope — do NOT build in this plan)

- **Email campaigns/sending.** A future `campaigns` table (title, optional `group_id` FK) + `campaign_recipients` (member_id, status, sent_at, error) can resolve recipients three ways the user described: (1) send to a group → `SELECT member_id FROM group_members WHERE group_id = :g`; (2) send to a campaign that has a group → same query; (3) send to a single recipient → one member_id. This plan's `group_members` table is that resolution primitive.
- Groups permissions/roles, group hierarchies, church workspaces (Phase 11).
- Showing a Groups column in the members list table (deliberately omitted to keep the list clean; can be added later by including group names in `MemberRead`).
