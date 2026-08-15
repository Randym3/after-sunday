import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user_uuid
from app.db import get_db
from app.models.member import Member
from app.models.sermon import Sermon
from app.models.transcription_job import TranscriptionJob
from app.schemas.sermon import (
    BulkDeleteRequest,
    SermonCreate,
    SermonRead,
    SermonUpdate,
    TestEmailRequest,
    TranscriptUpdate,
)
from app.services.branding import get_logo_data_uri, get_organization_name
from app.services.email import resolve_email_config, send_test_email
from app.services.follow_up import build_follow_up_provider
from app.services.transcription import build_provider
from app.storage import get_storage

router = APIRouter(prefix="/sermons", tags=["sermons"])


def _get_sermon_or_404(db: Session, sermon_id: uuid.UUID) -> Sermon:
    sermon = db.get(Sermon, sermon_id)
    if sermon is None:
        raise HTTPException(status_code=404, detail="Sermon not found")
    return sermon


@router.post("", response_model=SermonRead, status_code=201)
def create_sermon(
    payload: SermonCreate,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_uuid),
):
    # Determine initial transcript status.
    if payload.transcript and payload.transcript.strip():
        initial_status = "ready"
    elif payload.source_type == "upload":
        initial_status = "awaiting_upload"
    else:
        initial_status = "not_started"

    sermon = Sermon(
        created_by_user_id=user_id,
        title=payload.title,
        preacher=payload.preacher,
        scripture_reference=payload.scripture_reference,
        preached_at=payload.preached_at,
        source_type=payload.source_type,
        source_url=payload.youtube_url if payload.source_type == "youtube" else None,
        transcript=payload.transcript,
        transcript_status=initial_status,
    )
    db.add(sermon)
    db.commit()
    db.refresh(sermon)
    return sermon


@router.get("", response_model=list[SermonRead])
def list_sermons(
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    return db.scalars(
        select(Sermon).order_by(Sermon.created_at.desc())
    ).all()


@router.get("/{sermon_id}", response_model=SermonRead)
def get_sermon(
    sermon_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    return _get_sermon_or_404(db, sermon_id)


@router.patch("/{sermon_id}", response_model=SermonRead)
def update_sermon(
    sermon_id: uuid.UUID,
    payload: SermonUpdate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    sermon = _get_sermon_or_404(db, sermon_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sermon, field, value)
    db.commit()
    db.refresh(sermon)
    return sermon


@router.post("/{sermon_id}/follow-up/generate", response_model=SermonRead)
async def generate_follow_up(
    sermon_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    """Generate an AI follow-up draft from the reviewed transcript.

    Requires a ready transcript. Persists the draft on the sermon row with
    ai_draft_status='draft_ready' so it survives reloads and can be edited,
    saved, and approved via the regular PATCH endpoint.
    """
    sermon = _get_sermon_or_404(db, sermon_id)

    if (
        sermon.transcript_status != "ready"
        or not sermon.transcript
        or not sermon.transcript.strip()
    ):
        raise HTTPException(
            status_code=409,
            detail="A reviewed transcript is required before generating a follow-up draft.",
        )

    provider = build_follow_up_provider()
    try:
        draft = await provider.generate(
            title=sermon.title,
            preacher=sermon.preacher,
            scripture_reference=sermon.scripture_reference,
            transcript=sermon.transcript,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Follow-up generation failed: {exc}",
        ) from exc

    sermon.follow_up_subject = draft["subject"]
    sermon.follow_up_body = draft["body"]
    sermon.ai_draft_status = "draft_ready"
    sermon.ai_provider = provider.provider_name
    sermon.ai_model = provider.model_name
    sermon.email_status = "draft"
    db.commit()
    db.refresh(sermon)
    return sermon


@router.post("/{sermon_id}/test-email")
def send_sermon_test_email(
    sermon_id: uuid.UUID,
    payload: TestEmailRequest,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
) -> dict:
    """Send the current sermon draft to one test recipient.

    Test sends intentionally do not require approval: they let staff inspect
    the exact draft before deciding whether to approve it for a campaign.
    """
    sermon = _get_sermon_or_404(db, sermon_id)
    subject = (sermon.follow_up_subject or "").strip()
    body = (sermon.follow_up_body or "").strip()

    if not subject or not body:
        raise HTTPException(
            status_code=409,
            detail="A follow-up email draft is required before sending a test email.",
        )

    recipient_email = payload.email
    recipient_name = "member"

    if payload.member_id is not None:
        member = db.get(Member, payload.member_id)
        if member is None:
            raise HTTPException(status_code=404, detail="Member not found")
        recipient_email = member.email
        recipient_name = member.first_name or "member"

    if not recipient_email:
        raise HTTPException(status_code=422, detail="A test recipient is required.")

    personalized_body = body.replace("{{ firstName }}", recipient_name)

    api_key, email_from, _source = resolve_email_config(db)
    if not api_key or not email_from:
        raise HTTPException(
            status_code=503,
            detail=(
                "Email sending is not configured. Add a Resend API key and "
                "sender address in Settings, or set RESEND_API_KEY and "
                "EMAIL_FROM in api/.env."
            ),
        )

    try:
        send_test_email(
            to=recipient_email,
            subject=subject,
            body=personalized_body,
            api_key=api_key,
            from_email=email_from,
            organization_name=get_organization_name(db),
            logo_data_uri=get_logo_data_uri(db),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Test email could not be sent: {exc}",
        ) from exc

    return {"message": "Test email sent.", "email": recipient_email}


@router.patch("/{sermon_id}/transcript", response_model=SermonRead)
def update_transcript(
    sermon_id: uuid.UUID,
    payload: TranscriptUpdate,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    sermon = _get_sermon_or_404(db, sermon_id)
    sermon.transcript = payload.transcript
    if payload.transcript.strip():
        sermon.transcript_status = "ready"
    db.commit()
    db.refresh(sermon)
    return sermon


@router.post("/{sermon_id}/transcribe", response_model=SermonRead)
def transcribe_sermon(
    sermon_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    """Re-queue transcription for a sermon that already has a recording."""
    sermon = _get_sermon_or_404(db, sermon_id)

    if not sermon.media_storage_key:
        raise HTTPException(
            status_code=400,
            detail="This sermon has no recording to transcribe.",
        )

    provider = build_provider()

    sermon.transcript = None
    sermon.transcript_error = None
    sermon.transcript_status = "queued"

    # Re-transcribing replaces the source transcript, so any follow-up draft
    # derived from the old transcript is no longer valid.
    sermon.follow_up_subject = None
    sermon.follow_up_body = None
    sermon.ai_draft_status = "not_started"
    sermon.email_status = "not_started"

    job = db.scalars(
        select(TranscriptionJob).where(
            TranscriptionJob.sermon_id == sermon.id
        )
    ).first()
    if job is None:
        job = TranscriptionJob(
            id=sermon.id,
            sermon_id=sermon.id,
            provider=provider.provider_name,
            status="queued",
        )
        db.add(job)
    else:
        job.provider = provider.provider_name
        job.status = "queued"
        job.result_text = None
        job.error_message = None
        job.started_at = None
        job.completed_at = None

    db.commit()
    db.refresh(sermon)
    return sermon


@router.delete("/{sermon_id}", response_model=SermonRead)
def delete_sermon(
    sermon_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    sermon = _get_sermon_or_404(db, sermon_id)
    db.delete(sermon)
    db.commit()
    # Also remove the uploaded media if present.
    if sermon.media_storage_key:
        get_storage().delete(sermon.media_storage_key)
    return sermon


@router.post("/bulk-delete", response_model=dict)
def bulk_delete_sermons(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
):
    sermons = db.scalars(
        select(Sermon).where(Sermon.id.in_(payload.ids))
    ).all()
    for sermon in sermons:
        if sermon.media_storage_key:
            get_storage().delete(sermon.media_storage_key)
        db.delete(sermon)
    db.commit()
    return {"deleted": len(sermons)}


# ── media upload (chunked) ────────────────────────────────────────────────

MAX_FILE_SIZE = 2_147_483_648  # 2 GB


def _is_supported_media_type(content_type: str | None) -> bool:
    """Accept any audio/video type, plus unknowns.

    Browsers often report 'application/octet-stream' (or nothing) for
    dragged-in files, so be permissive here — the actual media validation
    happens at transcription time, not upload time.
    """
    if not content_type:
        return True
    ct = content_type.lower().split(";")[0].strip()
    if ct in {"application/octet-stream", "application/mp4"}:
        return True
    return ct.startswith("audio/") or ct.startswith("video/")


@router.post("/{sermon_id}/upload/init")
def upload_init(
    sermon_id: uuid.UUID,
    file_name: str = Form(...),
    file_size: int = Form(...),
    content_type: str = Form(""),
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
) -> dict:
    """Create the storage record and return an upload ID."""
    sermon = _get_sermon_or_404(db, sermon_id)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({file_size} bytes). Maximum is {MAX_FILE_SIZE} bytes.",
        )

    if not _is_supported_media_type(content_type):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {content_type or 'unknown'}",
        )

    # Reuse an in-progress upload for the same file so retries and double
    # inits don't orphan the previous key — chunks simply overwrite at their
    # byte offset. A different file gets a fresh key.
    if (
        sermon.media_storage_key
        and sermon.media_file_name == file_name
        and sermon.media_size_bytes == file_size
    ):
        storage_key = sermon.media_storage_key
    else:
        storage_key = f"{sermon_id}/{uuid.uuid4().hex}"

    sermon.media_file_name = file_name
    sermon.media_storage_key = storage_key
    sermon.media_content_type = content_type or None
    sermon.media_size_bytes = file_size
    sermon.transcript_status = "awaiting_upload"
    db.commit()

    return {
        "storageKey": storage_key,
        "chunkSize": 8 * 1024 * 1024,  # 8 MB
    }


@router.post("/{sermon_id}/upload/chunk")
async def upload_chunk(
    sermon_id: uuid.UUID,
    file: UploadFile = File(...),
    chunk_index: int = Form(...),
    storage_key: str = Form(...),
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
) -> dict:
    """Write one chunk to storage. Client sends the raw chunk as the file."""
    sermon = _get_sermon_or_404(db, sermon_id)

    if sermon.media_storage_key != storage_key:
        raise HTTPException(status_code=400, detail="Storage key mismatch")

    # No content-type check here: the chunk is a raw byte slice of a file
    # already validated at init, and browser blob parts often report
    # application/octet-stream regardless of the real type.
    chunk_data = await file.read()

    if len(chunk_data) == 0:
        raise HTTPException(status_code=400, detail="Empty chunk")

    offset = chunk_index * 8 * 1024 * 1024  # 8 MB chunks
    get_storage().write_chunk(storage_key, chunk_data, offset)

    return {"chunkIndex": chunk_index, "size": len(chunk_data)}


@router.post("/{sermon_id}/upload/complete")
def upload_complete(
    sermon_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
) -> SermonRead:
    """Mark the upload as done and queue transcription."""
    sermon = _get_sermon_or_404(db, sermon_id)

    if not sermon.media_storage_key:
        raise HTTPException(
            status_code=400,
            detail="No upload in progress for this sermon.",
        )

    sermon.transcript_status = "queued"

    # Create a transcription job so the background worker picks it up.
    existing_job = db.get(TranscriptionJob, sermon.id)
    if existing_job is None:
        job = TranscriptionJob(
            id=sermon.id,
            sermon_id=sermon.id,
            provider=build_provider().provider_name,
            status="queued",
        )
        db.add(job)

    db.commit()
    db.refresh(sermon)
    return sermon


@router.get("/{sermon_id}/media")
def serve_media(
    sermon_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: uuid.UUID = Depends(get_current_user_uuid),
) -> FileResponse:
    """Serve the uploaded sermon media file (dev — local disk)."""
    sermon = _get_sermon_or_404(db, sermon_id)

    if not sermon.media_storage_key:
        raise HTTPException(status_code=404, detail="No media file for this sermon")

    path = get_storage().retrieve(sermon.media_storage_key)

    if path is None:
        raise HTTPException(status_code=404, detail="Media file not found on disk")

    return FileResponse(
        str(path),
        media_type=sermon.media_content_type or "application/octet-stream",
        filename=sermon.media_file_name or "recording",
    )
