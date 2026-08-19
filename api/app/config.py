from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    database_url: str = (
        "postgresql+psycopg://after_sunday:after_sunday@localhost:5433/after_sunday"
    )
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    # Modulate Velma Transcribe API key. When set, real transcription runs
    # through Velma; when empty, the mock provider is used (dev only).
    modulate_api_key: str = ""
    # Text LLM used for follow-up draft generation. Any OpenAI-compatible
    # endpoint works (Groq, OpenRouter, GitHub Models, NVIDIA NIM, ...) via
    # the openai SDK's base_url. When llm_api_key is empty, the mock provider
    # is used (dev only).
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-oss-20b"
    # Long-sermon map extraction can use a faster/cheaper model while the
    # final reduce step uses the main writing model. Empty values fall back
    # to LLM_MODEL.
    llm_map_model: str | None = None
    llm_reduce_model: str | None = None
    # Resend is used for test sends in the first email-delivery slice.
    resend_api_key: str = ""
    email_from: str = ""
    # Master key for encrypting sensitive in-app settings (e.g. the stored
    # Resend key) at rest. Generate with:
    #   python -c "import secrets; print(secrets.token_urlsafe(48))"
    # When empty, sensitive settings are stored in plaintext (dev only).
    secret_key: str = ""
    # Where the local-disk storage backend keeps uploaded files, relative to
    # the api/ directory. Production swaps in S3/R2 behind the same backend.
    storage_root: str = "storage"


@lru_cache
def get_settings() -> Settings:
    return Settings()
