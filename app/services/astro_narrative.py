"""
Narrative Analyst (spec §16) — the writing stage, isolated from the tool stage.

What this buys that the master prompt cannot: the narrator has NO tools and no
conversation of tool JSON behind it. It receives validated findings and the
records behind them, and nothing else. It therefore cannot call anything, cannot
misreport a result it half-remembers from six messages ago, and has one job —
register — instead of sharing attention with tool selection.

Whether that is worth an extra completion is an empirical question, not a
doctrinal one: §13 alone already produced structure-first prose in live runs. So
this is gated (ASSISTANT_NARRATIVE_ENABLED) and applies only to broad analytical
turns, where the payoff is plausible and the cost is justified by the answer's
size. A lookup never touches it.
"""
from __future__ import annotations

import json
import os
from typing import Dict, List, Optional, Sequence

from loguru import logger

from app.services.astro_boundary import NON_INTERPRETATION_RULES
from app.services.model_config import model_for

NARRATIVE_ENABLED = os.getenv(
    "ASSISTANT_NARRATIVE_ENABLED", "false").lower() in ("1", "true", "yes")

# Tools whose output is a body of findings worth narrating. A turn that only
# looked something up has nothing for this stage to do.
_ANALYTICAL_TOOLS = frozenset({
    "discover_patterns", "survey_transits", "intersect_forecast_windows",
})

# §7.2 puts this stage on a reasoning model at medium effort. Empty string means
# "plain chat model", which is what the default assistant model wants — a
# reasoning parameter sent to a non-reasoning model is rejected outright.
NARRATIVE_REASONING_EFFORT = os.getenv("ASSISTANT_NARRATIVE_REASONING", "").strip()

# Reasoning tokens are billed from the SAME completion budget and are emitted
# BEFORE any content, so a reasoning stage needs a far larger ceiling than a
# plain one. Measured on this payload: at 1800 the model spent all 1800 on
# reasoning, hit finish_reason=length and returned an EMPTY string; at 8000 it
# reasoned for 267 and wrote the whole report. Reusing the plain ceiling here is
# not a degraded answer, it is no answer at all.
_DEFAULT_TOKENS = "8000" if NARRATIVE_REASONING_EFFORT else "1800"
MAX_NARRATIVE_TOKENS = int(os.getenv("ASSISTANT_NARRATIVE_TOKENS", _DEFAULT_TOKENS))

_SYSTEM = """\
You are the Narrative Analyst for a professional astrologer's data assistant.

You receive validated tool results and derived findings. You do NOT calculate
astrology, you do NOT create new findings, and you do NOT add interpretation.
Your job is to turn objective findings into a coherent professional analytical
narrative.

Narrative order:
1. Scope and parameters — period, method, house system, zodiac, orb profile,
   methodology_version (the short form, never a full hash). Omit a field the data
   does not give you rather than writing "not specified".
2. Executive overview — one short paragraph of PROSE. Never open with a list.
3. Main objective patterns.
4. Time clusters and quiet gaps.
5. Structural observations — repeated targets, houses, rulers, axes.
6. Objective statistics.
7. Detailed supporting records.
8. Technical notes — overrides, incomplete boundaries, truncation, warnings.

Rules:
- Begin with the STRUCTURE of the data, not a list of aspects.
- Say what is concentrated, repeated, longest, most exact or simultaneous.
- Report ONLY numbers present in the data you were given. Every date, orb, count
  and duration must appear in it. If a finding has no record attached, state the
  finding without inventing its detail. Never estimate, never interpolate, never
  continue a series by analogy.
- For a detailed record use the full relationship: "{Transiting body} transiting
  natal house {H} forms a {aspect} to natal {target} in house {T}. Natally
  {transiting body} is a planet of house {its house} and rules house(s) {ruled}."
  Drop a clause whose data is absent.
- Do not overstate. No causal or predictive language.
- If no strong pattern exists, say that activity is distributed without a
  dominant cluster. That is a finding, not a failure.
- Separate facts, derived patterns and technical warnings.
- Omit a section with nothing to say rather than padding it.
- Section names above are labels for you: write every heading in the
  astrologer's language.
- Write in the astrologer's language. No greeting, no restating the question, no
  mention of tools, no closing offer of help.

""" + NON_INTERPRETATION_RULES


def is_analytical_turn(tool_results: Sequence[Dict]) -> bool:
    """True when the turn produced findings worth a dedicated narration pass."""
    return any((t or {}).get("name") in _ANALYTICAL_TOOLS for t in tool_results or [])


def _payload(tool_results: Sequence[Dict]) -> str:
    """Only the analytical results, so the narrator's context is findings, not
    the whole tool transcript."""
    kept = [
        {"tool": t.get("name"), "arguments": t.get("arguments"), "result": t.get("result")}
        for t in tool_results or []
        if (t or {}).get("name") in _ANALYTICAL_TOOLS
    ]
    return json.dumps(kept, ensure_ascii=False, default=str)


def narrate(
    *,
    client,
    tool_results: Sequence[Dict],
    user_question: str,
    locale_line: Optional[str] = None,
    usage=None,
    timeout: float = 60.0,
) -> Optional[str]:
    """Write the analytical report from findings alone. None on any failure.

    Returning None rather than raising is deliberate: the caller already holds a
    serviceable answer from the tool stage, and a narration failure must degrade
    to that rather than costing the astrologer their turn.
    """
    messages: List[Dict] = [{"role": "system", "content": _SYSTEM}]
    if locale_line:
        messages.append({"role": "system", "content": locale_line})
    messages.append({
        "role": "user",
        "content": (
            "The astrologer asked:\n" + (user_question or "").strip()
            + "\n\nValidated findings and records:\n" + _payload(tool_results)
        ),
    })
    # A reasoning model spends part of the budget thinking before it writes, so
    # the ceiling has to cover both or the report gets cut mid-sentence.
    extra: Dict = {}
    if NARRATIVE_REASONING_EFFORT:
        extra["reasoning_effort"] = NARRATIVE_REASONING_EFFORT
    else:
        extra["verbosity"] = "low"
    try:
        response = client.chat.completions.create(
            model=model_for("narrative"),
            messages=messages,
            max_completion_tokens=MAX_NARRATIVE_TOKENS,
            timeout=timeout,
            **extra,
        )
        if usage is not None:
            usage.add(getattr(response, "usage", None))
        text = (response.choices[0].message.content or "").strip()
        return text or None
    except Exception:
        logger.exception("narrative analyst failed; serving the tool-stage answer")
        return None
