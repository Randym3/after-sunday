"""add resumable follow-up generation jobs

Revision ID: 0015_add_follow_up_jobs
Revises: 0014_add_youtube_metadata
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0015_add_follow_up_jobs"
down_revision: Union[str, None] = "0014_add_youtube_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sermons",
        sa.Column("ai_generation_status", sa.String(length=20), nullable=False, server_default="idle"),
    )
    op.add_column(
        "sermons",
        sa.Column("ai_generation_total_chunks", sa.Integer(), nullable=True),
    )
    op.add_column(
        "sermons",
        sa.Column("ai_generation_completed_chunks", sa.Integer(), nullable=True),
    )
    op.add_column(
        "sermons",
        sa.Column("ai_generation_error", sa.Text(), nullable=True),
    )
    op.create_table(
        "follow_up_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sermon_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=100), nullable=False),
        sa.Column("map_model", sa.String(length=200), nullable=True),
        sa.Column("reduce_model", sa.String(length=200), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("total_chunks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_chunks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes_json", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["sermon_id"], ["sermons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sermon_id"),
    )
    op.create_index("ix_follow_up_jobs_status", "follow_up_jobs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_follow_up_jobs_status", table_name="follow_up_jobs")
    op.drop_table("follow_up_jobs")
    op.drop_column("sermons", "ai_generation_error")
    op.drop_column("sermons", "ai_generation_completed_chunks")
    op.drop_column("sermons", "ai_generation_total_chunks")
    op.drop_column("sermons", "ai_generation_status")
