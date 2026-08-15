import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.aliases import to_camel


def _validate_send_at(send_at: datetime | None) -> None:
    if send_at is None:
        raise ValueError("Choose when the campaign should go out.")
    if send_at.tzinfo is None:
        send_at = send_at.replace(tzinfo=timezone.utc)
    if send_at <= datetime.now(timezone.utc):
        raise ValueError("The send time must be in the future.")


class CampaignCreate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    name: str = Field(min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=300)
    body: str | None = None
    sermon_id: uuid.UUID
    group_id: uuid.UUID | None = None
    member_ids: list[uuid.UUID] = []
    send_at: datetime

    @field_validator("send_at", mode="after")
    @classmethod
    def send_at_must_be_future(cls, value: datetime) -> datetime:
        _validate_send_at(value)
        return value

    @model_validator(mode="after")
    def validate_recipients(self):
        if (self.group_id is None) == (len(self.member_ids) == 0):
            raise ValueError("Choose a group or at least one explicit member.")
        return self


class CampaignUpdate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )

    name: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=300)
    body: str | None = None
    send_at: datetime | None = None

    @field_validator("send_at", mode="after")
    @classmethod
    def send_at_must_be_future(cls, value: datetime) -> datetime:
        _validate_send_at(value)
        return value


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
    created_at: datetime
    updated_at: datetime
