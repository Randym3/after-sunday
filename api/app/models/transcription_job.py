from datetime import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TranscriptionJob(Base):
    __tablename__ = "transcription_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    sermon_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("sermons.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )

    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, default="mock", server_default="mock",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="queued", server_default="queued",
    )

    result_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_transcription_jobs_status", "status"),
    )
