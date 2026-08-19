from datetime import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class FollowUpJob(Base):
    __tablename__ = "follow_up_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    sermon_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("sermons.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    map_model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reduce_model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="queued", server_default="queued"
    )
    total_chunks: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    completed_chunks: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    notes_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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
        Index("ix_follow_up_jobs_status", "status"),
    )
