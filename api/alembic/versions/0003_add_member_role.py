"""add role column to members

Revision ID: 0003_add_member_role
Revises: 0002_create_members
Create Date: 2026-08-09
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_add_member_role"
down_revision = "0002_create_members"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column(
            "role",
            sa.String(length=20),
            nullable=False,
            server_default="member",
        ),
    )


def downgrade() -> None:
    op.drop_column("members", "role")
