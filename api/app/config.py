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


@lru_cache
def get_settings() -> Settings:
    return Settings()
