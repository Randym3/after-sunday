import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import setting  # noqa: F401 — registers app_settings in metadata
from app.models import sermon  # noqa: F401 — registers sermons in metadata
from app.models import transcription_job  # noqa: F401 — registers jobs in metadata
from app.models import sermon  # noqa: F401 — registers sermons in metadata
from app.models import transcription_job  # noqa: F401 — registers jobs in metadata


@pytest.fixture
def db_session():
    """Fresh in-memory SQLite session for settings-table tests.

    StaticPool + check_same_thread=False lets FastAPI's TestClient worker
    threads share the single in-memory connection with the fixture session.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
