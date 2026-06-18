"""
Consultation Summarizer v1 — faithful summarizer contract (spec §4/§7/§10).

This module owns three things, independent of the OpenAI transport:
  - SUMMARY_PROMPT          (§7 faithful-summarizer system prompt)
  - SUMMARY_JSON_SCHEMA     (§4 strict structured-output schema)
  - validate_summary(...)   (§10 validation + graceful enum fallback)

Faithful-only: no invented astrology, no new advice, third-person client report.
"""
from __future__ import annotations

import json
from typing import Any, Dict

SCHEMA_VERSION = "1.0"

# ── Allowed enum sets (spec §5) ─────────────────────────────────────────────
CONSULTATION_TYPES = {
    "natal", "synastry", "solar", "transits", "progressions", "relocation",
    "rectification", "horary", "compatibility", "general_consultation", "other", "unknown",
}
KEY_POINT_CATEGORIES = {
    "client_question", "life_context", "astrological_focus",
    "guidance_given", "decision_or_plan", "follow_up", "sensitive",
}
MEMORY_CATEGORIES = {
    "relationship", "career", "money", "family", "health_wellbeing", "relocation",
    "education", "spiritual_practice", "timing", "follow_up", "other",
}
MENTIONED_BY = {"client", "astrologer", "both"}
OPEN_Q_REASONS = {
    "unclear_transcript_fragment", "ambiguous_statement",
    "incomplete_context", "unresolved_topic",
}
OPEN_Q_MENTIONED_BY = {"client", "astrologer", "both", "unknown"}


class SummaryValidationError(ValueError):
    """Raised when the LLM output fails a structural §10 check (not an enum slip)."""


# ── §7 faithful-summarizer prompt ───────────────────────────────────────────
SUMMARY_PROMPT = """You are an expert consultation summarizer for a professional astrology software product.

Your task is to analyze an astrology consultation transcript and return a structured JSON object.

You are operating ONLY as a faithful summarizer.
Do not act as an astrologer.
Do not add new astrological interpretations.
Do not add advice, predictions, psychological explanations, or conclusions that were not actually discussed in the transcript.

When an astrological term, chart factor, technique, planet, house, aspect, transit, or timing method is important to the meaning of the consultation and was explicitly named in the transcript, include its name together with the context in which it was discussed. Do not create a separate exhaustive inventory of all astrological terms mentioned.

Before writing the output, identify the astrologer's language style, tone of voice, terminology level, and way of explaining things from the transcript. Use the astrologer's terminology, level of detail, tone, and explanatory style in the client_facing_report, while cleaning up spoken-language artifacts and keeping the report clear and structured.

The full transcript is stored separately as the source of truth.
Your JSON output is an extracted structured layer for quick review, client-facing reporting, and saving concise consultation records into the client's history.

memory_entries_to_append is a list of concise records from this consultation that should be saved in the client's history for future reference by the astrologer. Each entry should capture one durable or future-relevant fact, topic, event, concern, decision, period, relationship context, or follow-up point discussed in this session.

Use the provided SESSION_ID and CLIENT_ID exactly as given.
Do not infer, modify, or invent them.

Write the client_facing_report in third person about the client. Do not address the client directly. Do not use "you".

Return ONLY a valid JSON object. No markdown. No comments. No extra text.

Field rules:
- session.consultation_types: only types clearly present; if unclear use ["unknown"].
- session.language: main language code of the consultation, e.g. "ru", "en", "es".
- session_summary.brief: 3-5 sentences. session_summary.detailed: 2-5 paragraphs.
- client_facing_report.review_required: always true.
- key_points: up to 15, only meaningful ones, no duplicates.
- memory_entries_to_append: usually at least one; if little durable info, one entry summarizing the main focus.
- open_questions_or_unclear_items: unclear/ambiguous/unresolved fragments; do not guess meaning; empty array if none.
- Keep all generated text in the same language as the consultation. Preserve uncertainty. Invent nothing.

Input:
SESSION_ID: {session_id}
CLIENT_ID: {client_id}
TRANSCRIPT:
{transcript}
"""


def build_prompt(session_id: str, client_id: str, transcript: str) -> str:
    return SUMMARY_PROMPT.format(session_id=session_id, client_id=client_id, transcript=transcript)


# ── §4 strict JSON schema (OpenAI structured output) ────────────────────────
def _obj(props: Dict[str, Any], required: list) -> Dict[str, Any]:
    return {"type": "object", "properties": props, "required": required, "additionalProperties": False}


SUMMARY_JSON_SCHEMA: Dict[str, Any] = _obj(
    {
        "schema_version": {"type": "string"},
        "session": _obj(
            {
                "session_id": {"type": "string"},
                "client_id": {"type": "string"},
                "consultation_types": {"type": "array", "items": {"type": "string", "enum": sorted(CONSULTATION_TYPES)}},
                "language": {"type": "string"},
            },
            ["session_id", "client_id", "consultation_types", "language"],
        ),
        "session_summary": _obj(
            {"brief": {"type": "string"}, "detailed": {"type": "string"}},
            ["brief", "detailed"],
        ),
        "client_facing_report": _obj(
            {"text": {"type": "string"}, "review_required": {"type": "boolean"}},
            ["text", "review_required"],
        ),
        "key_points": {
            "type": "array",
            "items": _obj(
                {
                    "category": {"type": "string", "enum": sorted(KEY_POINT_CATEGORIES)},
                    "text": {"type": "string"},
                    "mentioned_by": {"type": "string", "enum": sorted(MENTIONED_BY)},
                },
                ["category", "text", "mentioned_by"],
            ),
        },
        "memory_entries_to_append": {
            "type": "array",
            "items": _obj(
                {
                    "category": {"type": "string", "enum": sorted(MEMORY_CATEGORIES)},
                    "text": {"type": "string"},
                    "mentioned_by": {"type": "string", "enum": sorted(MENTIONED_BY)},
                },
                ["category", "text", "mentioned_by"],
            ),
        },
        "open_questions_or_unclear_items": {
            "type": "array",
            "items": _obj(
                {
                    "text": {"type": "string"},
                    "reason": {"type": "string", "enum": sorted(OPEN_Q_REASONS)},
                    "mentioned_by": {"type": "string", "enum": sorted(OPEN_Q_MENTIONED_BY)},
                },
                ["text", "reason", "mentioned_by"],
            ),
        },
    },
    [
        "schema_version", "session", "session_summary", "client_facing_report",
        "key_points", "memory_entries_to_append", "open_questions_or_unclear_items",
    ],
)


def validate_summary(data: Dict[str, Any], session_id: str, client_id: str) -> Dict[str, Any]:
    """Apply §10. Structural problems raise SummaryValidationError; off-spec enum values
    fall back to a safe default ('unknown'/'other') rather than crash. Returns the
    (possibly corrected) data. session_id/client_id are overwritten to the canonical
    input values (the contract requires an exact echo)."""
    if not isinstance(data, dict):
        raise SummaryValidationError("output is not a JSON object")

    if str(data.get("schema_version")) != SCHEMA_VERSION:
        # accept but normalize — the rest of the contract is what matters
        data["schema_version"] = SCHEMA_VERSION

    session = data.get("session")
    if not isinstance(session, dict):
        raise SummaryValidationError("missing 'session' object")
    # Echo guarantee (spec §5.2/§5.3): force canonical ids.
    session["session_id"] = session_id
    session["client_id"] = client_id
    ct = session.get("consultation_types")
    if not isinstance(ct, list) or not ct:
        session["consultation_types"] = ["unknown"]
    else:
        session["consultation_types"] = [c if c in CONSULTATION_TYPES else "unknown" for c in ct]
    if not isinstance(session.get("language"), str):
        session["language"] = ""

    ss = data.get("session_summary")
    if not isinstance(ss, dict) or "brief" not in ss or "detailed" not in ss:
        raise SummaryValidationError("missing 'session_summary.brief/detailed'")

    cfr = data.get("client_facing_report")
    if not isinstance(cfr, dict) or "text" not in cfr:
        raise SummaryValidationError("missing 'client_facing_report.text'")
    cfr["review_required"] = True  # spec §5.9 — always true

    def _fix_list(key: str, cats: set, mb: set, default_cat: str):
        items = data.get(key)
        if not isinstance(items, list):
            data[key] = []
            return
        clean = []
        for it in items:
            if not isinstance(it, dict) or "text" not in it:
                continue
            it["category"] = it.get("category") if it.get("category") in cats else default_cat
            it["mentioned_by"] = it.get("mentioned_by") if it.get("mentioned_by") in mb else "both"
            clean.append(it)
        data[key] = clean

    _fix_list("key_points", KEY_POINT_CATEGORIES, MENTIONED_BY, "life_context")
    _fix_list("memory_entries_to_append", MEMORY_CATEGORIES, MENTIONED_BY, "other")

    oq = data.get("open_questions_or_unclear_items")
    if not isinstance(oq, list):
        data["open_questions_or_unclear_items"] = []
    else:
        clean = []
        for it in oq:
            if not isinstance(it, dict) or "text" not in it:
                continue
            it["reason"] = it.get("reason") if it.get("reason") in OPEN_Q_REASONS else "ambiguous_statement"
            it["mentioned_by"] = it.get("mentioned_by") if it.get("mentioned_by") in OPEN_Q_MENTIONED_BY else "unknown"
            clean.append(it)
        data["open_questions_or_unclear_items"] = clean

    return data
