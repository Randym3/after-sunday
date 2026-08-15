"""Storage abstraction with a local-disk backend for development."""

from __future__ import annotations

import abc
import os
import shutil
from pathlib import Path

from app.config import get_settings


class StorageBackend(abc.ABC):
    """Interface for storing and retrieving uploaded files."""

    @abc.abstractmethod
    def write_chunk(self, storage_key: str, chunk: bytes, offset: int) -> None:
        """Write a chunk of data at the given byte offset."""

    @abc.abstractmethod
    def save(self, storage_key: str, data: bytes) -> None:
        """Write a complete file in one call (small files like the org logo)."""

    @abc.abstractmethod
    def delete(self, storage_key: str) -> None:
        """Remove a stored file."""

    @abc.abstractmethod
    def retrieve(self, storage_key: str) -> Path | bytes | None:
        """Get a file as a Path (for dev serving) or bytes. None if not found."""

    @abc.abstractmethod
    def public_url(self, storage_key: str) -> str:
        """Return a URL that browsers can use to fetch the file."""

    @property
    def backend_name(self) -> str:
        """Short identifier for the backend (e.g. 'local_disk')."""
        return "unknown"

    @property
    def location(self) -> str:
        """Human-readable description of where files are stored."""
        return "unknown"


class LocalDiskBackend(StorageBackend):
    """Stores files under a local directory (dev only)."""

    backend_name = "local_disk"

    def __init__(self, root_dir: str = "storage") -> None:
        # Resolve relative to the API directory (where alembic.ini lives).
        self._root = Path(__file__).resolve().parent.parent / root_dir
        self._root.mkdir(parents=True, exist_ok=True)

    # -- helpers ------------------------------------------------------------

    def _key_to_path(self, storage_key: str) -> Path:
        # Sanitize: only allow a single path segment (no traversal).
        safe_key = os.path.basename(storage_key) or storage_key
        return self._root / safe_key

    # -- public API ---------------------------------------------------------

    def write_chunk(self, storage_key: str, chunk: bytes, offset: int) -> None:
        path = self._key_to_path(storage_key)
        with path.open("r+b" if path.exists() else "wb") as f:
            f.seek(offset)
            f.write(chunk)

    def save(self, storage_key: str, data: bytes) -> None:
        path = self._key_to_path(storage_key)
        with path.open("wb") as f:
            f.write(data)

    @property
    def location(self) -> str:
        return str(self._root)

    def delete(self, storage_key: str) -> None:
        path = self._key_to_path(storage_key)
        if path.exists():
            path.unlink()

    def retrieve(self, storage_key: str) -> Path | None:
        path = self._key_to_path(storage_key)
        return path if path.exists() else None

    def public_url(self, storage_key: str) -> str:
        return f"/media/{storage_key}"


# Singleton — local-disk for now. Swap to an S3 backend with boto3 when
# deploying to production (same signatures, different impl).
_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        _storage = LocalDiskBackend(root_dir=get_settings().storage_root)
    return _storage
