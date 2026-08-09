"""create sermons table

Revision ID: 0001_create_sermons
Revises:
Create Date: 2026-08-08
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_create_sermons"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sermons",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("church_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("preacher", sa.String(length=200), nullable=True),
        sa.Column("scripture_reference", sa.String(length=200), nullable=True),
        sa.Column("preached_at", sa.Date(), nullable=True),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("media_file_name", sa.String(length=255), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column(
            "transcript_status",
            sa.String(length=30),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column("follow_up_subject", sa.String(length=300), nullable=True),
        sa.Column("follow_up_body", sa.Text(), nullable=True),
        sa.Column(
            "ai_draft_status",
            sa.String(length=30),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column(
            "email_status",
            sa.String(length=30),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sermons_created_by_user_id",
        "sermons",
        ["created_by_user_id"],
    )
    op.create_index(
        "ix_sermons_church_created",
        "sermons",
        ["church_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_sermons_church_created", table_name="sermons")
    op.drop_index("ix_sermons_created_by_user_id", table_name="sermons")
    op.drop_table("sermons")
