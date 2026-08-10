"""create transcription jobs table

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_create_transcription_jobs"
down_revision: Union[str, None] = "0004_add_media_storage_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transcription_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "sermon_id",
            sa.Uuid(),
            sa.ForeignKey("sermons.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "provider",
            sa.String(50),
            nullable=False,
            server_default="mock",
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("result_text", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_transcription_jobs_status",
        "transcription_jobs",
        ["status"],
    )


def downgrade() -> None:
    op.drop_table("transcription_jobs")
