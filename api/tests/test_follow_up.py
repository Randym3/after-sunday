import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user_uuid
from app.db import get_db
from app.main import app
from app.services.follow_up import (
    CHUNK_EXTRACT_PROMPT,
    MAP_CONCURRENCY,
    MAP_MAX_OUTPUT_TOKENS,
    REDUCE_MAX_OUTPUT_TOKENS,
    SYSTEM_PROMPT,
    OpenAICompatibleFollowUpProvider,
    _fix_takeaway_heading_count,
    _limit_takeaways_to_three,
    _parse_follow_up_output,
    _parse_json_object,
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


def test_system_prompt_requires_three_substantive_takeaways():
    assert "exactly three" in SYSTEM_PROMPT
    assert "25–45 words" in SYSTEM_PROMPT
    assert "thoughtful" in SYSTEM_PROMPT
    assert "Never use a" in SYSTEM_PROMPT


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


def test_limit_takeaways_to_three_drops_extra_items():
    body = (
        "Four takeaways:\n\n"
        "1. First thoughtful takeaway.\n"
        "2. Second thoughtful takeaway.\n"
        "3. Third thoughtful takeaway.\n"
        "4. Extra takeaway that must be removed.\n\n"
        "Reflection questions:\n\n1. Question?"
    )
    limited = _limit_takeaways_to_three(body)
    assert "1. First thoughtful takeaway." in limited
    assert "3. Third thoughtful takeaway." in limited
    assert "4. Extra takeaway" not in limited
    assert "Reflection questions:" in limited


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


def test_generation_logs_provider_error(client, db_session, monkeypatch, caplog):
    import logging

    class FailingProvider:
        provider_name = "test"
        model_name = "test-model"

        async def generate(self, **kwargs):
            raise RuntimeError("provider exploded")

    monkeypatch.setattr(
        "app.routers.sermons.build_follow_up_provider",
        lambda: FailingProvider(),
    )
    caplog.set_level(logging.ERROR, logger="app.routers.sermons")

    sermon_id = _create_ready_sermon(db_session)
    response = client.post(f"/sermons/{sermon_id}/follow-up/generate")

    assert response.status_code == 502
    assert "provider exploded" in response.json()["detail"]
    assert "Follow-up generation failed for sermon" in caplog.text
    assert "RuntimeError" in caplog.text


def test_chunk_prompt_requests_compact_plain_text_notes():
    lowered = CHUNK_EXTRACT_PROMPT.lower()
    assert "plain text" in lowered
    assert "main themes" in lowered
    assert "scripture" in lowered
    assert "not json" in lowered


async def _test_map_calls_are_bounded_and_ordered(monkeypatch):
    import asyncio

    active = 0
    maximum = 0

    async def fake_chat_text(self, client, system, user, *, max_tokens, temperature):
        nonlocal active, maximum
        assert max_tokens == MAP_MAX_OUTPUT_TOKENS
        active += 1
        maximum = max(maximum, active)
        section = user.split(":", 1)[0]
        await asyncio.sleep(0.01 if "section 2/4" in section else 0.02)
        active -= 1
        return section

    monkeypatch.setattr(OpenAICompatibleFollowUpProvider, "_chat_text", fake_chat_text)
    provider = OpenAICompatibleFollowUpProvider("key", "url", "model")
    notes = await provider._map_transcript_chunks(
        object(), ["one", "two", "three", "four"]
    )

    assert MAP_CONCURRENCY == 2
    assert maximum == 2
    assert notes == [
        "Transcript section 1/4",
        "Transcript section 2/4",
        "Transcript section 3/4",
        "Transcript section 4/4",
    ]


def test_map_calls_are_bounded_and_ordered(monkeypatch):
    asyncio.run(_test_map_calls_are_bounded_and_ordered(monkeypatch))


async def _test_long_generation_maps_every_chunk_then_reduces(monkeypatch):
    calls = []

    async def fake_chat_text(self, client, system, user, *, max_tokens, temperature):
        calls.append({"stage": "map", "system": system, "user": user, "max_tokens": max_tokens})
        return user.split(":", 1)[0] + " notes"

    async def fake_chat_json(self, client, system, user, *, max_tokens, temperature):
        calls.append({"stage": "reduce", "system": system, "user": user, "max_tokens": max_tokens})
        return {
            "subject": "A message to remember",
            "body": "Three takeaways:\\n\\n1. One.\\n2. Two.\\n3. Three.",
        }

    monkeypatch.setattr(OpenAICompatibleFollowUpProvider, "_chat_text", fake_chat_text)
    monkeypatch.setattr(OpenAICompatibleFollowUpProvider, "_chat_json", fake_chat_json)
    monkeypatch.setattr(
        "app.services.transcript_chunking.chunk_transcript",
        lambda transcript: ["chunk one", "chunk two", "chunk three"],
    )

    provider = OpenAICompatibleFollowUpProvider("key", "url", "model")
    result = await provider.generate(
        title="A Long Sermon",
        preacher="Tanner Gish",
        scripture_reference="Habakkuk 1",
        transcript="The sermon content. " * 2_000,
    )

    assert result["subject"] == "A message to remember"
    assert len(calls) == 4
    assert all(call["stage"] == "map" for call in calls[:3])
    assert all(call["max_tokens"] == MAP_MAX_OUTPUT_TOKENS for call in calls[:3])
    assert calls[-1]["stage"] == "reduce"
    assert calls[-1]["max_tokens"] == REDUCE_MAX_OUTPUT_TOKENS
    assert "Transcript section 1/3 notes" in calls[-1]["user"]
    assert "Transcript section 2/3 notes" in calls[-1]["user"]
    assert "Transcript section 3/3 notes" in calls[-1]["user"]
    assert "Sermon digest from the full transcript" in calls[-1]["user"]


def test_long_generation_maps_every_chunk_then_reduces(monkeypatch):
    asyncio.run(_test_long_generation_maps_every_chunk_then_reduces(monkeypatch))


def test_long_generation_is_enqueued_for_resume(client, db_session, monkeypatch):
    class Provider:
        provider_name = "openai_compatible"
        model_name = "reduce-model"
        map_model_name = "map-model"

    monkeypatch.setattr(
        "app.routers.sermons.build_follow_up_provider",
        lambda: Provider(),
    )
    from app.models.sermon import Sermon

    sermon_id = _create_ready_sermon(db_session)
    sermon = db_session.get(Sermon, sermon_id)
    sermon.transcript = "A sentence about the sermon. " * 900
    db_session.commit()

    response = client.post(f"/sermons/{sermon_id}/follow-up/generate")
    assert response.status_code == 200
    body = response.json()
    assert body["aiDraftStatus"] == "generating"
    assert body["aiGenerationStatus"] == "queued"
    assert body["aiGenerationTotalChunks"] >= 3
    assert body["aiGenerationCompletedChunks"] == 0


def test_long_prompt_endpoint_describes_map_reduce_without_llm(client, db_session):
    from app.models.sermon import Sermon

    sermon_id = _create_ready_sermon(db_session)
    sermon = db_session.get(Sermon, sermon_id)
    sermon.transcript = "A sentence about the sermon. " * 900
    db_session.commit()

    response = client.get(f"/sermons/{sermon_id}/follow-up/prompt")
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "map_reduce"
    assert "section of a sermon transcript" in body["mapPrompt"]
    assert "Sermon digest from the full transcript" in body["reducePrompt"]
    assert body["mapChunkSize"] == 8000
    assert body["mapConcurrency"] == 2


def test_parse_json_object_accepts_fenced_json():
    content = '''```json
{"notes": "hello"}
```'''
    assert _parse_json_object(content) == {"notes": "hello"}


def test_parse_follow_up_output_accepts_delimiters():
    content = """SUBJECT: A thought from Sunday
BODY:
A warm pastoral email."""
    assert _parse_follow_up_output(content) == {
        "subject": "A thought from Sunday",
        "body": "A warm pastoral email.",
    }


def test_compound_request_omits_gpt_reasoning_parameter():
    kwargs = OpenAICompatibleFollowUpProvider._completion_kwargs(
        model="groq/compound",
        system="system",
        user="user",
        max_tokens=800,
        temperature=0.2,
        reasoning_effort="low",
    )
    assert "reasoning_effort" not in kwargs


async def _test_chat_json_makes_one_request(monkeypatch):
    calls = []

    class FakeCompletions:
        async def create(self, **kwargs):
            calls.append(kwargs)
            return type(
                "Response",
                (),
                {
                    "choices": [
                        type(
                            "Choice",
                            (),
                            {
                                "message": type(
                                    "Message",
                                    (),
                                    {"content": '{"notes":"one call"}'},
                                )(),
                            },
                        )(),
                    ],
                },
            )()

    class FakeClient:
        chat = type("Chat", (), {"completions": FakeCompletions()})()

    provider = OpenAICompatibleFollowUpProvider(
        "key", "url", "openai/gpt-oss-20b"
    )
    result = await provider._chat_json(
        FakeClient(), "system", "user", max_tokens=250, temperature=0.2
    )

    assert result == {"notes": "one call"}
    assert len(calls) == 1
    assert calls[0]["max_completion_tokens"] == 250
    assert calls[0]["reasoning_effort"] == "low"
    assert "response_format" not in calls[0]


def test_chat_json_makes_one_request(monkeypatch):
    asyncio.run(_test_chat_json_makes_one_request(monkeypatch))


async def _test_map_failure_includes_section_context(monkeypatch):
    async def fake_chat_text(self, client, system, user, *, max_tokens, temperature):
        if "section 2/3" in user:
            raise RuntimeError("429 quota exceeded")
        return "ok"

    monkeypatch.setattr(OpenAICompatibleFollowUpProvider, "_chat_text", fake_chat_text)
    provider = OpenAICompatibleFollowUpProvider("key", "url", "model")
    with pytest.raises(RuntimeError, match="section 2/3.*429 quota exceeded"):
        await provider._map_transcript_chunks(object(), ["one", "two", "three"])


def test_map_failure_includes_section_context(monkeypatch):
    asyncio.run(_test_map_failure_includes_section_context(monkeypatch))
