import uuid
from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas.campaign import CampaignCreate, _validate_send_at


def test_missing_send_at_rejected():
    with pytest.raises(ValueError, match="Choose when"):
        _validate_send_at(None)


def test_past_send_at_rejected():
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    with pytest.raises(ValueError, match="future"):
        _validate_send_at(past)


def test_future_send_at_accepted():
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    _validate_send_at(future)  # must not raise


def test_create_requires_send_at():
    with pytest.raises(ValidationError):
        CampaignCreate(name="Test", sermon_id=uuid.uuid4(), group_id=uuid.uuid4())


def test_weekly_fields_rejected():
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    with pytest.raises(ValidationError):
        CampaignCreate(
            name="Test",
            sermon_id=uuid.uuid4(),
            group_id=uuid.uuid4(),
            send_at=future,
            weekly_day=0,
        )
