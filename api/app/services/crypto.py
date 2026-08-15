"""Encryption-at-rest for sensitive app settings.

Values are AES-256-GCM encrypted with a key derived (PBKDF2-HMAC-SHA256) from
the ``SECRET_KEY`` env var and stored as::

    enc:v1:<base64(nonce + ciphertext + tag)>

When ``SECRET_KEY`` is unset (dev only) values are stored in plaintext and a
one-time warning is printed — mirroring how transcription/LLM providers fall
back to mocks. Reads are backward compatible: values without the ``enc:v1:``
prefix are returned as-is, so rows written before encryption was enabled keep
working. Changing ``SECRET_KEY`` invalidates already-encrypted values (they
are treated as unset with a warning).
"""

from __future__ import annotations

import base64
import os
from hashlib import pbkdf2_hmac

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

PREFIX = "enc:v1:"
_NONCE_BYTES = 12
_SALT = b"after-sunday-app-settings-v1"
_ITERATIONS = 600_000

_warned_no_secret = False


class DecryptionError(Exception):
    """A stored value cannot be decrypted (e.g. SECRET_KEY changed)."""


def _derive_key(secret: str) -> bytes:
    return pbkdf2_hmac(
        "sha256", secret.encode("utf-8"), _SALT, _ITERATIONS, dklen=32
    )


def encrypt_value(plaintext: str) -> str:
    """Encrypt a value for storage, or return it unchanged when no key is set."""
    global _warned_no_secret

    secret = get_settings().secret_key
    if not secret:
        if not _warned_no_secret:
            _warned_no_secret = True
            print(
                "[crypto] No SECRET_KEY set — storing sensitive settings in "
                "plaintext (dev only). Set SECRET_KEY in api/.env to encrypt "
                "them at rest."
            )
        return plaintext

    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = AESGCM(_derive_key(secret)).encrypt(
        nonce, plaintext.encode("utf-8"), None
    )
    return PREFIX + base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_value(stored: str) -> str:
    """Decrypt a stored value; returns plaintext unchanged when not encrypted."""
    if not stored.startswith(PREFIX):
        return stored

    secret = get_settings().secret_key
    if not secret:
        raise DecryptionError(
            "Encrypted setting found but no SECRET_KEY is configured."
        )

    try:
        raw = base64.b64decode(stored[len(PREFIX):])
        nonce, ciphertext = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
        return (
            AESGCM(_derive_key(secret))
            .decrypt(nonce, ciphertext, None)
            .decode("utf-8")
        )
    except DecryptionError:
        raise
    except Exception as exc:  # InvalidTag, base64, or malformed input
        raise DecryptionError(
            "Could not decrypt setting (SECRET_KEY changed?)"
        ) from exc
