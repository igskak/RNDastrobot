"""
Shared, deterministic vocabularies + pure validators for the astro assistant.

Single source for the tool-schema enums, the route's request validation, and the
command-intent validation. Built from ``app.utils.constants`` so schema and
validation can never drift apart. This module has NO service/DB dependencies —
it is safe to import from the route, the schema builder, the command handler,
and the agent loop alike.

Extracted from astro_assistant_service.py in the chat-v2 module split; the
service re-exports every public name here for backward compatibility.
"""
from __future__ import annotations

import math
import re
from datetime import date as date_type
from typing import Dict

import pytz

from app.utils.constants import PLANETS, SPECIAL_POINTS

# ── body / aspect vocabularies (schema enums AND request validation) ─────────
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

# ── workspace command vocabularies (mirror forecast-commands.js) ─────────────
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
    'set_synastry_partner': {'confirm': 'auto'},
    'add_client_note': {'confirm': 'auto'},
    'remove_layer': {'confirm': 'confirm'},
    'clear_layers': {'confirm': 'confirm'},
}

# ── chart-source + direction vocabularies (query-tool enums) ─────────────────
CHART_REFS = ('active_chart', 'synastry_partner')
DIRECTION_TYPES = ('solar_arc', 'zodiacal', 'symbolic', 'equatorial')

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^(\d{2}):(\d{2})(?::(\d{2}))?$")


# ── pure validators (no DB, no service state) ────────────────────────────────
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


def _valid_timezone(value) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        pytz.timezone(value.strip())
        return True
    except pytz.exceptions.UnknownTimeZoneError:
        return False


def _coerce_float(value):
    if isinstance(value, bool) or value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _validate_manual_synastry(value) -> str:
    if not isinstance(value, dict):
        return 'bad_manual'
    if not _valid_date(value.get('date')):
        return 'bad_manual_date'
    if not _valid_time(value.get('time')):
        return 'bad_manual_time'
    if not _valid_timezone(value.get('timezone')):
        return 'bad_manual_timezone'
    lat = _coerce_float(value.get('latitude'))
    lon = _coerce_float(value.get('longitude'))
    has_coords = lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180
    place = value.get('place')
    has_place = isinstance(place, str) and bool(place.strip())
    if not has_place and not has_coords:
        return 'bad_manual_location'
    coord_supplied = value.get('latitude') not in (None, '') or value.get('longitude') not in (None, '')
    if coord_supplied and not has_coords:
        return 'bad_manual_location'
    return ''
