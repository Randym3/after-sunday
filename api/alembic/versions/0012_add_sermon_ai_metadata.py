"""store sermon AI generation metadata

Revision ID: 0012_add_sermon_ai_metadata
Revises: 0011_drop_campaign_weekly
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_add_sermon_ai_metadata"
down_revision: Union[str, None] = "0011_drop_campaign_weekly"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sermons",
        sa.Column("ai_provider", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "sermons",
        sa.Column("ai_model", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sermons", "ai_model")
    op.drop_column("sermons", "ai_provider")
