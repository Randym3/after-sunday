"""link campaigns to sermons

Revision ID: 0009_add_campaign_sermon
Revises: 0008_create_campaigns
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0009_add_campaign_sermon"
down_revision: Union[str, None] = "0008_create_campaigns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("sermon_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_campaigns_sermon_id", "campaigns", "sermons", ["sermon_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_campaigns_sermon_id", "campaigns", ["sermon_id"])


def downgrade() -> None:
    op.drop_index("ix_campaigns_sermon_id", table_name="campaigns")
    op.drop_constraint("fk_campaigns_sermon_id", "campaigns", type_="foreignkey")
    op.drop_column("campaigns", "sermon_id")
