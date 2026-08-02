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
from datetime import date as date_type, time as time_type
from typing import Callable, Dict, List, Optional, Tuple
from uuid import UUID

from loguru import logger
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.models import Person, User
from app.services.astro_commands import (
    handle_command,
    validate_command,
    _normalize_command_args,
)
from app.services.astro_analysis import analyze as analyze_spec
from app.services.astro_boundary import NON_INTERPRETATION_RULES
from app.services.astro_citation import (
    CITATION_RULE,
    build_citation_index,
    render_citations,
    strip_citation_tokens,
)
from app.services.astro_data_tools import ChartDataset, get_chart_data
from app.services.astro_judge import (
    VERDICT_ALLOW,
    classify_reply,
    heuristic_interpretation,
)
from app.services.astro_provenance import (
    attach_provenance,
    build_methodology_provenance,
)
from app.services.model_config import model_for
from app.services.astro_tool_schemas import (
    build_command_tools,
    build_query_tools,
    build_tools,
)
from app.services.astro_vocab import (
    ASPECT_TYPE_NAMES,
    CHART_REFS,
    COMMAND_REGISTRY,
    DIRECTION_TYPES,
    HOUSE_SYSTEM_CODES,
    NATAL_BODY_NAMES,
    SOLAR_YEAR_MAX,
    SOLAR_YEAR_MIN,
    STEP_AMOUNT_MAX,
    STEP_AMOUNT_MIN,
    STEP_DIRECTIONS,
    STEP_UNITS,
    TRANSIT_BODY_NAMES,
    WHEEL_VIEWS,
    WORKSPACE_LAYER_METHODS,
    _coerce_float,
    _valid_date,
    _valid_int,
    _valid_time,
    _valid_timezone,
    _validate_manual_synastry,
)
from app.services.direction_service import DirectionService
from app.services.natal_chart_service import NatalChartService
from app.services.natal_context import NatalContext
from app.services.openai_service import get_openai_client, is_openai_configured
from app.services.preferences_runtime import PreferencesRuntimeResolver
from app.services.progression_service import ProgressionService
from app.services.transit_service import TransitService
from app.utils.ephemeris import get_ephemeris_path

# Deterministic vocabularies (body/aspect/command enums), the command registry,
# and the pure validators now live in app.services.astro_vocab and are imported
# above. They are re-exported from this module for callers that still import them
# here: the /assistant route and the test suite.


# Cost controls — hard requirements, not knobs (per plan review).
MAX_TOOL_ITERATIONS = 5
REQUEST_TIMEOUT_S = 60.0
MAX_COMPLETION_TOKENS = 300
_MODEL = model_for("assistant")  # env OPENAI_ASSISTANT_MODEL, default gpt-5.4-mini

# Layer-3 judge gate. Off by default so scripted-client tests see the raw loop;
# prod turns it ON (blocking from day one) via env. Doubles as a kill-switch if
# the judge misbehaves in beta.
JUDGE_ENABLED = os.getenv("ASSISTANT_JUDGE_ENABLED", "false").lower() in ("1", "true", "yes")

_CYRILLIC_RE = re.compile(r"[а-яіїєґ]", re.IGNORECASE)
_MULTI_WHEEL_INTENT_RE = re.compile(
    r"("
    r"многослойн\w*(?:\s+\w+){0,2}\s+режим"
    r"|режим(?:\s+\w+){0,2}\s+многослойн\w*"
    r"|мульти\s*кол[её]с\w*"
    r"|много\s*кол[её]с\w*"
    r"|многокольц\w*"
    r"|multi[-\s]?(?:wheel|layer)(?:\s+mode)?"
    r"|multi\s+mode"
    r")",
    re.IGNORECASE,
)
_SINGLE_WHEEL_INTENT_RE = re.compile(
    r"("
    r"одиночн\w*(?:\s+\w+){0,2}\s+режим"
    r"|однослойн\w*(?:\s+\w+){0,2}\s+режим"
    r"|режим(?:\s+\w+){0,2}\s+одиночн\w*"
    r"|только\s+натал\w*"
    r"|single[-\s]?(?:wheel|layer)?(?:\s+mode)?"
    r")",
    re.IGNORECASE,
)
_ADD_LAYER_VERB_RE = re.compile(
    r"\b(add|build|create)\b|добав\w*|созда\w*|постро\w*",
    re.IGNORECASE,
)
_LAYER_METHOD_INTENT_RE = re.compile(
    r"\b(transit|progression|direction|solar|synastry)\b"
    r"|транзит\w*|прогресс\w*|дирекц\w*|соляр\w*|солнечн\w*|синастр\w*",
    re.IGNORECASE,
)

# Broad overview windows used only when the model omits period intent entirely.
_FAST_TRANSIT_BODIES = frozenset({'Moon', 'Sun', 'Mercury', 'Venus', 'Mars'})
_DEFAULT_OVERVIEW_YEARS = {
    'fast': 1,
    'slow': 10,
}
_SUMMARY_ASPECT_LIMIT = 30
_SUMMARY_OBJECT_LIMIT = 24
_SUMMARY_INGRESS_LIMIT = 12


def _last_user_text(messages: List[Dict]) -> str:
    for msg in reversed(messages or []):
        if msg.get("role") == "user":
            return str(msg.get("content") or "")
    return ""


def _requested_wheel_view(messages: List[Dict]) -> Optional[str]:
    text = _last_user_text(messages)
    if not text:
        return None
    if _MULTI_WHEEL_INTENT_RE.search(text):
        return "multi"
    if _SINGLE_WHEEL_INTENT_RE.search(text):
        return "single"
    return None


def _explicit_layer_request(text: str) -> bool:
    return bool(_ADD_LAYER_VERB_RE.search(text) and _LAYER_METHOD_INTENT_RE.search(text))


def _wheel_view_action(view: str) -> Dict:
    return {
        "name": "set_wheel_view",
        "args": {"view": view},
        "confirm": COMMAND_REGISTRY["set_wheel_view"]["confirm"],
    }


def _wheel_view_reply(view: str, messages: List[Dict]) -> str:
    text = _last_user_text(messages)
    if not _CYRILLIC_RE.search(text):
        return (
            "Switched to multi-wheel mode."
            if view == "multi"
            else "Switched to single-wheel mode."
        )
    return (
        "Перешёл в многослойный режим."
        if view == "multi"
        else "Перешёл в одиночный режим."
    )


def _refuse_and_redirect(messages: List[Dict]) -> str:
    """Canned Layer-3 refusal: decline meaning, offer the data. Astrologer's language."""
    if _CYRILLIC_RE.search(_last_user_text(messages)):
        return ("Я не интерпретирую значение конфигураций. Могу привести только данные "
                "и расчёты — скажите, какие показатели показать.")
    return ("I don't interpret what configurations mean. I can report the underlying "
            "data and calculations — tell me which figures to show.")


_LOCALE_LANGUAGE = {"en": "English", "ru": "Russian", "uk": "Ukrainian"}


def _locale_instruction(locale: Optional[str]) -> Optional[str]:
    """A system nudge to reply in the astrologer's UI language by default.

    Fixes the beta bug where the model replied in Russian to an English UI + English
    question. The UI locale is authoritative; only switch if the latest message is
    clearly in another language.
    """
    code = (locale or "").strip().lower()
    if not code:
        return None
    label = _LOCALE_LANGUAGE.get(code, code)
    return (f"The astrologer's interface language is {label}. Write your reply in "
            f"{label} by default. Switch languages only if the astrologer's latest "
            f"message is clearly written in a different language — then match that "
            f"message's language.")


def _coerce_wheel_view_actions(messages: List[Dict], actions: List[Dict]):
    """Protect display-mode intents from being misrouted as layer creation."""
    view = _requested_wheel_view(messages)
    if view is None:
        return actions, None
    if any(
        action.get("name") == "set_wheel_view"
        and action.get("args", {}).get("view") == view
        for action in actions
    ):
        return actions, None

    keep_layers = _explicit_layer_request(_last_user_text(messages))
    corrected = []
    for action in actions:
        name = action.get("name")
        if name == "set_wheel_view":
            continue
        if name == "add_layer" and not keep_layers:
            continue
        corrected.append(action)
    corrected.append(_wheel_view_action(view))
    return corrected, view


def _shift_years(value: date_type, years: int) -> date_type:
    """Shift by calendar years, clamping leap day to February 28."""
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return value.replace(year=value.year + years, day=28)


def _elapsed_ms(started: float) -> int:
    """Wall-clock milliseconds since a perf_counter() reading."""
    return int((time.perf_counter() - started) * 1000)


def _parse_tool_date(value: str) -> date_type:
    if not _valid_date(value):
        raise ValueError("bad_target_date")
    return date_type.fromisoformat(value)


def _parse_tool_time(value) -> Optional[time_type]:
    if value in (None, ""):
        return None
    if not _valid_time(value):
        raise ValueError("bad_target_time")
    return time_type.fromisoformat(str(value))


def _uuid_or_none(value) -> Optional[UUID]:
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _compact_aspect(aspect: Dict, *, left_key: str) -> Dict:
    return {
        "left": aspect.get(left_key),
        "right": aspect.get("natal_object"),
        "aspect": aspect.get("aspect_type"),
        "orb": round(float(aspect.get("orb")), 3)
        if aspect.get("orb") is not None else None,
    }


def _compact_object(obj: Dict) -> Dict:
    return {
        "name": obj.get("name"),
        "sign": obj.get("sign"),
        "degree": obj.get("degree_in_sign_formatted"),
        "longitude": round(float(obj.get("longitude")), 6)
        if obj.get("longitude") is not None else None,
        "house": obj.get("house"),
        "retrograde": bool(obj.get("retrograde")) if obj.get("retrograde") is not None else None,
    }


def _compact_ingress(item: Dict) -> Dict:
    return {
        "body": item.get("body") or item.get("house_number"),
        "type": item.get("ingress_type") or "house_cusp",
        "from": item.get("from_sign") or item.get("from_house"),
        "to": item.get("to_sign") or item.get("to_house"),
        "from_degree": item.get("from_degree_in_sign_formatted"),
        "to_degree": item.get("to_degree_in_sign_formatted"),
    }


def _prompt_text(value, limit: int = 120) -> str:
    text = str(value or "").strip().replace("\n", " ")
    return text[:limit]


def _prompt_count(value) -> Optional[int]:
    if isinstance(value, bool):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def _prompt_aspect_list(items, limit: int = 5) -> List[str]:
    out: List[str] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        primary = _prompt_text(item.get("primary"), 32)
        aspect = _prompt_text(item.get("aspect"), 32)
        target = _prompt_text(item.get("target") or item.get("partner"), 32)
        orb = item.get("orb")
        if primary and aspect and target and isinstance(orb, (int, float)):
            phase = _prompt_text(item.get("phase"), 24)
            phrase = f"{primary} {aspect} {target} orb {float(orb):.2f}"
            if phase:
                phrase += f" {phase}"
            out.append(phrase)
        if len(out) >= limit:
            break
    return out


def _prompt_body_list(items, limit: int = 6) -> List[str]:
    out: List[str] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        name = _prompt_text(item.get("name"), 32)
        degree = _prompt_text(item.get("degree"), 32)
        sign = _prompt_text(item.get("sign"), 24)
        house = item.get("house")
        if name:
            place = degree or sign
            phrase = f"{name} {place}".strip()
            if isinstance(house, (int, float)):
                phrase += f" H{int(house)}"
            if item.get("retrograde") is True:
                phrase += " R"
            out.append(phrase)
        if len(out) >= limit:
            break
    return out


def _prompt_config_parts(config: Dict) -> List[str]:
    if not isinstance(config, dict):
        return []
    parts: List[str] = []
    date_value = config.get("date")
    if isinstance(date_value, str) and _valid_date(date_value):
        moment = date_value
        time_value = config.get("time")
        if isinstance(time_value, str) and _valid_time(time_value):
            moment += f" {time_value}"
        parts.append(f"date={moment}")
    timezone_value = config.get("timezone")
    if isinstance(timezone_value, str) and _valid_timezone(timezone_value):
        parts.append(f"tz={timezone_value}")
    year = config.get("year")
    if isinstance(year, int) and SOLAR_YEAR_MIN <= year <= SOLAR_YEAR_MAX:
        parts.append(f"year={year}")
    direction_type = config.get("directionType")
    if direction_type in DIRECTION_TYPES:
        parts.append(f"direction={direction_type}")
    mode = config.get("mode")
    if mode in ("db", "manual"):
        parts.append(f"source={mode}")
    partner_name = config.get("partnerName")
    if isinstance(partner_name, str) and partner_name.strip():
        parts.append(f"partner={_prompt_text(partner_name, 80)}")
    partner_id = config.get("partnerId")
    if isinstance(partner_id, str) and _uuid_or_none(partner_id):
        parts.append(f"partnerId={partner_id}")
    location = config.get("location")
    if isinstance(location, dict):
        name = _prompt_text(location.get("name"), 80)
        if name:
            parts.append(f"place={name}")
    return parts


def _workspace_resources_parts(resources: Dict) -> List[str]:
    if not isinstance(resources, dict):
        return []
    parts: List[str] = []
    active = resources.get("activeChart")
    if isinstance(active, dict):
        active_bits: List[str] = []
        title = _prompt_text(active.get("title"), 100)
        if title:
            active_bits.append(f"title={title}")
        chart_id = active.get("chartId")
        if isinstance(chart_id, str) and _uuid_or_none(chart_id):
            active_bits.append(f"chartId={chart_id}")
        source = active.get("source")
        if source in ("saved", "inline"):
            active_bits.append(f"source={source}")
        date_value = active.get("date")
        if isinstance(date_value, str) and _valid_date(date_value):
            birth = date_value
            time_value = active.get("time")
            if isinstance(time_value, str) and _valid_time(time_value):
                birth += f" {time_value}"
            active_bits.append(f"birth={birth}")
        timezone_value = active.get("timezone")
        if isinstance(timezone_value, str) and _valid_timezone(timezone_value):
            active_bits.append(f"tz={timezone_value}")
        place = _prompt_text(active.get("place"), 100)
        if place:
            active_bits.append(f"place={place}")
        house = active.get("houseSystem")
        if house in HOUSE_SYSTEM_CODES:
            active_bits.append(f"house={house}")
        zodiac = active.get("zodiac")
        if zodiac in ("tropical", "sidereal"):
            active_bits.append(f"zodiac={zodiac}")
        if active_bits:
            parts.append("active chart resource: " + ", ".join(active_bits))

    layers = resources.get("layers")
    if isinstance(layers, list):
        layer_lines: List[str] = []
        for layer in layers[:10]:
            if not isinstance(layer, dict):
                continue
            method = layer.get("method")
            if method not in WORKSPACE_LAYER_METHODS:
                continue
            bits = [method]
            layer_id = _prompt_text(layer.get("id"), 80)
            if layer_id:
                bits.append(f"id={layer_id}")
            if layer.get("selected") is True:
                bits.append("selected")
            bits.append("ready" if layer.get("ready") is True else "not_ready")
            bits.extend(_prompt_config_parts(layer.get("config") or {}))
            result = layer.get("result")
            if isinstance(result, dict):
                aspect_count = _prompt_count(result.get("aspectCount"))
                body_count = _prompt_count(result.get("bodyCount"))
                if aspect_count is not None:
                    bits.append(f"aspects={aspect_count}")
                if body_count is not None:
                    bits.append(f"bodies={body_count}")
                aspects = _prompt_aspect_list(result.get("tightAspects"))
                if aspects:
                    bits.append("tight=" + "; ".join(aspects))
                bodies = _prompt_body_list(result.get("keyBodies"))
                if bodies:
                    bits.append("bodies=" + "; ".join(bodies))
            layer_lines.append("[" + ", ".join(bits) + "]")
        if layer_lines:
            selected = _prompt_text(resources.get("selectedLayerId"), 80)
            prefix = f"workspace layers resource selected={selected}: " if selected else "workspace layers resource: "
            parts.append(prefix + " ".join(layer_lines))
    return parts


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
times an aspect perfects, retrograde motion and stations, progressions, and \
directions — by calling the provided \
tools. You do NOT perform astronomy yourself and you NEVER invent dates, degrees, \
or counts: every number must come from a tool result.

You can also CHANGE the workspace by calling command tools (set_transit_date, \
step_date, add_layer, build_solar, set_solar_year, set_wheel_view, set_house_system, \
set_synastry_partner, add_client_note, remove_layer, clear_layers). Command rules:
- Call a command ONLY when the astrologer explicitly asks to change, build, add, move, \
remove, or show something. A plain question must NEVER trigger a command — answer it \
with a query tool or words instead.
- After a command is accepted, confirm in one short phrase exactly what changed \
(e.g. "Добавил транзиты на 14 марта"); never invent values the command did not set.
- "Многослойный режим", "мультиколесо", "multi-wheel/multi-layer mode", or requests \
to show rings/layers as a display mode mean set_wheel_view {"view":"multi"}, NOT add_layer. \
"Одиночный режим", "только натал", or "single-wheel mode" mean set_wheel_view {"view":"single"}.
- add_layer is only for an explicit request to add/build a named calculation method \
such as transits, progressions, directions, solar return, or synastry.
- To build synastry with a named person, first call find_chart to resolve the name \
to a chart_id (if several match, ask which one; if none match, say so), then call \
set_synastry_partner with that chart_id and the chart's title.
- To build synastry from manually provided birth data, do NOT call find_chart first. \
If date, time, timezone, and place/coordinates are complete, call set_synastry_partner \
with manual. If any of those are missing, ask only for the missing birth data.
- If the workspace context says an active synastry already exists, answer follow-up \
questions about that synastry from the provided partner and inter-aspect context unless \
the astrologer asks to change the partner.
- Treat workspace resources as the astrologer's current workbench: active chart, selected \
layer, open transit/progression/direction/solar/synastry layers, layer configs, and compact \
calculated results. Use them to resolve pronouns like "эта карта", "этот слой", "текущие \
прогрессии", "то что на экране", and "следующий шаг". Do not ask for data that is already \
present in workspace resources.
- For progressions or directions, call calculate_progression/calculate_direction. \
Use chart_ref="active_chart" for the active natal chart and chart_ref="synastry_partner" \
when the astrologer says "вторая карта", "партнёр", or asks to continue from the \
active synastry. If synastry_partner is in workspace context, do not ask for birth \
data again; use the partner id or manual birth data from workspace. If the tool says \
synastry_partner_missing, ask for the exact missing partner birth data only.
- remove_layer and clear_layers are destructive — call them only on an explicit removal request.
- add_client_note is only for an explicit request to add/write/save a note. Put in note_text \
only the astrologer's note content after removing the command wrapper ("add to notes that ..."). \
Do not summarize, polish, interpret, add IDs, or add screen context; the client adds screen context \
deterministically when it saves the note.

Rules:
- The active chart is fixed by the system; do not ask which chart or pass any id.
- Always state the time window the result covers, and whether the search auto-expanded.
- For multi-step work ("по очереди", "исполняй", "следующий шаг", "продолжай план"), \
use the conversation history and current workspace to continue the next unresolved \
calculation. Do not ask which chart to use when active_chart or synastry_partner can be \
resolved from context. If several requested calculations are available as tools, call \
them sequentially in separate tool calls and summarize completed steps plus the next \
remaining step if the iteration cap stops you.
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
  - Render every contact as its own numbered block, separated by a blank line; never merge separate contacts.
  - For every contact put `Вход`, each `Точно` pass (chronological), and `Выход` each \
on its OWN line so entry/exact/exit never run together. Mark each exact pass compactly \
as `D` (direct) or `R` (retrograde).
  - If a contact has no exact pass, show `Точно: нет` and its closest approach.
  - Mark incomplete entry/exit boundaries when `enter_complete`/`leave_complete` is false.
  - Include `Станция R/D` only when a station occurs inside the contact and therefore \
explains repeated passes or a change of motion.
  - Do not repeat a planet's motion as a separate fact when it is already shown next \
to the exact pass; mention motion outside aspect results only when relevant to the question.
- Ask one short clarifying question only when multiple materially different intents \
remain after applying the rules above.
- Keep the final answer compact but READABLE — structure beats brevity:
  - Start directly with the result; no greeting, preamble, or conclusion.
  - Do not restate the question or explain that you used tools.
  - Avoid generic AI phrases, filler, advice, and ANY astrological interpretation.
  - Use short headings, bullet points, and line breaks so nothing runs together; put \
each data point on its own line. Include the window, entry/exact/exit dates, motion, \
stations, and a brief caveat when materially relevant.
  - Do not sacrifice clarity to save words; use the space needed to list every contact \
and pass legibly.
- Reply in the astrologer's language.

""" + NON_INTERPRETATION_RULES + "\n\n" + CITATION_RULE


def _workspace_context_line(ws: Dict) -> str:
    """A short, defensively-validated summary of the live workspace.

    Fed to the model so follow-up commands resolve against current state
    ("убери транзиты", "теперь синглом"). Every field is validated against the
    command vocabularies, so client junk can neither bloat nor poison the prompt.
    """
    if not isinstance(ws, dict):
        return ""
    parts: List[str] = []
    view = ws.get("wheelView") or ws.get("view")
    if view in WHEEL_VIEWS:
        parts.append(f"wheel view: {view}")
    layers = ws.get("layers")
    if isinstance(layers, list):
        valid = [str(m) for m in layers if m in WORKSPACE_LAYER_METHODS]
        parts.append("active layers: " + (", ".join(valid) if valid else "none"))
    date_value = ws.get("date")
    if isinstance(date_value, str) and _valid_date(date_value):
        parts.append(f"transit date: {date_value}")
    solar_year = ws.get("solarYear")
    if isinstance(solar_year, int) and not isinstance(solar_year, bool) \
            and SOLAR_YEAR_MIN <= solar_year <= SOLAR_YEAR_MAX:
        parts.append(f"solar year: {solar_year}")
    house = ws.get("houseSystem")
    if house in HOUSE_SYSTEM_CODES:
        parts.append(f"house system: {house}")
    synastry = ws.get("synastry")
    if isinstance(synastry, dict) and synastry.get("active") is True:
        syn_parts: List[str] = []
        mode = synastry.get("mode")
        if mode in ("db", "manual"):
            syn_parts.append(f"source={mode}")
        partner_name = synastry.get("partnerName")
        if isinstance(partner_name, str) and partner_name.strip():
            syn_parts.append(f"partner={partner_name.strip()[:120]}")
        partner_id = synastry.get("partnerId")
        if isinstance(partner_id, str) and _uuid_or_none(partner_id):
            syn_parts.append(f"partnerId={partner_id}")
        date_value = synastry.get("date")
        if isinstance(date_value, str) and _valid_date(date_value):
            birth = date_value
            time_value = synastry.get("time")
            if isinstance(time_value, str) and _valid_time(time_value):
                birth += f" {time_value}"
            syn_parts.append(f"birth={birth}")
        timezone_value = synastry.get("timezone")
        if isinstance(timezone_value, str) and _valid_timezone(timezone_value):
            syn_parts.append(f"timezone={timezone_value.strip()}")
        place = synastry.get("place")
        if isinstance(place, str) and place.strip():
            syn_parts.append(f"place={place.strip()[:120]}")
        lat = _coerce_float(synastry.get("latitude"))
        lon = _coerce_float(synastry.get("longitude"))
        if lat is not None and lon is not None:
            syn_parts.append(f"coords={lat:.6f},{lon:.6f}")
        house_system = synastry.get("houseSystem")
        if house_system in HOUSE_SYSTEM_CODES:
            syn_parts.append(f"house={house_system}")
        zodiac = synastry.get("zodiac")
        if zodiac in ("tropical", "sidereal"):
            syn_parts.append(f"zodiac={zodiac}")
            ayanamsha = synastry.get("ayanamsha")
            if isinstance(ayanamsha, str) and ayanamsha.strip():
                syn_parts.append(f"ayanamsha={ayanamsha.strip()[:40]}")
        aspect_count = synastry.get("aspectCount")
        if isinstance(aspect_count, int) and aspect_count >= 0:
            syn_parts.append(f"inter-aspects={aspect_count}")
        tight_aspects = []
        for item in synastry.get("tightInterAspects") or []:
            if not isinstance(item, dict):
                continue
            primary = str(item.get("primary") or "")[:32]
            aspect = str(item.get("aspect") or "")[:32]
            partner = str(item.get("partner") or "")[:32]
            orb = item.get("orb")
            if primary and aspect and partner and isinstance(orb, (int, float)):
                tight_aspects.append(f"{primary} {aspect} {partner} orb {float(orb):.2f}")
            if len(tight_aspects) >= 8:
                break
        if tight_aspects:
            syn_parts.append("tight=" + "; ".join(tight_aspects))
        if syn_parts:
            parts.append("active synastry: " + ", ".join(syn_parts))
    parts.extend(_workspace_resources_parts(ws.get("resources") if isinstance(ws, dict) else {}))
    if not parts:
        return ""
    return ("Current workspace state (context for grounding commands; do not act "
            "unless explicitly asked) — " + "; ".join(parts) + ".")


class AstroAssistantService:
    def __init__(
        self,
        db_session: Session,
        *,
        default_timezone: str = "UTC",
        default_anchor_date: Optional[date_type] = None,
        default_workspace: Optional[Dict] = None,
        astrologer_id: Optional[UUID] = None,
    ):
        self.db = db_session
        self.default_timezone = default_timezone
        self.default_anchor_date = default_anchor_date or date_type.today()
        self.default_workspace = default_workspace
        # Auth-bound owner of the saved charts find_chart may search; never a
        # model-controlled argument (same boundary as the active chart user_id).
        self.astrologer_id = astrologer_id
        self._transit_service: Optional[TransitService] = None
        self._progression_service: Optional[ProgressionService] = None
        self._direction_service: Optional[DirectionService] = None
        # Per-turn frozen Layer-1 dataset (built once, reused across get_chart_data
        # calls in the same turn so every facet reconciles to one provenance hash).
        self._chart_dataset: Optional[ChartDataset] = None
        # Per-turn methodology fingerprint (migration 055). Resolved once at the
        # top of chat() — before any model call — then stamped onto every tool
        # result and persisted with the turn.
        self._methodology: Optional[Dict] = None

    def _transits(self) -> TransitService:
        if self._transit_service is None:
            self._transit_service = TransitService(
                db_session=self.db, ephe_path=get_ephemeris_path())
        return self._transit_service

    def _progressions(self) -> ProgressionService:
        if self._progression_service is None:
            self._progression_service = ProgressionService(
                db_session=self.db, ephe_path=get_ephemeris_path())
        return self._progression_service

    def _directions(self) -> DirectionService:
        if self._direction_service is None:
            self._direction_service = DirectionService(
                db_session=self.db, ephe_path=get_ephemeris_path())
        return self._direction_service

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

    def _exec_find_chart(self, user_id: UUID, args: Dict) -> Dict:
        """Search the astrologer's saved charts by name (synastry grounding).

        Scoped to the bound ``astrologer_id`` (never model-controlled), mirroring
        the /charts list query. Returns compact candidates the model disambiguates.
        """
        astrologer_id = getattr(self, "astrologer_id", None)
        if astrologer_id is None:
            return {"status": "error", "error": "no_astrologer_context"}
        query = (args.get("query") or "").strip()
        if not query:
            return {"status": "error", "error": "empty_query"}
        raw_limit = args.get("limit")
        limit = raw_limit if isinstance(raw_limit, int) and 1 <= raw_limit <= 25 else 8
        pattern = f"%{query}%"
        # Match the chart's own name fields AND the linked profile's (Person) name:
        # astrologers refer to people by their profile, whose name often lives on
        # the Person, not the chart row. Outer join keeps charts with no profile.
        rows = (
            self.db.query(User)
            .outerjoin(Person, User.person_id == Person.person_id)
            .filter(
                User.astrologer_id == astrologer_id,
                or_(
                    User.title.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                    User.birth_place.ilike(pattern),
                    Person.display_name.ilike(pattern),
                    Person.first_name.ilike(pattern),
                    Person.last_name.ilike(pattern),
                ),
            )
            .order_by(User.created_at.desc())
            .limit(limit)
            .all()
        )
        matches = []
        for u in rows:
            name = " ".join(p for p in [u.first_name, u.last_name] if p).strip()
            person = getattr(u, "person", None)
            person_name = ""
            if person is not None:
                person_name = (person.display_name or "").strip() or " ".join(
                    p for p in [person.first_name, person.last_name] if p).strip()
            matches.append({
                "chart_id": str(u.user_id),
                "title": u.title or name or person_name or str(u.user_id)[:8],
                "birth_date": u.birth_date.isoformat() if u.birth_date else None,
                "birth_place": u.birth_place or None,
            })
        return {"status": "ok", "count": len(matches), "matches": matches}

    def _workspace_synastry(self) -> Dict:
        workspace = self.default_workspace if isinstance(self.default_workspace, dict) else {}
        synastry = workspace.get("synastry")
        if isinstance(synastry, dict) and synastry.get("active") is True:
            return synastry
        return {}

    def _owned_chart_exists(self, chart_id: UUID) -> bool:
        if self.astrologer_id is None:
            return False
        return self.db.query(User.user_id).filter(
            User.user_id == chart_id,
            User.astrologer_id == self.astrologer_id,
        ).first() is not None

    def _manual_synastry_context(self, synastry: Dict) -> NatalContext:
        missing = []
        date_value = synastry.get("date")
        time_value = synastry.get("time")
        timezone_value = synastry.get("timezone")
        if not _valid_date(date_value):
            missing.append("date")
        if not _valid_time(time_value):
            missing.append("time")
        if not _valid_timezone(timezone_value):
            missing.append("timezone")
        lat = _coerce_float(synastry.get("latitude"))
        lon = _coerce_float(synastry.get("longitude"))
        place = synastry.get("place")
        has_place = isinstance(place, str) and bool(place.strip())
        has_coords = lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180
        if not has_place and not has_coords:
            missing.append("place_or_coordinates")
        if missing:
            raise ValueError("synastry_partner_missing:" + ",".join(missing))

        calc = NatalChartService(ephe_path=get_ephemeris_path()).calculate_natal_chart(
            birth_date=date_type.fromisoformat(date_value),
            birth_time=time_type.fromisoformat(time_value),
            timezone=timezone_value,
            astrologer_id=self.astrologer_id,
            place=place.strip() if has_place else None,
            latitude=lat if has_coords else None,
            longitude=lon if has_coords else None,
            house_system=synastry.get("houseSystem") if synastry.get("houseSystem") in HOUSE_SYSTEM_CODES else "P",
            save_to_db=False,
            db_session=self.db,
            first_name=synastry.get("partnerName") if isinstance(synastry.get("partnerName"), str) else None,
            zodiac=synastry.get("zodiac") if synastry.get("zodiac") in ("tropical", "sidereal") else "tropical",
            ayanamsha=synastry.get("ayanamsha") or "lahiri",
        )
        return NatalContext.from_inline(calc, astrologer_id=self.astrologer_id)

    def _resolve_chart_source(
        self,
        user_id: UUID,
        args: Dict,
    ) -> Tuple[str, Optional[UUID], Optional[NatalContext]]:
        chart_ref = args.get("chart_ref") or "active_chart"
        if chart_ref not in CHART_REFS:
            raise ValueError("bad_chart_ref")
        if chart_ref == "active_chart":
            return "active_chart", user_id, None

        synastry = self._workspace_synastry()
        if not synastry:
            raise ValueError("synastry_partner_missing:active_synastry")

        partner_id = _uuid_or_none(synastry.get("partnerId"))
        if partner_id is not None:
            if not self._owned_chart_exists(partner_id):
                raise ValueError("synastry_partner_missing:partner_access")
            return "synastry_partner", partner_id, None

        return "synastry_partner", None, self._manual_synastry_context(synastry)

    def _compact_progression_result(self, result: Dict, chart_ref: str) -> Dict:
        aspects = sorted(
            result.get("aspects_to_natal") or [],
            key=lambda a: float(a.get("orb") if a.get("orb") is not None else 99),
        )
        return {
            "status": "ok",
            "chart_ref": chart_ref,
            "progression_info": result.get("progression_info") or {},
            "birth_data": result.get("birth_data") or {},
            "progressed_planets": [
                _compact_object(p) for p in (result.get("progressed_planets") or [])[:_SUMMARY_OBJECT_LIMIT]
            ],
            "aspects_to_natal": [
                _compact_aspect(a, left_key="progressed_planet")
                for a in aspects[:_SUMMARY_ASPECT_LIMIT]
            ],
            "planet_ingresses": [
                _compact_ingress(i)
                for i in (result.get("planet_ingresses") or [])[:_SUMMARY_INGRESS_LIMIT]
            ],
            "truncated": {
                "aspects": max(0, len(aspects) - _SUMMARY_ASPECT_LIMIT),
                "progressed_planets": max(
                    0, len(result.get("progressed_planets") or []) - _SUMMARY_OBJECT_LIMIT),
            },
        }

    def _compact_direction_result(self, result: Dict, chart_ref: str) -> Dict:
        aspects = sorted(
            result.get("aspects_to_natal") or [],
            key=lambda a: float(a.get("orb") if a.get("orb") is not None else 99),
        )
        directed_objects = (
            (result.get("directed_planets") or [])
            + (result.get("directed_angles") or [])
            + (result.get("directed_special_points") or [])
        )
        return {
            "status": "ok",
            "chart_ref": chart_ref,
            "direction_info": result.get("direction_info") or {},
            "birth_data": result.get("birth_data") or {},
            "directed_objects": [
                _compact_object(o) for o in directed_objects[:_SUMMARY_OBJECT_LIMIT]
            ],
            "aspects_to_natal": [
                _compact_aspect(a, left_key="directed_object")
                for a in aspects[:_SUMMARY_ASPECT_LIMIT]
            ],
            "planet_ingresses": [
                _compact_ingress(i)
                for i in (result.get("planet_ingresses") or [])[:_SUMMARY_INGRESS_LIMIT]
            ],
            "house_cusp_ingresses": [
                _compact_ingress(i)
                for i in (result.get("house_cusp_ingresses") or [])[:_SUMMARY_INGRESS_LIMIT]
            ],
            "truncated": {
                "aspects": max(0, len(aspects) - _SUMMARY_ASPECT_LIMIT),
                "directed_objects": max(0, len(directed_objects) - _SUMMARY_OBJECT_LIMIT),
            },
        }

    def _exec_calculate_progression(self, user_id: UUID, args: Dict) -> Dict:
        chart_ref, saved_user_id, inline_context = self._resolve_chart_source(user_id, args)
        target_date = _parse_tool_date(args.get("target_date"))
        target_time = _parse_tool_time(args.get("target_time"))
        timezone = args.get("timezone") or self.default_timezone
        if target_time is not None and not _valid_timezone(timezone):
            raise ValueError("bad_timezone")

        service = self._progressions()
        if inline_context is not None:
            result = service.calculate_progression_from_context(
                inline_context,
                target_date=target_date,
                target_time=target_time,
                timezone=timezone if target_time is not None else None,
            )
        else:
            result = service.calculate_progression(
                user_id=saved_user_id,
                target_date=target_date,
                target_time=target_time,
                timezone=timezone if target_time is not None else None,
                save_to_db=False,
            )
        return self._compact_progression_result(result, chart_ref)

    def _exec_calculate_direction(self, user_id: UUID, args: Dict) -> Dict:
        chart_ref, saved_user_id, inline_context = self._resolve_chart_source(user_id, args)
        target_date = _parse_tool_date(args.get("target_date"))
        direction_type = args.get("direction_type") or "zodiacal"
        if direction_type not in DIRECTION_TYPES:
            raise ValueError("bad_direction_type")

        service = self._directions()
        if inline_context is not None:
            result = service.calculate_direction_from_context(
                inline_context,
                target_date=target_date,
                direction_type=direction_type,
            )
        else:
            result = service.calculate_direction(
                user_id=saved_user_id,
                target_date=target_date,
                direction_type=direction_type,
                save_to_db=False,
            )
        return self._compact_direction_result(result, chart_ref)

    def _get_chart_dataset(self, user_id: UUID) -> ChartDataset:
        """The per-turn frozen Layer-1 dataset for the active chart, built once."""
        if self._chart_dataset is None:
            self._chart_dataset = ChartDataset(
                user_id=user_id,
                astrologer_id=self.astrologer_id,
                db=self.db,
            )
        return self._chart_dataset

    def _exec_get_chart_data(self, user_id: UUID, args: Dict) -> Dict:
        return get_chart_data(self._get_chart_dataset(user_id), args.get("facet"))

    def _exec_analyze(self, user_id: UUID, args: Dict) -> Dict:
        # The tool args ARE the analysis spec; the executor validates + runs it.
        return analyze_spec(self._get_chart_dataset(user_id), args)

    def _release_db_after_tool(self, *, success: bool) -> None:
        """Return the checked-out DB connection before the next model call."""
        if self.db is None:
            return
        try:
            if success:
                self.db.commit()
            else:
                self.db.rollback()
        except Exception:
            logger.exception("assistant DB session release failed")
            try:
                self.db.rollback()
            except Exception:
                pass
        finally:
            self.db.close()

    def _dispatch(self, name: str, args: Dict, user_id: UUID) -> Dict:
        handlers: Dict[str, Callable[[UUID, Dict], Dict]] = {
            "find_aspect_passes": self._exec_find_aspect_passes,
            "find_chart": self._exec_find_chart,
            "calculate_progression": self._exec_calculate_progression,
            "calculate_direction": self._exec_calculate_direction,
            "get_chart_data": self._exec_get_chart_data,
            "analyze": self._exec_analyze,
        }
        handler = handlers.get(name)
        if handler is None:
            return {"status": "error", "error": f"unknown_tool:{name}"}
        try:
            result = attach_provenance(handler(user_id, args), self._methodology)
            self._release_db_after_tool(success=True)
            return result
        except ValueError as e:
            self._release_db_after_tool(success=False)
            return {"status": "error", "error": str(e)}
        except Exception:
            logger.exception("assistant tool '%s' failed", name)
            self._release_db_after_tool(success=False)
            return {"status": "error", "error": "tool_execution_failed"}

    # --- agent loop -----------------------------------------------------

    def _regenerate_without_interpretation(self, client, convo, usage) -> Optional[str]:
        """One more completion, nudged to report data only. None on error."""
        nudge = {
            "role": "system",
            "content": ("Your previous answer was rejected for containing astrological "
                        "interpretation. Re-answer using ONLY the data and calculations "
                        "already gathered in this conversation. Report facts; if meaning "
                        "is required, decline that part and give the underlying data."),
        }
        try:
            resp = client.chat.completions.create(
                model=_MODEL,
                messages=convo + [nudge],
                verbosity="low",
                max_completion_tokens=MAX_COMPLETION_TOKENS,
                timeout=REQUEST_TIMEOUT_S,
            )
            usage.add(getattr(resp, "usage", None))
            return resp.choices[0].message.content or ""
        except Exception:
            logger.exception("assistant judge-regenerate failed")
            return None

    def _finalize_reply(self, *, raw_reply, messages, actions, client, convo, usage,
                        tool_results):
        """Single Layer-3 gate BOTH chat() exits call. Returns (actions, reply, guardrail).

        Order: coerce wheel-view (own text, unrendered/unjudged) -> render
        structured citations (server substitutes {{row.field}}; an UNRESOLVED
        reference is a fabrication -> refuse) -> judge (when enabled): allow serves;
        block regenerates once then serves-if-clean else canned refusal; judge ERROR
        = fail-closed SOFT (heuristic screen).
        """
        final_actions, coerced_view = _coerce_wheel_view_actions(messages, actions)
        if coerced_view:
            return final_actions, _wheel_view_reply(coerced_view, messages), "ok"

        index = build_citation_index(tool_results)

        def render(text):
            """(rendered, ok). ok=False ONLY for a true fabrication: the model cited an
            analyze() row that does not exist (index non-empty + unresolved). When no
            analyze rows exist this turn (e.g. transit/aspect answers, which are not
            citable), a stray {{...}} token is a formatting slip -> strip and serve, never
            false-block a valid answer."""
            rendered, unresolved = render_citations(text or "", index)
            if unresolved and index:
                return rendered, False
            if unresolved:
                rendered = strip_citation_tokens(rendered)
            return rendered, True

        reply, ok = render(raw_reply)
        if not ok:  # fabricated/unresolved citation
            return final_actions, _refuse_and_redirect(messages), "blocked_citation"

        if not JUDGE_ENABLED:
            return final_actions, reply, "ok"

        judge_model = model_for("judge")
        try:
            verdict = classify_reply(reply, client=client, model=judge_model, usage=usage)
        except Exception:
            logger.exception("assistant judge unavailable; fail-closed soft")
            if heuristic_interpretation(reply):
                return final_actions, _refuse_and_redirect(messages), "blocked_degraded"
            return final_actions, reply, "degraded"

        if verdict == VERDICT_ALLOW:
            return final_actions, reply, "ok"

        # BLOCK -> regenerate once, render its citations, then re-judge.
        regen_raw = self._regenerate_without_interpretation(client, convo, usage)
        if regen_raw:
            regen, regen_ok = render(regen_raw)
            if regen_ok:
                try:
                    if classify_reply(regen, client=client, model=judge_model, usage=usage) == VERDICT_ALLOW:
                        return final_actions, regen, "regenerated"
                except Exception:
                    if not heuristic_interpretation(regen):
                        return final_actions, regen, "regenerated_degraded"
        return final_actions, _refuse_and_redirect(messages), "blocked"

    def chat(self, user_id: UUID, messages: List[Dict], locale: Optional[str] = None) -> Dict:
        """
        Run the function-calling loop for the active chart (user_id).

        ``messages`` is the prior conversation as [{role, content}, …].
        ``locale`` is the astrologer's UI language (en/ru/uk) so the reply matches it.
        Returns {reply, tool_results, iterations, max_iterations_reached}.
        """
        if not is_openai_configured():
            raise RuntimeError("OPENAI_API_KEY not configured")

        # Methodology fingerprint FIRST, then hand the connection back: this
        # touches the DB, and holding a pooled connection across the model calls
        # below is what exhausted the Supabase pool once already.
        self._methodology = build_methodology_provenance(
            PreferencesRuntimeResolver(self.db), user_id)
        self._release_db_after_tool(success=True)

        client = get_openai_client()
        tools = build_tools()
        convo: List[Dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]
        locale_line = _locale_instruction(locale)
        if locale_line:
            convo.append({"role": "system", "content": locale_line})
        workspace = getattr(self, "default_workspace", None)
        if workspace:
            context_line = _workspace_context_line(workspace)
            if context_line:
                convo.append({"role": "system", "content": context_line})
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
                final_actions, reply, guardrail = self._finalize_reply(
                    raw_reply=msg.content or "",
                    messages=messages,
                    actions=actions,
                    client=client,
                    convo=convo,
                    usage=usage,
                    tool_results=tool_results,
                )
                return {
                    "reply": reply,
                    "tool_results": tool_results,
                    "actions": final_actions,
                    "iterations": iterations,
                    "max_iterations_reached": False,
                    "guardrail": guardrail,
                    "methodology": self._methodology,
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
                    result, action = handle_command(name, args, source_text=_last_user_text(messages))
                    if action is not None and not (
                        action.get("name") == "add_client_note"
                        and any(
                            prev.get("name") == "add_client_note"
                            and prev.get("args", {}).get("note_text") == action.get("args", {}).get("note_text")
                            for prev in actions
                        )
                    ):
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
        final_actions, reply, guardrail = self._finalize_reply(
            raw_reply=final.choices[0].message.content or "",
            messages=messages,
            actions=actions,
            client=client,
            convo=convo,
            usage=usage,
            tool_results=tool_results,
        )
        return {
            "reply": reply,
            "tool_results": tool_results,
            "actions": final_actions,
            "iterations": iterations,
            "max_iterations_reached": True,
            "guardrail": guardrail,
            "methodology": self._methodology,
            "metrics": usage.as_metrics(
                iterations=iterations,
                latency_ms=_elapsed_ms(started),
                model=_MODEL,
            ),
        }
