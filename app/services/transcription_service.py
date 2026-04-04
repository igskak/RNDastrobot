"""
AssemblyAI transcription service — speaker-diarized transcription for consultation recordings.
"""
import os
from typing import Optional

from loguru import logger

try:
    import assemblyai as aai
except ModuleNotFoundError:  # pragma: no cover - depends on optional extra
    aai = None

_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")


class TranscriptionService:

    def is_configured(self) -> bool:
        return bool(_API_KEY) and aai is not None

    def transcribe(self, audio_url: str) -> dict:
        """
        Transcribe audio from a URL with speaker diarization.
        Returns { text, segments: [{speaker, text, start_ms, end_ms}] }
        This call blocks until AssemblyAI finishes (polls internally).
        """
        if aai is None:
            raise RuntimeError("assemblyai package is not installed")

        if not self.is_configured():
            raise RuntimeError("ASSEMBLYAI_API_KEY not configured")

        aai.settings.api_key = _API_KEY

        config = aai.TranscriptionConfig(
            speaker_labels=True,
            language_detection=True,
        )
        transcriber = aai.Transcriber()
        logger.info(f"Submitting audio for transcription: {audio_url[:60]}…")

        transcript = transcriber.transcribe(audio_url, config=config)

        if transcript.status == aai.TranscriptStatus.error:
            raise RuntimeError(f"AssemblyAI transcription error: {transcript.error}")

        segments = []
        for utt in (transcript.utterances or []):
            segments.append({
                "speaker": utt.speaker,          # "A", "B", …
                "text": utt.text,
                "start_ms": utt.start,
                "end_ms": utt.end,
            })

        logger.info(f"Transcription complete — {len(segments)} utterances")
        return {
            "text": transcript.text or "",
            "segments": segments,
        }


transcription_service = TranscriptionService()
