import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, DateTime, Date, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Sermon(Base):
    __tablename__ = "sermons"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    # Tenant/ownership columns modeled up front (per 03_ARCHITECTURE.md).
    church_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    preacher: Mapped[str | None] = mapped_column(String(200), nullable=True)
    scripture_reference: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    preached_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_file_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    media_storage_key: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    media_size_bytes: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    media_content_type: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="not_started",
        server_default="not_started",
    )
    transcript_error: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    follow_up_subject: Mapped[str | None] = mapped_column(
        String(300), nullable=True
    )
    follow_up_body: Mapped[str | None] = mapped_column(Text, nullable=True)

    ai_draft_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="not_started",
        server_default="not_started",
    )
    email_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="not_started",
        server_default="not_started",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index("ix_sermons_church_created", "church_id", "created_at"),
    )
