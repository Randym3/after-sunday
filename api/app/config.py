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
    llm_model: str = "llama-3.3-70b-versatile"


@lru_cache
def get_settings() -> Settings:
    return Settings()
