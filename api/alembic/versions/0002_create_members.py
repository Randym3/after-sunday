"""create members table

Revision ID: 0002_create_members
Revises: 0001_create_sermons
Create Date: 2026-08-09
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_create_members"
down_revision = "0001_create_sermons"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("church_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        "ix_members_created_by_user_id", "members", ["created_by_user_id"]
    )
    op.create_index("ix_members_email", "members", ["email"], unique=True)
    op.create_index(
        "ix_members_church_created", "members", ["church_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_members_church_created", table_name="members")
    op.drop_index("ix_members_email", table_name="members")
    op.drop_index("ix_members_created_by_user_id", table_name="members")
    op.drop_table("members")
