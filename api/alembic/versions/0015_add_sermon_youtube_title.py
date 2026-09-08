"""add youtube_title column to sermons

Revision ID: 0015_add_sermon_youtube_title
Revises: 0014_add_youtube_metadata
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_add_sermon_youtube_title"
down_revision = "0014_add_youtube_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sermons", sa.Column("youtube_title", sa.String(length=300), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("sermons", "youtube_title")