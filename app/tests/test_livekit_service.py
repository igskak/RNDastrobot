import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def test_verify_webhook_uses_token_verifier_and_decodes_body(monkeypatch):
    monkeypatch.setenv("LIVEKIT_URL", "https://livekit.example")
    monkeypatch.setenv("LIVEKIT_API_KEY", "test-key")
    monkeypatch.setenv("LIVEKIT_API_SECRET", "test-secret")

    livekit_module = importlib.import_module("app.services.livekit_service")
    livekit_module = importlib.reload(livekit_module)

    calls = {}

    class DummyTokenVerifier:
        def __init__(self, api_key=None, api_secret=None, *, leeway=None):
            calls["verifier"] = (api_key, api_secret, leeway)

    class DummyWebhookReceiver:
        def __init__(self, verifier):
            calls["receiver_verifier"] = verifier

        def receive(self, body, auth_token):
            calls["receive"] = (body, auth_token)
            return {"event": "ok"}

    monkeypatch.setattr(livekit_module, "TokenVerifier", DummyTokenVerifier)

    import livekit.api as livekit_api

    monkeypatch.setattr(livekit_api, "WebhookReceiver", DummyWebhookReceiver)

    result = livekit_module.livekit_service.verify_webhook(b'{"hello":"world"}', "Bearer test")

    assert result == {"event": "ok"}
    assert calls["verifier"][:2] == ("test-key", "test-secret")
    assert calls["receive"] == ('{"hello":"world"}', "Bearer test")
