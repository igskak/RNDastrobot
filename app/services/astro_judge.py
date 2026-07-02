"""
Layer-3 interpretation judge (chat-v2).

Classifies a FINAL assistant reply as allowed (data/analysis only) or blocked
(contains astrological interpretation), citing the single-source rubric in
astro_boundary. Provider-agnostic: the caller passes the client + model
(model_for('judge')). Separate from the deterministic numbers guard.

Also provides a deterministic keyword screen for the fail-closed-SOFT path
(CQ-1): when the judge LLM is unavailable, a clean heuristic result serves with a
degraded flag; a tripped heuristic still blocks the obvious cases. The heuristic
is a rough net, not the guarantee — the judge is.

NOTE: not yet wired into finalize_reply()/the loop — grows additively first.
"""
from __future__ import annotations

import re

from app.services.astro_boundary import NON_INTERPRETATION_RULES

VERDICT_ALLOW = "allow"
VERDICT_BLOCK = "block"

_JUDGE_SYSTEM = (
    "You are a strict compliance classifier for an astrology DATA assistant.\n\n"
    + NON_INTERPRETATION_RULES
    + "\n\nYou are given the assistant's reply. Respond with exactly one word:\n"
    "ALLOW  — the reply reports only data, calculations, comparisons, rankings, "
    "frequencies, or objective summaries.\n"
    "BLOCK  — the reply contains ANY astrological interpretation, assigned meaning, "
    "prediction, psychological inference, or real-world association.\n"
    "Answer with ALLOW or BLOCK and nothing else."
)

# Rough deterministic net for the judge-unavailable path only. Tuned to catch the
# obvious interpretation signals without false-positiving on technical data.
_INTERPRETATION_RE = re.compile(
    r"\b(indicat\w+|suggest\w+|represent\w+|likely to|predict\w+|personality|"
    r"psychological|emotional|life event|should\s+(explore|focus|look))\b",
    re.IGNORECASE,
)


def build_judge_messages(reply: str):
    """The judge chat messages for a reply (exposed for testing + reuse)."""
    return [
        {"role": "system", "content": _JUDGE_SYSTEM},
        {"role": "user", "content": reply or ""},
    ]


def classify_reply(reply: str, *, client, model: str) -> str:
    """Return VERDICT_ALLOW or VERDICT_BLOCK. Raises on transport/model error so
    the caller can run the fail-closed-soft path (never swallow silently here)."""
    resp = client.chat.completions.create(
        model=model,
        messages=build_judge_messages(reply),
        verbosity="low",
        max_completion_tokens=4,
    )
    text = (resp.choices[0].message.content or "").strip().upper()
    return VERDICT_BLOCK if text.startswith("BLOCK") else VERDICT_ALLOW


def heuristic_interpretation(reply: str) -> bool:
    """Deterministic screen for the fail-closed-soft path. True = looks interpretive."""
    return bool(_INTERPRETATION_RE.search(reply or ""))
