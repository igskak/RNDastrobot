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
import re
import time
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

# ── Workspace command tools (PR2) ───────────────────────────────────────────
# The agent can also DRIVE the workspace. These tools are NOT executed on the
# server (workspace state lives in the browser): the loop validates the model's
# intent against these vocabularies, returns a receipt so the model can confirm
# in words, and emits a structured action for the client to apply. Vocabularies
# mirror app/frontend/js/forecast-commands.js — drift here is a bug.
WORKSPACE_LAYER_METHODS = (
    'transit', 'progression', 'direction', 'solar_return', 'synastry_partner')
WHEEL_VIEWS = ('multi', 'single')
HOUSE_SYSTEM_CODES = ('P', 'K', 'O', 'R', 'C', 'E', 'W', 'X', 'H', 'T', 'B', 'M')
STEP_UNITS = ('second', 'minute', 'hour', 'day', 'week', 'month', 'year')
STEP_DIRECTIONS = ('forward', 'backward')
SOLAR_YEAR_MIN, SOLAR_YEAR_MAX = 1900, 2100
STEP_AMOUNT_MIN, STEP_AMOUNT_MAX = 1, 9999

# confirm:'auto'    → client applies immediately (toast + undo).
# confirm:'confirm' → client shows a confirm chip; for destructive commands only.
COMMAND_REGISTRY = {
    'set_transit_date': {'confirm': 'auto'},
    'step_date': {'confirm': 'auto'},
    'add_layer': {'confirm': 'auto'},
    'build_solar': {'confirm': 'auto'},
    'set_solar_year': {'confirm': 'auto'},
    'set_wheel_view': {'confirm': 'auto'},
    'set_house_system': {'confirm': 'auto'},
    'remove_layer': {'confirm': 'confirm'},
    'clear_layers': {'confirm': 'confirm'},
}

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^(\d{2}):(\d{2})(?::(\d{2}))?$")


def _valid_date(value) -> bool:
    if not isinstance(value, str) or not _DATE_RE.match(value):
        return False
    try:
        date_type.fromisoformat(value)
        return True
    except ValueError:
        return False


def _valid_time(value) -> bool:
    if not isinstance(value, str):
        return False
    m = _TIME_RE.match(value)
    if not m:
        return False
    hh, mm = int(m.group(1)), int(m.group(2))
    ss = int(m.group(3)) if m.group(3) else 0
    return hh <= 23 and mm <= 59 and ss <= 59


def _valid_int(value, lo: int, hi: int) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, float) and not value.is_integer():
        return False
    try:
        n = int(value)
    except (TypeError, ValueError):
        return False
    return lo <= n <= hi


def validate_command(name: str, args: Dict) -> str:
    """Return '' if the command args are valid, else a machine error code."""
    if name == 'set_transit_date':
        if not _valid_date(args.get('date')):
            return 'bad_date'
        if args.get('time') is not None and not _valid_time(args.get('time')):
            return 'bad_time'
        return ''
    if name == 'step_date':
        if args.get('unit') not in STEP_UNITS:
            return 'bad_unit'
        if args.get('direction') not in STEP_DIRECTIONS:
            return 'bad_direction'
        if not _valid_int(args.get('amount'), STEP_AMOUNT_MIN, STEP_AMOUNT_MAX):
            return 'bad_amount'
        return ''
    if name == 'add_layer':
        if args.get('method') not in WORKSPACE_LAYER_METHODS:
            return 'bad_method'
        return ''
    if name in ('build_solar', 'set_solar_year'):
        if not _valid_int(args.get('year'), SOLAR_YEAR_MIN, SOLAR_YEAR_MAX):
            return 'bad_year'
        return ''
    if name == 'set_wheel_view':
        if args.get('view') not in WHEEL_VIEWS:
            return 'bad_view'
        return ''
    if name == 'set_house_system':
        if args.get('system') not in HOUSE_SYSTEM_CODES:
            return 'bad_house_system'
        return ''
    if name == 'remove_layer':
        if not args.get('layer_id') and args.get('method') not in WORKSPACE_LAYER_METHODS:
            return 'bad_target'
        return ''
    if name == 'clear_layers':
        return ''
    return 'unknown_command'


def _normalize_command_args(name: str, args: Dict) -> Dict:
    """Echo only the validated, known args (never raw model junk)."""
    if name == 'set_transit_date':
        out = {'date': args['date']}
        if args.get('time') is not None:
            out['time'] = args['time']
        return out
    if name == 'step_date':
        return {'amount': int(args['amount']), 'unit': args['unit'], 'direction': args['direction']}
    if name == 'add_layer':
        return {'method': args['method']}
    if name in ('build_solar', 'set_solar_year'):
        return {'year': int(args['year'])}
    if name == 'set_wheel_view':
        return {'view': args['view']}
    if name == 'set_house_system':
        return {'system': args['system']}
    if name == 'remove_layer':
        if args.get('layer_id'):
            return {'layer_id': str(args['layer_id'])}
        return {'method': args['method']}
    return {}


def handle_command(name: str, raw_args: Dict):
    """Validate a workspace command. Returns (receipt, action|None).

    The server NEVER executes commands — workspace state lives in the browser.
    A valid command yields a structured action for the client and a synthetic
    receipt so the model can confirm in words; an invalid one yields an error
    receipt and no action.
    """
    meta = COMMAND_REGISTRY.get(name)
    if meta is None:
        return {'status': 'error', 'error': f'unknown_command:{name}'}, None
    error = validate_command(name, raw_args or {})
    if error:
        return {'status': 'error', 'error': error}, None
    action = {
        'name': name,
        'args': _normalize_command_args(name, raw_args or {}),
        'confirm': meta['confirm'],
    }
    return {'status': 'applied_clientside', 'command': name}, action


def build_command_tools() -> List[Dict]:
    """Command tool schemas (client-applied). Enums mirror forecast-commands.js."""
    methods = sorted(WORKSPACE_LAYER_METHODS)

    def fn(name, description, properties, required=None):
        schema = {'type': 'object', 'properties': properties, 'additionalProperties': False}
        if required:
            schema['required'] = required
        return {'type': 'function', 'function': {
            'name': name, 'description': description, 'parameters': schema}}

    return [
        fn('set_transit_date',
           "Set the transit/prognostic date on the active chart's selected layer.",
           {'date': {'type': 'string', 'description': 'YYYY-MM-DD'},
            'time': {'type': 'string', 'description': 'HH:mm or HH:mm:ss (optional)'}},
           ['date']),
        fn('step_date',
           'Move the current transit date forward or backward by N units.',
           {'amount': {'type': 'integer', 'minimum': STEP_AMOUNT_MIN, 'maximum': STEP_AMOUNT_MAX},
            'unit': {'type': 'string', 'enum': sorted(STEP_UNITS)},
            'direction': {'type': 'string', 'enum': sorted(STEP_DIRECTIONS)}},
           ['amount', 'unit', 'direction']),
        fn('add_layer', 'Add a prognostic layer to the workspace.',
           {'method': {'type': 'string', 'enum': methods}}, ['method']),
        fn('build_solar', 'Build and show a solar return for a year.',
           {'year': {'type': 'integer', 'minimum': SOLAR_YEAR_MIN, 'maximum': SOLAR_YEAR_MAX}},
           ['year']),
        fn('set_solar_year', 'Change the solar-return year.',
           {'year': {'type': 'integer', 'minimum': SOLAR_YEAR_MIN, 'maximum': SOLAR_YEAR_MAX}},
           ['year']),
        fn('set_wheel_view',
           'Switch the wheel between multi (natal + rings) and single (natal only).',
           {'view': {'type': 'string', 'enum': sorted(WHEEL_VIEWS)}}, ['view']),
        fn('set_house_system',
           'Change the house system (single-letter Swiss Ephemeris code).',
           {'system': {'type': 'string', 'enum': sorted(HOUSE_SYSTEM_CODES)}}, ['system']),
        fn('remove_layer',
           'Remove a prognostic layer by method (all instances) or layer_id (one). Destructive.',
           {'method': {'type': 'string', 'enum': methods},
            'layer_id': {'type': 'string'}}),
        fn('clear_layers',
           'Remove all prognostic layers, leaving the natal chart. Destructive.',
           {}),
    ]

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


def _elapsed_ms(started: float) -> int:
    """Wall-clock milliseconds since a perf_counter() reading."""
    return int((time.perf_counter() - started) * 1000)


class _UsageAccumulator:
    """Sums OpenAI token usage across every model call in one chat turn.

    A single turn can fan out into several completions (one per tool
    iteration), so per-turn cost is only visible by accumulating them.
    """

    __slots__ = ("prompt_tokens", "completion_tokens", "total_tokens", "calls")

    def __init__(self) -> None:
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.total_tokens = 0
        self.calls = 0

    def add(self, usage) -> None:
        if usage is None:
            return
        self.prompt_tokens += getattr(usage, "prompt_tokens", 0) or 0
        self.completion_tokens += getattr(usage, "completion_tokens", 0) or 0
        self.total_tokens += getattr(usage, "total_tokens", 0) or 0
        self.calls += 1

    def as_metrics(self, *, iterations: int, latency_ms: int, model: str) -> Dict:
        return {
            "model": model,
            "iterations": iterations,
            "model_calls": self.calls,
            "latency_ms": latency_ms,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }

_SYSTEM_PROMPT = """\
You are a computational assistant for a professional astrologer who is working \
with a specific chart on screen (the "active chart"). Answer their data questions \
about that chart — when transiting bodies form aspects to natal objects, how many \
times an aspect perfects, retrograde motion and stations — by calling the provided \
tools. You do NOT perform astronomy yourself and you NEVER invent dates, degrees, \
or counts: every number must come from a tool result.

You can also CHANGE the workspace by calling command tools (set_transit_date, \
step_date, add_layer, build_solar, set_solar_year, set_wheel_view, set_house_system, \
remove_layer, clear_layers). Command rules:
- Call a command ONLY when the astrologer explicitly asks to change, build, add, move, \
remove, or show something. A plain question must NEVER trigger a command — answer it \
with a query tool or words instead.
- After a command is accepted, confirm in one short phrase exactly what changed \
(e.g. "Добавил транзиты на 14 марта"); never invent values the command did not set.
- remove_layer and clear_layers are destructive — call them only on an explicit removal request.

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
  - For every contact always show `Вход`, every `Точно` pass in chronological order, \
and `Выход`. Mark each exact pass compactly as `D` (direct) or `R` (retrograde).
  - If a contact has no exact pass, show `Точно: нет` and its closest approach.
  - Mark incomplete entry/exit boundaries when `enter_complete`/`leave_complete` is false.
  - Include `Станция R/D` only when a station occurs inside the contact and therefore \
explains repeated passes or a change of motion.
  - Do not repeat a planet's motion as a separate fact when it is already shown next \
to the exact pass; mention motion outside aspect results only when relevant to the question.
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


def build_query_tools() -> List[Dict]:
    """Deterministic, server-executed query tools. Enums come from shared vocab."""
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


def build_tools() -> List[Dict]:
    """All tool schemas: deterministic query tools + workspace command tools."""
    return build_query_tools() + build_command_tools()


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
        actions: List[Dict] = []
        iterations = 0
        usage = _UsageAccumulator()
        started = time.perf_counter()

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
            usage.add(getattr(response, "usage", None))
            msg = response.choices[0].message
            if not getattr(msg, "tool_calls", None):
                return {
                    "reply": msg.content or "",
                    "tool_results": tool_results,
                    "actions": actions,
                    "iterations": iterations,
                    "max_iterations_reached": False,
                    "metrics": usage.as_metrics(
                        iterations=iterations,
                        latency_ms=_elapsed_ms(started),
                        model=_MODEL,
                    ),
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
                name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                # Command tools are applied by the client, not the server: validate
                # the intent, collect the action, and hand the model a receipt.
                if name in COMMAND_REGISTRY:
                    result, action = handle_command(name, args)
                    if action is not None:
                        actions.append(action)
                else:
                    result = self._dispatch(name, args, user_id)
                tool_results.append({"name": name, "arguments": args, "result": result})
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
        usage.add(getattr(final, "usage", None))
        return {
            "reply": final.choices[0].message.content or "",
            "tool_results": tool_results,
            "actions": actions,
            "iterations": iterations,
            "max_iterations_reached": True,
            "metrics": usage.as_metrics(
                iterations=iterations,
                latency_ms=_elapsed_ms(started),
                model=_MODEL,
            ),
        }
