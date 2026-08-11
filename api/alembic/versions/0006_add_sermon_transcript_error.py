"""Add transcript_error column to sermons."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_add_sermon_transcript_error"
down_revision: str | None = "0005_create_transcription_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sermons",
        sa.Column("transcript_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sermons", "transcript_error")
