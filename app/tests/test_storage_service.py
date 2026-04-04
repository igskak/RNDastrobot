import importlib
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def test_storage_service_uses_runtime_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "sb_secret_test_key_123")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "consultation-recordings")

    storage_module = importlib.import_module("app.services.storage_service")
    storage_module = importlib.reload(storage_module)

    calls = {}

    class DummyBucket:
        def create_signed_url(self, storage_path, expires_in):
            calls["signed_url"] = (storage_path, expires_in)
            return {"signedURL": "https://signed.example/audio.ogg"}

    class DummyStorage:
        def from_(self, bucket):
            calls["bucket"] = bucket
            return DummyBucket()

    class DummyClient:
        def __init__(self):
            self.storage = DummyStorage()

    def fake_create_client(url, key):
        calls["client"] = (url, key)
        return DummyClient()

    monkeypatch.setattr(storage_module, "create_client", fake_create_client)

    service = storage_module.StorageService()
    signed_url = service.get_signed_url("astrologer/user/session.ogg", expires_in=7200)

    assert signed_url == "https://signed.example/audio.ogg"
    assert calls["client"] == ("https://project.supabase.co", "sb_secret_test_key_123")
    assert calls["bucket"] == "consultation-recordings"
    assert calls["signed_url"] == ("astrologer/user/session.ogg", 7200)


def test_storage_service_reports_signed_url_context(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "sb_secret_test_key_123")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "consultation-recordings")

    storage_module = importlib.import_module("app.services.storage_service")
    storage_module = importlib.reload(storage_module)

    class DummyBucket:
        def create_signed_url(self, storage_path, expires_in):
            raise RuntimeError("Invalid API key")

    class DummyStorage:
        def from_(self, bucket):
            return DummyBucket()

    class DummyClient:
        def __init__(self):
            self.storage = DummyStorage()

    monkeypatch.setattr(storage_module, "create_client", lambda url, key: DummyClient())

    service = storage_module.StorageService()

    with pytest.raises(RuntimeError) as exc_info:
        service.get_signed_url("astrologer/user/session.ogg")

    message = str(exc_info.value)
    assert "Signed URL request failed" in message
    assert "project.supabase.co" in message
    assert "consultation-recordings" in message
    assert "sb_secret_test" in message
