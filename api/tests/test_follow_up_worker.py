import asyncio
import json
import uuid

from app.models.follow_up_job import FollowUpJob
from app.models.sermon import Sermon
from app.services.follow_up_worker import _process_follow_up_job


def _long_sermon(db_session):
    sermon = Sermon(
        created_by_user_id=uuid.uuid4(),
        title="Long sermon",
        preacher="Pastor",
        scripture_reference="Psalm 23",
        source_type="youtube",
        transcript="The preacher explained the passage carefully. " * 2_000,
        transcript_status="ready",
    )
    db_session.add(sermon)
    db_session.commit()
    return sermon


def test_failed_job_persists_completed_map_notes(db_session, monkeypatch):
    sermon = _long_sermon(db_session)
    job = FollowUpJob(
        sermon_id=sermon.id,
        provider="test",
        status="queued",
    )
    db_session.add(job)
    db_session.commit()

    class FailingProvider:
        provider_name = "test"
        model_name = "reduce"
        map_model_name = "map"

        async def generate(self, **kwargs):
            await kwargs["on_chunk_complete"](0, "saved first section")
            raise RuntimeError("quota exceeded")

    monkeypatch.setattr(
        "app.services.follow_up_worker.build_follow_up_provider",
        lambda: FailingProvider(),
    )

    asyncio.run(_process_follow_up_job(db_session, job))
    db_session.refresh(job)
    db_session.refresh(sermon)

    notes = json.loads(job.notes_json)
    assert notes[0] == "saved first section"
    assert job.completed_chunks == 1
    assert job.status == "failed"
    assert sermon.ai_generation_status == "failed"
    assert sermon.ai_generation_error == "quota exceeded"
    assert sermon.ai_draft_status == "not_started"
