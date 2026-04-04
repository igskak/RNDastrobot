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


def test_transcription_service_passes_supported_speech_models(monkeypatch):
    monkeypatch.setattr(transcription_module, "_API_KEY", "test-key")

    captured = {}

    class DummySettings:
        api_key = None

    class DummyTranscriptStatus:
        error = "error"

    class DummyTranscript:
        status = "completed"
        error = None
        utterances = []
        text = "ok"

    class DummyTranscriber:
        def transcribe(self, audio_url, config):
            captured["audio_url"] = audio_url
            captured["config"] = config
            return DummyTranscript()

    class DummyAai:
        settings = DummySettings()
        TranscriptStatus = DummyTranscriptStatus

        @staticmethod
        def TranscriptionConfig(**kwargs):
            captured["config_kwargs"] = kwargs
            return kwargs

        @staticmethod
        def Transcriber():
            return DummyTranscriber()

    monkeypatch.setattr(transcription_module, "aai", DummyAai)

    service = transcription_module.TranscriptionService()
    result = service.transcribe("https://example.com/audio.ogg")

    assert result == {"text": "ok", "segments": []}
    assert DummyAai.settings.api_key == "test-key"
    assert captured["audio_url"] == "https://example.com/audio.ogg"
    assert captured["config_kwargs"]["speaker_labels"] is True
    assert captured["config_kwargs"]["language_detection"] is True
    assert captured["config_kwargs"]["speech_models"] == ["universal-3-pro", "universal-2"]
