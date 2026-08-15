from types import SimpleNamespace

import pytest

from app.services import crypto


@pytest.fixture
def secret_key(monkeypatch):
    monkeypatch.setattr(crypto, "get_settings", lambda: SimpleNamespace(secret_key="test-secret-key"))
    crypto._warned_no_secret = True  # silence the dev-mode warning
    yield "test-secret-key"


def test_round_trip_with_secret(secret_key):
    stored = crypto.encrypt_value("re_abc123")
    assert stored.startswith(crypto.PREFIX)
    assert "re_abc123" not in stored
    assert crypto.decrypt_value(stored) == "re_abc123"


def test_encrypted_values_differ_per_call(secret_key):
    stored_a = crypto.encrypt_value("re_abc123")
    stored_b = crypto.encrypt_value("re_abc123")
    assert stored_a != stored_b  # random nonce
    assert crypto.decrypt_value(stored_a) == crypto.decrypt_value(stored_b) == "re_abc123"


def test_plaintext_passthrough_without_secret(monkeypatch):
    monkeypatch.setattr(crypto, "get_settings", lambda: SimpleNamespace(secret_key=""))
    crypto._warned_no_secret = True
    assert crypto.encrypt_value("re_abc123") == "re_abc123"
    assert crypto.decrypt_value("re_abc123") == "re_abc123"


def test_backward_compatible_plaintext_read(secret_key):
    # Rows written before encryption was enabled carry no prefix.
    assert crypto.decrypt_value("re_old_plaintext") == "re_old_plaintext"


def test_wrong_secret_raises(secret_key):
    stored = crypto.encrypt_value("re_abc123")
    crypto.get_settings = lambda: SimpleNamespace(secret_key="a-different-secret")
    with pytest.raises(crypto.DecryptionError):
        crypto.decrypt_value(stored)


def test_malformed_encrypted_value_raises(secret_key):
    with pytest.raises(crypto.DecryptionError):
        crypto.decrypt_value(crypto.PREFIX + "not-base64!!")
