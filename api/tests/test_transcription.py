import asyncio
from pathlib import Path

import pytest

from app.services.transcription import (
    VelmaTranscriptionProvider,
    _prepare_velma_upload,
)


def test_m4a_is_converted_to_temporary_mp3(tmp_path, monkeypatch):
    source = tmp_path / "sermon.m4a"
    source.write_bytes(b"m4a input")
    commands: list[list[str]] = []

    def fake_run(command, **kwargs):
        commands.append(command)
        Path(command[-1]).write_bytes(b"mp3 output")

    monkeypatch.setattr("app.services.transcription.subprocess.run", fake_run)

    with _prepare_velma_upload(source, source.name) as (upload_path, upload_name):
        assert upload_name == "recording.mp3"
        assert upload_path.suffix == ".mp3"
        assert upload_path.read_bytes() == b"mp3 output"

    assert commands
    assert commands[0][0] == "ffmpeg"
    assert "-i" in commands[0]
    assert str(source) in commands[0]


def test_mp3_is_sent_without_conversion(tmp_path, monkeypatch):
    source = tmp_path / "sermon.mp3"
    source.write_bytes(b"mp3 input")
    monkeypatch.setattr(
        "app.services.transcription.subprocess.run",
        lambda *args, **kwargs: pytest.fail("ffmpeg should not run for MP3"),
    )

    with _prepare_velma_upload(source, source.name) as (upload_path, upload_name):
        assert upload_path == source
        assert upload_name == source.name


def test_velma_error_includes_response_body(tmp_path, monkeypatch):
    source = tmp_path / "sermon.mp3"
    source.write_bytes(b"mp3 input")

    class FakeResponse:
        is_error = True
        status_code = 400
        text = '{"detail":"Unsupported file format"}'

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(
        "app.services.transcription.httpx.AsyncClient",
        lambda **kwargs: FakeClient(),
    )

    with pytest.raises(RuntimeError, match="Unsupported file format"):
        asyncio.run(
            VelmaTranscriptionProvider("test-key").transcribe(
                source, original_filename=source.name
            )
        )
