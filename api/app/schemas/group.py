import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.aliases import to_camel


class GroupCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class GroupUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None


class GroupRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: uuid.UUID
    name: str
    description: str | None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class MemberIdsRequest(BaseModel):
    member_ids: list[uuid.UUID]


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]
