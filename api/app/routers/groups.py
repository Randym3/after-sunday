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
