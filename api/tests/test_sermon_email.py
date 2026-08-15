import uuid

import pytest
from pydantic import ValidationError

from app.schemas.sermon import TestEmailRequest as SermonEmailRequest


def test_test_email_accepts_member_id():
    member_id = uuid.uuid4()
    payload = SermonEmailRequest(member_id=member_id)
    assert payload.member_id == member_id
    assert payload.email is None


def test_test_email_normalizes_manual_email():
    payload = SermonEmailRequest(email="  STAFF@Example.COM ")
    assert payload.email == "staff@example.com"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"email": "staff@example.com", "member_id": uuid.uuid4()},
        {"email": "not-an-email"},
    ],
)
def test_test_email_rejects_invalid_recipient(payload):
    with pytest.raises(ValidationError):
        SermonEmailRequest(**payload)
