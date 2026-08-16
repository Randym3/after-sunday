import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user_uuid
from app.db import get_db
from app.main import app
from app.services.follow_up import (
    SYSTEM_PROMPT,
    build_follow_up_prompt,
)


def test_build_follow_up_prompt_contains_transcript_and_context():
    transcript = "Nate opened Mark 9 and walked us through verses 30–50."
    prompt = build_follow_up_prompt(
        title="The Road to Greatness",
        preacher="Nate Miguel",
        scripture_reference="Mark 9:30-50",
        transcript=transcript,
    )
    assert prompt["system"] == SYSTEM_PROMPT
    assert "Sermon title: The Road to Greatness" in prompt["user"]
    assert "Assigned preacher name: Nate Miguel" in prompt["user"]
    assert "Mark 9:30-50" in prompt["user"]
    assert transcript in prompt["user"]
    assert "Sermon transcript:" in prompt["user"]


def test_build_follow_up_prompt_handles_missing_metadata():
    prompt = build_follow_up_prompt(
        title="",
        preacher=None,
        scripture_reference=None,
        transcript="Some transcript text.",
    )
    assert "(untitled)" in prompt["user"]
    assert "(not given)" in prompt["user"]
    # No preacher assigned → must not demand using a specific name.
    assert "There is no assigned preacher name" in prompt["user"]


def test_system_prompt_requires_longer_verse_rich_summary():
    assert "80–120" in SYSTEM_PROMPT
    assert "300–380" in SYSTEM_PROMPT
    assert "weave them" in SYSTEM_PROMPT
    assert "never guess or invent a citation" in SYSTEM_PROMPT


@pytest.fixture
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_uuid] = lambda: uuid.uuid4()
    yield TestClient(app)
    app.dependency_overrides.clear()


def _create_ready_sermon(db_session):
    from app.models.sermon import Sermon

    sermon = Sermon(
        created_by_user_id=uuid.uuid4(),
        title="Pursuit of True Greatness",
        preacher="Nate Miguel",
        scripture_reference="Mark 9:30-50",
        source_type="transcript",
        transcript="Mark 9:30–50 walked us through true greatness.",
        transcript_status="ready",
    )
    db_session.add(sermon)
    db_session.commit()
    return sermon.id


def test_prompt_endpoint_returns_exact_prompt(client, db_session):
    sermon_id = _create_ready_sermon(db_session)
    response = client.get(f"/sermons/{sermon_id}/follow-up/prompt")
    assert response.status_code == 200
    body = response.json()
    assert body["systemPrompt"].startswith("You are a pastoral communications assistant")
    assert "Sermon transcript:" in body["userPrompt"]
    assert "Mark 9:30-50" in body["userPrompt"]


def test_prompt_endpoint_requires_ready_transcript(client, db_session):
    from app.models.sermon import Sermon

    sermon = Sermon(
        created_by_user_id=uuid.uuid4(),
        title="No transcript yet",
        source_type="upload",
        transcript_status="awaiting_upload",
    )
    db_session.add(sermon)
    db_session.commit()

    response = client.get(f"/sermons/{sermon.id}/follow-up/prompt")
    assert response.status_code == 409


def test_prompt_endpoint_404(client, db_session):
    response = client.get(f"/sermons/{uuid.uuid4()}/follow-up/prompt")
    assert response.status_code == 404