import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user_uuid
from app.db import get_db
from app.main import app
from app.services.follow_up import (
    SYSTEM_PROMPT,
    _fix_takeaway_heading_count,
    build_follow_up_prompt,
    detect_sermon_outline,
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


FOUR_POINT_TRANSCRIPT = (
    "We're in Mark 9 today. The first point is don't be afraid to ask for "
    "directions. The point number two is don't forget to pick up the kids. "
    "Our third point is share the road. And finally point number four is "
    "stay in your lane."
)


def test_detect_sermon_outline_extracts_four_points():
    outline = detect_sermon_outline(FOUR_POINT_TRANSCRIPT)
    assert outline is not None
    assert outline["count"] == 4
    assert outline["points"] == [
        "don't be afraid to ask for directions",
        "don't forget to pick up the kids",
        "share the road",
        "stay in your lane",
    ]


def test_detect_sermon_outline_returns_none_without_outline():
    assert detect_sermon_outline("Just a plain transcript with no points.") is None
    assert detect_sermon_outline("") is None
    assert detect_sermon_outline(None) is None


def test_detect_sermon_outline_needs_at_least_two_points():
    assert detect_sermon_outline("The point number one is the only point.") is None


def test_build_follow_up_prompt_injects_detected_outline():
    prompt = build_follow_up_prompt(
        title="Pursuit of True Greatness",
        preacher="Nate Miguel",
        scripture_reference="Mark 9:30-50",
        transcript=FOUR_POINT_TRANSCRIPT,
    )
    assert "Detected sermon outline (4 points)" in prompt["user"]
    assert "1. don't be afraid to ask for directions" in prompt["user"]
    assert "4. stay in your lane" in prompt["user"]


def test_build_follow_up_prompt_omits_outline_when_absent():
    prompt = build_follow_up_prompt(
        title="T",
        preacher=None,
        scripture_reference=None,
        transcript="A transcript with no announced points.",
    )
    assert "Detected sermon outline" not in prompt["user"]


def test_fix_takeaway_heading_count_corrects_wrong_number():
    body = (
        "A summary.\n\nThree takeaways:\n\n"
        "1. Ask for directions.\n"
        "2. Pick up the kids.\n"
        "3. Share the road.\n"
        "4. Stay in your lane.\n\n"
        "Reflection questions:\n\n1. Q?\n2. Q?\n3. Q?"
    )
    fixed = _fix_takeaway_heading_count(body)
    assert "Four takeaways:" in fixed
    assert "Three takeaways:" not in fixed
    assert "Reflection questions:" in fixed


def test_fix_takeaway_heading_count_leaves_matching_heading():
    body = "Three takeaways:\n\n1. A.\n2. B.\n3. C."
    assert _fix_takeaway_heading_count(body) == body


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