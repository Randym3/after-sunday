"""create app_settings table

Revision ID: 0013_create_app_settings
Revises: 0012_add_sermon_ai_metadata
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_create_app_settings"
down_revision: Union[str, None] = "0012_add_sermon_ai_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
