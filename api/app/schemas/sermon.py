import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.aliases import to_camel

SermonSourceType = Literal["upload", "youtube", "transcript"]
TranscriptionStatus = Literal[
    "not_started", "awaiting_upload", "queued", "processing", "ready", "failed"
]
AiDraftStatus = Literal["not_started", "generating", "draft_ready", "approved"]
EmailStatus = Literal["not_started", "draft", "ready", "sent"]


class SermonCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: str = Field(min_length=1, max_length=300)
    preacher: str | None = Field(default=None, max_length=200)
    scripture_reference: str | None = Field(default=None, max_length=200)
    preached_at: date | None = None
    source_type: SermonSourceType
    youtube_url: str | None = None
    transcript: str | None = None


class SermonUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=300)
    preacher: str | None = Field(default=None, max_length=200)
    scripture_reference: str | None = Field(default=None, max_length=200)
    preached_at: date | None = None
    source_type: SermonSourceType | None = None
    source_url: str | None = None
    media_file_name: str | None = None
    media_storage_key: str | None = None
    media_size_bytes: int | None = None
    media_content_type: str | None = None
    transcript: str | None = None
    transcript_status: TranscriptionStatus | None = None
    follow_up_subject: str | None = Field(default=None, max_length=300)
    follow_up_body: str | None = None
    ai_draft_status: AiDraftStatus | None = None
    email_status: EmailStatus | None = None


class TranscriptUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    transcript: str


class SermonRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: uuid.UUID
    title: str
    preacher: str | None
    scripture_reference: str | None
    preached_at: date | None
    source_type: str
    source_url: str | None
    media_file_name: str | None
    media_storage_key: str | None
    media_size_bytes: int | None
    media_content_type: str | None
    transcript: str | None
    transcript_status: str
    transcript_error: str | None
    follow_up_subject: str | None
    follow_up_body: str | None
    ai_draft_status: str
    email_status: str
    created_at: datetime
    updated_at: datetime
