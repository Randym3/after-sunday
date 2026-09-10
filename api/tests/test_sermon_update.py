import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user_uuid
from app.db import get_db
from app.main import app


@pytest.fixture
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_uuid] = lambda: uuid.uuid4()
    yield TestClient(app)
    app.dependency_overrides.clear()


def _create_sermon(db_session, **kwargs):
    from app.models.sermon import Sermon

    sermon = Sermon(
        created_by_user_id=uuid.uuid4(),
        title="A sermon",
        source_type="youtube",
        transcript_status="failed",
        transcript_error="No English captions available for video abc123.",
        **kwargs,
    )
    db_session.add(sermon)
    db_session.commit()
    return sermon


def test_pasting_transcript_via_update_clears_failed_status(client, db_session):
    """A manual transcript save must clear stale transcription-failure state."""
    sermon = _create_sermon(db_session)

    response = client.patch(
        f"/sermons/{sermon.id}",
        json={"transcript": "Father, we ask that you would shape our church..."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["transcriptStatus"] == "ready"
    assert body["transcriptError"] is None


def test_update_without_transcript_keeps_existing_status(client, db_session):
    """Editing metadata alone must not silently mark transcription ready."""
    sermon = _create_sermon(db_session)

    response = client.patch(
        f"/sermons/{sermon.id}",
        json={"title": "A renamed sermon"},
    )
    assert response.status_code == 200
    assert response.json()["transcriptStatus"] == "failed"


def test_update_with_whitespace_transcript_keeps_failed_status(client, db_session):
    sermon = _create_sermon(db_session)

    response = client.patch(
        f"/sermons/{sermon.id}",
        json={"transcript": "   "},
    )
    assert response.status_code == 200
    assert response.json()["transcriptStatus"] == "failed"
