"""create campaigns and campaign_members tables

Revision ID: 0008_create_campaigns
Revises: 0007_create_groups
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0008_create_campaigns"
down_revision: Union[str, None] = "0007_create_groups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("subject", sa.String(300)),
        sa.Column("body", sa.Text()),
        sa.Column("recipient_source", sa.String(20), nullable=False),
        sa.Column("group_id", sa.Uuid(), sa.ForeignKey("groups.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_campaigns_created_by_user_id", "campaigns", ["created_by_user_id"])
    op.create_table(
        "campaign_members",
        sa.Column("campaign_id", sa.Uuid(), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("member_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_campaign_members_member_id", "campaign_members", ["member_id"])


def downgrade() -> None:
    op.drop_table("campaign_members")
    op.drop_index("ix_campaigns_created_by_user_id", table_name="campaigns")
    op.drop_table("campaigns")
