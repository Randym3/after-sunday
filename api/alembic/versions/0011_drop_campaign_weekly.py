"""drop weekly campaign schedule columns

Revision ID: 0011_drop_campaign_weekly
Revises: 0010_add_campaign_schedule
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_drop_campaign_weekly"
down_revision: Union[str, None] = "0010_add_campaign_schedule"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("campaigns", "weekly_time")
    op.drop_column("campaigns", "weekly_day")


def downgrade() -> None:
    op.add_column("campaigns", sa.Column("weekly_day", sa.Integer(), nullable=True))
    op.add_column("campaigns", sa.Column("weekly_time", sa.Time(), nullable=True))
