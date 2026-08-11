import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.aliases import to_camel

MemberStatus = Literal["active", "paused", "inactive", "removed"]
MemberRole = Literal["member", "pastor", "deacon", "elder", "leader", "volunteer", "visitor"]


class MemberCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=320)
    phone: str | None = Field(default=None, max_length=50)
    status: MemberStatus = "active"
    role: MemberRole = "member"
    notes: str | None = None


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]


class MemberUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, min_length=3, max_length=320)
    phone: str | None = Field(default=None, max_length=50)
    status: MemberStatus | None = None
    role: MemberRole | None = None
    notes: str | None = None


class MemberRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    phone: str | None
    status: str
    role: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
