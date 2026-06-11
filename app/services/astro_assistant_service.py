"""
Astro assistant service — the OpenAI function-calling agent for the astrologer.

The model never does astronomy: it selects tools and narrates. Deterministic
services compute every number. The active chart's ``user_id`` is bound from the
request context and injected into tool calls — it is NEVER a model-controlled
argument, so the model cannot read other clients' charts.

Distinct from openai_service (the consultation-summary singleton); shares only
the client via openai_service.get_openai_client.
"""
from __future__ import annotations

import json
import os
from datetime import date as date_type
from typing import Callable, Dict, List, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy.orm import Session

from app.services.openai_service import get_openai_client, is_openai_configured
from app.services.transit_service import TransitService
from app.utils.constants import PLANETS, SPECIAL_POINTS
from app.utils.ephemeris import get_ephemeris_path

# Deterministic vocabularies (single source for tool-schema enums AND the
# route's request validation). Built from constants so they never drift.
_PLANET_NAMES = frozenset(PLANETS.values())
_ANGLE_NAMES = frozenset({'ASC', 'MC', 'IC', 'DSC', 'Vertex', 'AntiVertex'})
TRANSIT_BODY_NAMES = _PLANET_NAMES | frozenset(
    {'TrueNorthNode', 'TrueSouthNode', 'BlackMoon', 'WhiteMoon'})
NATAL_BODY_NAMES = _PLANET_NAMES | frozenset(SPECIAL_POINTS.keys()) | _ANGLE_NAMES
# Mirrors database/seeds/02_aspect_types.sql (ref_aspect_types).
ASPECT_TYPE_NAMES = frozenset({
    'Conjunction', 'Sextile', 'Square', 'Trine', 'Opposition',
    'Vigintile', 'Semi_Nonagon', 'Semisextile', 'Decile', 'Nonagon',
    'Semisquare', 'Quintile', 'Binonagon', 'Sentagon', 'Tridecile',
    'Sesquiquadrate', 'Biquintile', 'Quincunx',
})

# Cost controls — hard requirements, not knobs (per plan review).
MAX_TOOL_ITERATIONS = 5
REQUEST_TIMEOUT_S = 60.0
MAX_COMPLETION_TOKENS = 300
_MODEL = os.getenv("OPENAI_ASSISTANT_MODEL", "gpt-5.4-mini")

# Broad overview windows used only when the model omits period intent entirely.
_FAST_TRANSIT_BODIES = frozenset({'Moon', 'Sun', 'Mercury', 'Venus', 'Mars'})
_DEFAULT_OVERVIEW_YEARS = {
    'fast': 1,
    'slow': 10,
}


def _shift_years(value: date_type, years: int) -> date_type:
    """Shift by calendar years, clamping leap day to February 28."""
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return value.replace(year=value.year + years, day=28)

_SYSTEM_PROMPT = """\
You are a computational assistant for a professional astrologer who is working \
with a specific chart on screen (the "active chart"). Answer their data questions \
about that chart — when transiting bodies form aspects to natal objects, how many \
times an aspect perfects, retrograde motion and stations — by calling the provided \
tools. You do NOT perform astronomy yourself and you NEVER invent dates, degrees, \
or counts: every number must come from a tool result.

Rules:
- The active chart is fixed by the system; do not ask which chart or pass any id.
- Always state the time window the result covers, and whether the search auto-expanded.
- Choose the search window from the astrologer's intent:
  1. Preserve any explicit period or dates exactly.
  2. "Next/when will" means mode=next_contact from the active forecast date.
  3. A general overview with no direction or period means a symmetric window around \
the active forecast date: ±1 year for Moon/Sun/Mercury/Venus/Mars and ±10 years for \
slower bodies. This is intentionally broad enough to show rare slow-planet contacts.
- Report exact-pass counts faithfully (a retrograde loop can perfect 3 times); if a \
contact never perfects, say it was a close approach without an exact aspect.
- Structure aspect results for quick scanning, following the timeline hover format:
  - Start with one short heading naming the transit, aspect, natal object, and window.
  - Render every contact as its own numbered block; never merge separate contacts.
  - For every contact always show `Вход`, every `Точно` pass in chronological order \
with direct/retrograde motion, and `Выход`.
  - If a contact has no exact pass, show `Точно: нет` and its closest approach.
  - Mark incomplete entry/exit boundaries when `enter_complete`/`leave_complete` is false.
  - Include stations only when present.
- Ask one short clarifying question only when multiple materially different intents \
remain after applying the rules above.
- Keep the final answer extremely compact and information-dense:
  - Start directly with the result; no greeting, preamble, or conclusion.
  - Do not restate the question or explain that you used tools.
  - Avoid generic AI phrases, filler, advice, and interpretation not requested.
  - Prefer short headings and bullets. Include only the window, entry/exact/exit dates, \
motion, stations, and a brief caveat when materially relevant.
  - Use at most 80 words unless more space is required to list every contact and pass.
- Reply in the astrologer's language."""


def build_tools() -> List[Dict]:
    """OpenAI tool schemas. Enums come from the shared vocabularies above."""
    return [{
        "type": "function",
        "function": {
            "name": "find_aspect_passes",
            "description": (
                "Find when a transiting body forms an aspect to a natal object in "
                "the active chart: enter/each exact crossing/leave, motion per pass, "
                "and station dates. Orbs use the astrologer's configured settings."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "transit_body": {"type": "string", "enum": sorted(TRANSIT_BODY_NAMES)},
                    "natal_body": {"type": "string", "enum": sorted(NATAL_BODY_NAMES)},
                    "aspect_type": {"type": "string", "enum": sorted(ASPECT_TYPE_NAMES)},
                    "timezone": {
                        "type": "string",
                        "description": "IANA timezone; omit to use the chart's timezone.",
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["next_contact", "window"],
                        "description": "next_contact auto-expands forward; window uses an explicit range.",
                    },
                    "start_date": {"type": "string", "description": "YYYY-MM-DD (window mode)."},
                    "end_date": {"type": "string", "description": "YYYY-MM-DD (window mode)."},
                    "anchor_date": {"type": "string", "description": "YYYY-MM-DD (next_contact anchor)."},
                    "max_expansion_days": {"type": "integer"},
                },
                "required": ["transit_body", "natal_body", "aspect_type"],
                "additionalProperties": False,
            },
        },
    }]


class AstroAssistantService:
    def __init__(
        self,
        db_session: Session,
        *,
        default_timezone: str = "UTC",
        default_anchor_date: Optional[date_type] = None,
    ):
        self.db = db_session
        self.default_timezone = default_timezone
        self.default_anchor_date = default_anchor_date or date_type.today()
        self._transit_service: Optional[TransitService] = None

    def _transits(self) -> TransitService:
        if self._transit_service is None:
            self._transit_service = TransitService(
                db_session=self.db, ephe_path=get_ephemeris_path())
        return self._transit_service

    # --- tool execution -------------------------------------------------

    def _resolve_aspect_window(self, args: Dict) -> Dict:
        """Apply deterministic overview defaults only when period intent is absent."""
        resolved = dict(args)
        if any(resolved.get(key) is not None for key in (
            "mode", "start_date", "end_date", "anchor_date", "max_expansion_days",
        )):
            return resolved

        years = _DEFAULT_OVERVIEW_YEARS[
            'fast' if resolved.get("transit_body") in _FAST_TRANSIT_BODIES else 'slow'
        ]
        resolved.update({
            "mode": "window",
            "start_date": _shift_years(self.default_anchor_date, -years).isoformat(),
            "end_date": _shift_years(self.default_anchor_date, years).isoformat(),
        })
        return resolved

    def _exec_find_aspect_passes(self, user_id: UUID, args: Dict) -> Dict:
        def _parse_date(value):
            return date_type.fromisoformat(value) if value else None

        args = self._resolve_aspect_window(args)
        mode = args.get("mode", "next_contact")
        return self._transits().find_aspect_passes(
            user_id=user_id,
            transit_body=args["transit_body"],
            natal_body=args["natal_body"],
            aspect_type=args["aspect_type"],
            timezone=args.get("timezone") or self.default_timezone,
            anchor_date=_parse_date(args.get("anchor_date")),
            start_date=_parse_date(args.get("start_date")) if mode == "window" else None,
            end_date=_parse_date(args.get("end_date")) if mode == "window" else None,
            max_expansion_days=args.get("max_expansion_days"),
        )

    def _dispatch(self, name: str, args: Dict, user_id: UUID) -> Dict:
        handlers: Dict[str, Callable[[UUID, Dict], Dict]] = {
            "find_aspect_passes": self._exec_find_aspect_passes,
        }
        handler = handlers.get(name)
        if handler is None:
            return {"status": "error", "error": f"unknown_tool:{name}"}
        try:
            return handler(user_id, args)
        except ValueError as e:
            return {"status": "error", "error": str(e)}
        except Exception:
            logger.exception("assistant tool '%s' failed", name)
            return {"status": "error", "error": "tool_execution_failed"}

    # --- agent loop -----------------------------------------------------

    def chat(self, user_id: UUID, messages: List[Dict]) -> Dict:
        """
        Run the function-calling loop for the active chart (user_id).

        ``messages`` is the prior conversation as [{role, content}, …].
        Returns {reply, tool_results, iterations, max_iterations_reached}.
        """
        if not is_openai_configured():
            raise RuntimeError("OPENAI_API_KEY not configured")

        client = get_openai_client()
        tools = build_tools()
        convo: List[Dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]
        convo.extend({"role": m["role"], "content": m.get("content", "")} for m in messages)

        tool_results: List[Dict] = []
        iterations = 0

        while iterations < MAX_TOOL_ITERATIONS:
            iterations += 1
            response = client.chat.completions.create(
                model=_MODEL,
                messages=convo,
                tools=tools,
                tool_choice="auto",
                verbosity="low",
                max_completion_tokens=MAX_COMPLETION_TOKENS,
                timeout=REQUEST_TIMEOUT_S,
            )
            msg = response.choices[0].message
            if not getattr(msg, "tool_calls", None):
                return {
                    "reply": msg.content or "",
                    "tool_results": tool_results,
                    "iterations": iterations,
                    "max_iterations_reached": False,
                }

            convo.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            })
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = self._dispatch(tc.function.name, args, user_id)
                tool_results.append({"name": tc.function.name, "arguments": args, "result": result})
                convo.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })

        # Iteration cap hit — ask the model for a final answer with no more tools.
        final = client.chat.completions.create(
            model=_MODEL,
            messages=convo,
            verbosity="low",
            max_completion_tokens=MAX_COMPLETION_TOKENS,
            timeout=REQUEST_TIMEOUT_S,
        )
        return {
            "reply": final.choices[0].message.content or "",
            "tool_results": tool_results,
            "iterations": iterations,
            "max_iterations_reached": True,
        }
