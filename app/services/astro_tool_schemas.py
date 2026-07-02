"""
OpenAI function-tool schemas for the astro assistant.

Two families: deterministic server-executed query tools (find_aspect_passes,
find_chart, calculate_progression, calculate_direction) and client-applied
workspace command tools (set_transit_date, add_layer, …). Every enum comes from
app.services.astro_vocab so the schema the model sees and the server-side
validation can never drift apart.

Extracted from astro_assistant_service.py in the chat-v2 module split; the
service re-exports build_query_tools / build_command_tools / build_tools.
"""
from __future__ import annotations

from typing import Dict, List

from app.services.astro_analysis import ANALYSIS_OPS, ANALYSIS_TABLES
from app.services.astro_data_tools import CHART_DATA_FACETS
from app.services.astro_vocab import (
    ASPECT_TYPE_NAMES,
    CHART_REFS,
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
)


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
        fn('add_layer',
           'Add a named calculation layer (transit/progression/direction/solar/synastry) '
           'only when the astrologer asks to add/build that method. Do not use for '
           'multi-layer or multi-wheel display mode.',
           {'method': {'type': 'string', 'enum': methods}}, ['method']),
        fn('build_solar', 'Build and show a solar return for a year.',
           {'year': {'type': 'integer', 'minimum': SOLAR_YEAR_MIN, 'maximum': SOLAR_YEAR_MAX}},
           ['year']),
        fn('set_solar_year', 'Change the solar-return year.',
           {'year': {'type': 'integer', 'minimum': SOLAR_YEAR_MIN, 'maximum': SOLAR_YEAR_MAX}},
           ['year']),
        fn('set_wheel_view',
           'Switch the wheel display between multi (natal + rings) and single '
           '(natal only). Use this for "многослойный режим", "мультиколесо", '
           '"multi-wheel/multi-layer mode", or "одиночный режим"; it is not '
           'the same as adding a transit layer.',
           {'view': {'type': 'string', 'enum': sorted(WHEEL_VIEWS)}}, ['view']),
        fn('set_house_system',
           'Change the house system (single-letter Swiss Ephemeris code).',
           {'system': {'type': 'string', 'enum': sorted(HOUSE_SYSTEM_CODES)}}, ['system']),
        fn('set_synastry_partner',
           'Build synastry with a saved chart OR complete manually entered birth data. '
           'Use chart_id after find_chart when the astrologer names an existing saved chart. '
           'Use manual when the astrologer gives date, time, timezone, and place or coordinates.',
           {'chart_id': {'type': 'string', 'description': 'Saved chart id from find_chart.'},
            'title': {'type': 'string', 'description': 'Partner display name for saved chart (optional).'},
            'manual': {
                'type': 'object',
                'description': 'Inline partner birth data for unsaved synastry.',
                'properties': {
                    'name': {'type': 'string', 'description': 'Partner display name (optional).'},
                    'title': {'type': 'string', 'description': 'Chart title (optional).'},
                    'date': {'type': 'string', 'description': 'YYYY-MM-DD'},
                    'time': {'type': 'string', 'description': 'HH:mm or HH:mm:ss'},
                    'timezone': {'type': 'string', 'description': 'IANA timezone, e.g. Europe/Kyiv'},
                    'place': {'type': 'string', 'description': 'Birth place name (optional if coordinates given).'},
                    'latitude': {'type': 'number', 'minimum': -90, 'maximum': 90},
                    'longitude': {'type': 'number', 'minimum': -180, 'maximum': 180},
                },
                'required': ['date', 'time', 'timezone'],
                'additionalProperties': False,
            }}),
        fn('remove_layer',
           'Remove a prognostic layer by method (all instances) or layer_id (one). Destructive.',
           {'method': {'type': 'string', 'enum': methods},
            'layer_id': {'type': 'string'}}),
        fn('clear_layers',
           'Remove all prognostic layers, leaving the natal chart. Destructive.',
           {}),
    ]


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
    }, {
        "type": "function",
        "function": {
            "name": "find_chart",
            "description": (
                "Search the astrologer's saved charts by name to resolve a person for "
                "synastry. Returns candidates (chart_id, title, birth_date, birth_place). "
                "If several match, ask which one; if none match, say so."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Name or part of a name."},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 25},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    }, {
        "type": "function",
        "function": {
            "name": "calculate_progression",
            "description": (
                "Calculate secondary progressions for the active chart or the active "
                "synastry partner. Use synastry_partner when the astrologer asks about "
                "the second chart/partner in the current synastry."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "chart_ref": {
                        "type": "string",
                        "enum": list(CHART_REFS),
                        "description": "active_chart or synastry_partner.",
                    },
                    "target_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "target_time": {
                        "type": "string",
                        "description": "HH:mm or HH:mm:ss (optional).",
                    },
                    "timezone": {
                        "type": "string",
                        "description": "IANA timezone; omit to use chart/workspace default.",
                    },
                },
                "required": ["target_date"],
                "additionalProperties": False,
            },
        },
    }, {
        "type": "function",
        "function": {
            "name": "calculate_direction",
            "description": (
                "Calculate directions/solar arcs for the active chart or the active "
                "synastry partner. Use synastry_partner when the astrologer asks about "
                "the second chart/partner in the current synastry."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "chart_ref": {
                        "type": "string",
                        "enum": list(CHART_REFS),
                        "description": "active_chart or synastry_partner.",
                    },
                    "target_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "direction_type": {
                        "type": "string",
                        "enum": list(DIRECTION_TYPES),
                        "description": "solar_arc, zodiacal/symbolic, or equatorial.",
                    },
                },
                "required": ["target_date"],
                "additionalProperties": False,
            },
        },
    }, {
        "type": "function",
        "function": {
            "name": "get_chart_data",
            "description": (
                "Return one facet of the active chart's technical data (Layer 1): "
                "sign properties, essential dignities of the natal planets, planetary "
                "speeds and motion, or house cusps and rulers. Every value is "
                "engine-computed; narrate it, never invent."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "facet": {
                        "type": "string",
                        "enum": list(CHART_DATA_FACETS),
                        "description": "Which technical-data facet to return.",
                    },
                },
                "required": ["facet"],
                "additionalProperties": False,
            },
        },
    }, {
        "type": "function",
        "function": {
            "name": "analyze",
            "description": (
                "Run a deterministic data-science analysis over the active chart's "
                "technical data (Layer 2). Emit a spec: op (count | rank | extreme), "
                "over (a table, e.g. planets), optional filter (column=value), "
                "group_by, sort, order, limit. The server computes the result and "
                "returns rows with ids; you narrate and cite rows by id. Never "
                "compute or invent the numbers yourself."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "op": {"type": "string", "enum": list(ANALYSIS_OPS)},
                    "over": {"type": "string", "enum": sorted(ANALYSIS_TABLES)},
                    "filter": {
                        "type": "object",
                        "description": "Equality filters as column: value.",
                        "additionalProperties": True,
                    },
                    "group_by": {"type": "string", "description": "Column to group by (count op)."},
                    "sort": {"type": "string", "description": "Column to sort by (rank/extreme ops)."},
                    "order": {"type": "string", "enum": ["asc", "desc"]},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 50},
                },
                "required": ["op", "over"],
                "additionalProperties": False,
            },
        },
    }]


def build_tools() -> List[Dict]:
    """All tool schemas: deterministic query tools + workspace command tools."""
    return build_query_tools() + build_command_tools()
