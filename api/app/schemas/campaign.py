import uuid
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.aliases import to_camel


def _validate_schedule(
    send_at: datetime | None,
    weekly_day: int | None,
    weekly_time: time | None,
) -> None:
    has_specific = send_at is not None
    has_weekly = weekly_day is not None or weekly_time is not None

    if not has_specific and not has_weekly:
        raise ValueError("Choose when the campaign should go out.")

    if has_specific and has_weekly:
        raise ValueError(
            "Choose either a specific date/time or a weekly schedule, not both."
        )

    if weekly_day is not None and weekly_time is None:
        raise ValueError("A weekly schedule needs a time.")

    if weekly_time is not None and weekly_day is None:
        raise ValueError("A weekly schedule needs a day.")

    if weekly_day is not None and not (0 <= weekly_day <= 6):
        raise ValueError("Weekly day must be between 0 (Sunday) and 6 (Saturday).")


class CampaignCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str = Field(min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=300)
    body: str | None = None
    sermon_id: uuid.UUID
    group_id: uuid.UUID | None = None
    member_ids: list[uuid.UUID] = []
    send_at: datetime | None = None
    weekly_day: int | None = None
    weekly_time: time | None = None

    @model_validator(mode="after")
    def validate_recipients(self):
        if (self.group_id is None) == (len(self.member_ids) == 0):
            raise ValueError("Choose a group or at least one explicit member.")
        return self

    @model_validator(mode="after")
    def validate_schedule(self):
        _validate_schedule(self.send_at, self.weekly_day, self.weekly_time)
        return self


class CampaignUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=300)
    body: str | None = None
    send_at: datetime | None = None
    weekly_day: int | None = None
    weekly_time: time | None = None

    @model_validator(mode="after")
    def validate_schedule(self):
        _validate_schedule(self.send_at, self.weekly_day, self.weekly_time)
        return self


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]


class CampaignRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: uuid.UUID
    name: str
    subject: str | None
    body: str | None
    sermon_id: uuid.UUID | None
    sermon_title: str | None
    recipient_source: Literal["group", "members"]
    group_id: uuid.UUID | None
    recipient_count: int
    status: str
    send_at: datetime | None
    weekly_day: int | None
    weekly_time: time | None
    created_at: datetime
    updated_at: datetime
