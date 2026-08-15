from pydantic import BaseModel, ConfigDict, Field

from app.schemas.aliases import to_camel


class EmailSettingsRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    email_from: str | None
    resend_configured: bool
    resend_key_masked: str | None
    source: str  # "env" | "db" | "unset"


class EmailSettingsUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    # A non-empty key replaces the saved one. Blank/None keeps the current
    # saved key; `clear_resend_key: true` removes it.
    resend_api_key: str | None = Field(default=None, max_length=500)
    # Always sent by the form as the full desired value (empty clears it).
    email_from: str | None = Field(default=None, max_length=320)
    clear_resend_key: bool = False


class BrandingRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    organization_name: str | None
    logo_url: str | None
    logo_content_type: str | None


class BrandingUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    # None = keep current, "" = clear.
    organization_name: str | None = None


class StorageRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    backend: str
    location: str
    public_base_url: str
