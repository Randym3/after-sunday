"""add media storage fields

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_add_media_storage_fields"
down_revision: Union[str, None] = "0003_add_member_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sermons",
        sa.Column(
            "media_storage_key",
            sa.String(512),
            nullable=True,
        ),
    )
    op.add_column(
        "sermons",
        sa.Column(
            "media_size_bytes",
            sa.BigInteger(),
            nullable=True,
        ),
    )
    op.add_column(
        "sermons",
        sa.Column(
            "media_content_type",
            sa.String(100),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("sermons", "media_content_type")
    op.drop_column("sermons", "media_size_bytes")
    op.drop_column("sermons", "media_storage_key")
