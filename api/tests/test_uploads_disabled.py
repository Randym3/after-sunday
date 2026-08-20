import pytest
from fastapi import HTTPException

from app.routers.sermons import (
    RECORDING_UPLOADS_DISABLED_DETAIL,
    _require_recording_uploads_enabled,
)


def test_recording_upload_gate_returns_temporary_disabled_error():
    with pytest.raises(HTTPException) as exc_info:
        _require_recording_uploads_enabled()

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == RECORDING_UPLOADS_DISABLED_DETAIL
