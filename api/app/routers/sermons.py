import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user_uuid
from app.db import get_db
from app.models.sermon import Sermon
from app.schemas.sermon import SermonCreate, SermonRead, SermonUpdate, TranscriptUpdate

router = APIRouter(prefix="/sermons", tags=["sermons"])


def _get_owned_sermon(
    db: Session, sermon_id: uuid.UUID, user_id: uuid.UUID
) -> Sermon:
    sermon = db.get(Sermon, sermon_id)
    if sermon is None or sermon.created_by_user_id != user_id:
        raise HTTPException(status_code=404, detail="Sermon not found")
    return sermon


@router.post("", response_model=SermonRead, status_code=201)
def create_sermon(
    payload: SermonCreate,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_uuid),
):
    sermon = Sermon(
        created_by_user_id=user_id,
        title=payload.title,
        preacher=payload.preacher,
        scripture_reference=payload.scripture_reference,
        preached_at=payload.preached_at,
        source_type=payload.source_type,
        source_url=payload.youtube_url if payload.source_type == "youtube" else None,
        transcript=payload.transcript,
        transcript_status=(
            "ready" if payload.transcript and payload.transcript.strip() else "not_started"
        ),
    )
    db.add(sermon)
    db.commit()
    db.refresh(sermon)
    return sermon


@router.get("", response_model=list[SermonRead])
def list_sermons(
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_uuid),
):
    return db.scalars(
        select(Sermon)
        .where(Sermon.created_by_user_id == user_id)
        .order_by(Sermon.created_at.desc())
    ).all()


@router.get("/{sermon_id}", response_model=SermonRead)
def get_sermon(
    sermon_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_uuid),
):
    return _get_owned_sermon(db, sermon_id, user_id)


@router.patch("/{sermon_id}", response_model=SermonRead)
def update_sermon(
    sermon_id: uuid.UUID,
    payload: SermonUpdate,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_uuid),
):
    sermon = _get_owned_sermon(db, sermon_id, user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sermon, field, value)
    db.commit()
    db.refresh(sermon)
    return sermon


@router.patch("/{sermon_id}/transcript", response_model=SermonRead)
def update_transcript(
    sermon_id: uuid.UUID,
    payload: TranscriptUpdate,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_uuid),
):
    sermon = _get_owned_sermon(db, sermon_id, user_id)
    sermon.transcript = payload.transcript
    if payload.transcript.strip():
        sermon.transcript_status = "ready"
    db.commit()
    db.refresh(sermon)
    return sermon
