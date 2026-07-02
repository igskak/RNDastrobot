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
    + "\n\nDecision rule (be strict — when in doubt, BLOCK):\n"
    "ALLOW only replies stating quantitative or geometric FACTS: counts, orbs, "
    "degrees, speeds, which signs/houses/aspects are present, rankings by a numeric "
    "measure, frequencies, and numeric comparisons.\n"
    "BLOCK any reply that characterizes, qualifies, or ascribes significance — this "
    "includes evaluative words applied to a chart factor such as 'hard', "
    "'challenging', 'difficult', 'tension', 'strong', 'potential', 'brings', "
    "'points to', 'reflects', 'dominates', 'indicates', 'suggests', 'means' — and "
    "any statement about a person, life area, personality, emotion, outcome, or meaning.\n\n"
    "Geometry and motion are DATA, not meaning: angular relationships between "
    "points, retrograde/direct motion, being most-aspected, and ranking highest by "
    "a numeric measure (orb, count, speed) are all ALLOW — even when the sentence "
    "explains the numeric reason ('because it is exact and involves two aspects').\n\n"
    "Examples:\n"
    "ALLOW: 'Mars is the most-aspected body, with 5 exact contacts.'\n"
    "ALLOW: 'Saturn has the tightest orb at 0.03 degrees.'\n"
    "ALLOW: 'Three planets cluster in Leo within a 6-degree span.'\n"
    "ALLOW: 'Two of the eight planets are retrograde.'\n"
    "ALLOW: 'Three charts share identical angular relationships within the tolerance.'\n"
    "ALLOW: 'This transit ranks highest by the weighting model because it is exact "
    "and involves two major aspects.'\n"
    "BLOCK: 'Mars square Saturn is a hard aspect that brings tension.'\n"
    "BLOCK: 'This placement points to challenges in relationships.'\n"
    "BLOCK: 'Saturn dominates the chart, reflecting a disciplined nature.'\n\n"
    "Respond with exactly one word: ALLOW or BLOCK."
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


def classify_reply(reply: str, *, client, model: str, usage=None) -> str:
    """Return VERDICT_ALLOW or VERDICT_BLOCK. Raises on transport/model error so
    the caller can run the fail-closed-soft path (never swallow silently here).

    If a usage accumulator is passed, the judge call's tokens are folded into the
    turn's metrics so per-turn cost accounts for the guardrail, not just the
    assistant model.
    """
    resp = client.chat.completions.create(
        model=model,
        messages=build_judge_messages(reply),
        verbosity="low",
        max_completion_tokens=4,
    )
    if usage is not None:
        usage.add(getattr(resp, "usage", None))
    text = (resp.choices[0].message.content or "").strip().upper()
    return VERDICT_BLOCK if text.startswith("BLOCK") else VERDICT_ALLOW


def heuristic_interpretation(reply: str) -> bool:
    """Deterministic screen for the fail-closed-soft path. True = looks interpretive."""
    return bool(_INTERPRETATION_RE.search(reply or ""))
