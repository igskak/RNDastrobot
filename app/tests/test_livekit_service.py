import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def test_start_audio_egress_forces_low_bitrate_opus(monkeypatch):
    """Long calls must stay under the storage upload size limit — the egress
    request should pin a low Opus bitrate (env-configurable) rather than the
    LiveKit default of 128 kbps."""
    import asyncio
    from types import SimpleNamespace

    monkeypatch.setenv("LIVEKIT_URL", "https://livekit.example")
    monkeypatch.setenv("LIVEKIT_API_KEY", "test-key")
    monkeypatch.setenv("LIVEKIT_API_SECRET", "test-secret")
    monkeypatch.setenv("EGRESS_AUDIO_BITRATE_KBPS", "20")

    mod = importlib.reload(importlib.import_module("app.services.livekit_service"))

    captured = {}

    class DummyEgressAPI:
        async def start_room_composite_egress(self, req):
            captured["req"] = req
            return SimpleNamespace(egress_id="EG_test")

    class DummyLiveKitAPI:
        def __init__(self, *args, **kwargs):
            self.egress = DummyEgressAPI()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(mod, "LiveKitAPI", DummyLiveKitAPI)

    egress_id = asyncio.run(
        mod.livekit_service.start_audio_egress(
            room_name="call-x",
            call_session_id="cs1",
            astrologer_id="a1",
            user_id="u1",
        )
    )

    from livekit.api import AudioCodec

    assert egress_id == "EG_test"
    req = captured["req"]
    assert req.audio_only is True
    assert req.advanced.audio_codec == AudioCodec.OPUS
    assert req.advanced.audio_bitrate == 20  # picked up from EGRESS_AUDIO_BITRATE_KBPS
    assert req.file.filepath == "a1/u1/cs1.ogg"


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
