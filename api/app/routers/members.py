import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user_uuid
from app.db import get_db
from app.models.member import Member
from app.schemas.member import BulkDeleteRequest, MemberCreate, MemberRead, MemberUpdate

router = APIRouter(prefix="/members", tags=["members"])


def _get_member_or_404(db: Session, member_id: uuid.UUID) -> Member:
    member = db.get(Member, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


def _email_taken(
    db: Session, email: str, exclude_id: uuid.UUID | None = None
) -> bool:
    query = select(Member).where(Member.email == email)
    if exclude_id is not None:
        query = query.where(Member.id != exclude_id)
    return db.scalar(query) is not None


@router.post("", response_model=MemberRead, status_code=201)
def create_member(
    payload: MemberCreate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    email = payload.email.strip().lower()

    if _email_taken(db, email):
        raise HTTPException(
            status_code=409, detail="A member with this email already exists."
        )

    member = Member(
        created_by_user_id=_user,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email,
        phone=payload.phone.strip() if payload.phone else None,
        status=payload.status,
        role=payload.role,
        notes=payload.notes,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("", response_model=list[MemberRead])
def list_members(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    return db.scalars(
        select(Member).order_by(
            Member.last_name.asc(), Member.first_name.asc()
        )
    ).all()


@router.get("/{member_id}", response_model=MemberRead)
def get_member(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    return _get_member_or_404(db, member_id)


@router.patch("/{member_id}", response_model=MemberRead)
def update_member(
    member_id: uuid.UUID,
    payload: MemberUpdate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    member = _get_member_or_404(db, member_id)
    data = payload.model_dump(exclude_unset=True)

    if data.get("email") is not None:
        data["email"] = data["email"].strip().lower()
        if _email_taken(db, data["email"], exclude_id=member_id):
            raise HTTPException(
                status_code=409,
                detail="A member with this email already exists.",
            )

    for field in ("first_name", "last_name"):
        if data.get(field) is not None:
            data[field] = data[field].strip()

    if data.get("phone") is not None:
        data["phone"] = data["phone"].strip()

    for field, value in data.items():
        setattr(member, field, value)

    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", response_model=MemberRead)
def delete_member(
    member_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    member = _get_member_or_404(db, member_id)
    db.delete(member)
    db.commit()
    return member


@router.post("/bulk-delete", response_model=dict)
def bulk_delete_members(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    members = db.scalars(
        select(Member).where(Member.id.in_(payload.ids))
    ).all()
    for member in members:
        db.delete(member)
    db.commit()
    return {"deleted": len(members)}
