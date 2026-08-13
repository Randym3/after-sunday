"""create groups and group_members tables

Revision ID: 0007_create_groups
Revises: 0006_add_sermon_transcript_error
Create Date: 2026-08-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_create_groups"
down_revision: Union[str, None] = "0006_add_sermon_transcript_error"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("church_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_groups_name", "groups", ["name"], unique=True)
    op.create_index(
        "ix_groups_created_by_user_id", "groups", ["created_by_user_id"]
    )

    op.create_table(
        "group_members",
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("member_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["member_id"], ["members.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("group_id", "member_id"),
    )
    op.create_index(
        "ix_group_members_member_id", "group_members", ["member_id"]
    )


def downgrade() -> None:
    op.drop_table("group_members")
    op.drop_index("ix_groups_created_by_user_id", table_name="groups")
    op.drop_index("ix_groups_name", table_name="groups")
    op.drop_table("groups")
