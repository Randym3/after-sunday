from app.storage import LocalDiskBackend


def test_save_then_retrieve(tmp_path):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    backend.save("organization_logo", b"\x89PNG fake")
    assert backend.retrieve("organization_logo").read_bytes() == b"\x89PNG fake"


def test_save_overwrites_existing(tmp_path):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    backend.save("organization_logo", b"one")
    backend.save("organization_logo", b"two")
    assert backend.retrieve("organization_logo").read_bytes() == b"two"


def test_delete_removes_file(tmp_path):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    backend.save("organization_logo", b"data")
    backend.delete("organization_logo")
    assert backend.retrieve("organization_logo") is None


def test_location_points_at_root(tmp_path):
    backend = LocalDiskBackend(root_dir=str(tmp_path))
    assert backend.location == str(tmp_path)
    assert backend.backend_name == "local_disk"


def test_storage_root_default():
    from app.config import Settings

    settings = Settings(_env_file=None)
    assert settings.storage_root == "storage"
