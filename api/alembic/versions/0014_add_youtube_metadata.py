"""add youtube metadata columns to sermons

Revision ID: 0014_add_youtube_metadata
Revises: 0013_create_app_settings
Create Date: 2026-08-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_add_youtube_metadata"
down_revision = "0013_create_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sermons", sa.Column("youtube_video_id", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "sermons",
        sa.Column("youtube_thumbnail_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "sermons",
        sa.Column("youtube_fetched_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_sermons_youtube_video_id", "sermons", ["youtube_video_id"])


def downgrade() -> None:
    op.drop_index("ix_sermons_youtube_video_id", table_name="sermons")
    op.drop_column("sermons", "youtube_fetched_at")
    op.drop_column("sermons", "youtube_thumbnail_url")
    op.drop_column("sermons", "youtube_video_id")
