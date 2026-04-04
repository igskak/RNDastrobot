"""
OpenAI service — consultation summary and key-points extraction.
"""
import json
import os
from typing import Optional

from loguru import logger
from openai import OpenAI

_API_KEY = os.getenv("OPENAI_API_KEY", "")
_MODEL   = os.getenv("OPENAI_SUMMARY_MODEL", "gpt-4.1")

_SYSTEM_PROMPT = """You are an expert astrology consultation assistant.
Your task is to analyze a consultation transcript and produce structured notes.

Respond ONLY with a valid JSON object — no markdown, no extra text — using exactly this structure:
{
  "summary_text": "2-4 paragraph summary of the consultation topics, insights and guidance given",
  "key_points": [
    "Concise bullet-point insight #1 about the client",
    "Concise bullet-point insight #2 about the client"
  ],
  "client_facing_summary": "1-2 paragraph warm summary written for the client to keep as a reminder of the session"
}

Guidelines:
- key_points should be actionable or meaningful observations about the client (3-7 items)
- client_facing_summary should be encouraging and personal, written in second person ("You discussed…")
- Keep all text in the same language the consultation was conducted in
"""


class OpenAIService:

    def __init__(self) -> None:
        self._client: Optional[OpenAI] = None

    def is_configured(self) -> bool:
        return bool(_API_KEY)

    def _get_client(self) -> OpenAI:
        if self._client is None:
            self._client = OpenAI(api_key=_API_KEY)
        return self._client

    def summarize_consultation(
        self,
        transcript_text: str,
        segments: list,
        astrologer_name: str = "the astrologer",
        client_name: str = "the client",
    ) -> dict:
        """
        Returns { summary_text, key_points, client_facing_summary }.
        Falls back to a minimal dict on failure.
        """
        if not self.is_configured():
            raise RuntimeError("OPENAI_API_KEY not configured")

        # Build a speaker-labelled transcript string if segments available
        if segments:
            lines = []
            for seg in segments:
                speaker_label = astrologer_name if seg["speaker"] == "A" else client_name
                lines.append(f"{speaker_label}: {seg['text']}")
            formatted = "\n".join(lines)
        else:
            formatted = transcript_text

        user_prompt = (
            f"Astrologer: {astrologer_name}\n"
            f"Client: {client_name}\n\n"
            f"Transcript:\n{formatted}"
        )

        logger.info(f"Sending transcript to {_MODEL} for summarization…")
        client = self._get_client()

        response = client.chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)
        logger.info("Summary generation complete")
        return result


openai_service = OpenAIService()
