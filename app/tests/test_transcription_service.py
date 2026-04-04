from app.services import transcription_service as transcription_module


def test_transcription_service_degrades_when_sdk_missing(monkeypatch):
    monkeypatch.setattr(transcription_module, "aai", None)
    monkeypatch.setattr(transcription_module, "_API_KEY", "test-key")

    service = transcription_module.TranscriptionService()

    assert service.is_configured() is False

    try:
        service.transcribe("https://example.com/audio.mp3")
    except RuntimeError as error:
        assert "not installed" in str(error)
    else:  # pragma: no cover - defensive guard for clearer failure
        raise AssertionError("Expected transcribe() to fail when assemblyai is unavailable")
