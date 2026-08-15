"""add campaign schedule columns

Revision ID: 0010_add_campaign_schedule
Revises: 0009_add_campaign_sermon
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0010_add_campaign_schedule"
down_revision: Union[str, None] = "0009_add_campaign_sermon"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("send_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column("weekly_day", sa.Integer(), nullable=True))
    op.add_column("campaigns", sa.Column("weekly_time", sa.Time(), nullable=True))
    op.create_index("ix_campaigns_send_at", "campaigns", ["send_at"])


def downgrade() -> None:
    op.drop_index("ix_campaigns_send_at", table_name="campaigns")
    op.drop_column("campaigns", "weekly_time")
    op.drop_column("campaigns", "weekly_day")
    op.drop_column("campaigns", "send_at")
