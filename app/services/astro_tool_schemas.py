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
from app.services.astro_profiles import NATAL_TARGET_PROFILES, TRANSIT_BODY_PROFILES
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
        fn('add_client_note',
           'Add one note to the active client profile only when the astrologer explicitly asks '
           'to add/write/save a note. The note_text must be copied from the astrologer message '
           'with only the command wrapper removed; do not summarize, correct, interpret, or add '
           'context here.',
           {'note_text': {'type': 'string', 'description': 'The exact note content to save.'}},
           ['note_text']),
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
                "Return one facet of the active chart's technical data (Layer 1). "
                "Available facets: sign_properties (element/mode/rulers per sign); "
                "dignities (each natal planet's sign, house, essential dignity); "
                "speeds (speed and motion); houses (cusps and rulers); "
                "natal_aspects (the full natal aspect network with orbs, sorted "
                "tightest first); angles_and_points (ASC/MC/IC/DSC/Vertex and the "
                "nodes, Lilith, Fortune); planet_roles (ruled houses, chart-ruler "
                "and other roles, elevation, peregrine, strength); house_details "
                "(rulers, co-rulers, ruler's house, significator, occupants); "
                "configurations (T-squares, grand trines and other detected "
                "patterns). Every value is engine-computed; narrate it, never invent."
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
            "name": "survey_transits",
            "description": (
                "Scan a PERIOD for transit contacts across MANY bodies and natal "
                "targets in one call. Use this for any broad or undirected forecast "
                "request — 'транзиты на год', 'что важного в ближайшие два года', "
                "'все аспекты высших планет', 'обзор', 'на что обратить внимание' — "
                "and whenever the astrologer names no specific pair. Do NOT emulate "
                "it with repeated find_aspect_passes calls: that exhausts the tool "
                "budget long before covering the bodies, and silently answers about "
                "one planet when the astrologer asked about the period. "
                "Omit profile and target_profile to get the product defaults: "
                "outer planets (Uranus, Neptune, Pluto, Chiron) against the ten "
                "planets, the four angles, both nodes and Lilith. Use "
                "profile='slow_planets' to add Jupiter and Saturn, or "
                "profile='all_planets' for the full set. Returns one event per "
                "contact with enter/exact passes/leave, stations, the transiting "
                "body's natal house and ruled houses, axis grouping, plus a monthly "
                "distribution. find_aspect_passes stays the right tool for ONE "
                "named pair and aspect."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "survey_id": {
                        "type": "string",
                        "description": (
                            "Reuse a survey already computed in this conversation. Skips the scan AND guarantees you describe the same events; without it a recomputation can differ if settings changed."
                        ),
                    },
                    "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "profile": {
                        "type": "string",
                        "enum": sorted(TRANSIT_BODY_PROFILES),
                        "description": "Which transiting bodies. Default outer_planets.",
                    },
                    "transit_bodies": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(TRANSIT_BODY_NAMES)},
                        "description": "Explicit bodies; overrides profile.",
                    },
                    "target_profile": {
                        "type": "string",
                        "enum": sorted(NATAL_TARGET_PROFILES),
                        "description": "Which natal targets. Default broad_default_v1.",
                    },
                    "natal_targets": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(NATAL_BODY_NAMES)},
                        "description": "Explicit targets; overrides target_profile.",
                    },
                    "aspect_types": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(ASPECT_TYPE_NAMES)},
                        "description": "Default: the five Ptolemaic aspects.",
                    },
                    "timezone": {"type": "string", "description": "IANA; omit for the chart's."},
                },
                "required": ["start_date", "end_date"],
                "additionalProperties": False,
            },
        },
    }, {
        "type": "function",
        "function": {
            "name": "discover_patterns",
            "description": (
                "Measure the objective STRUCTURE of a forecast period and return "
                "evidence-backed findings. Use when the astrologer asks what is "
                "notable, important, worth examining, or wants an analytical "
                "overview rather than a list — 'ключевые особенности', 'на что "
                "обратить внимание', 'проанализируй период', 'что здесь "
                "выделяется'. Takes the same survey arguments as survey_transits "
                "and does the survey itself. Returns: time clusters and quiet "
                "gaps, most repeated natal targets and houses, axis activations, "
                "targets reached by several different bodies, aspect-graph hubs "
                "and components, outliers (long windows, partile contacts, triple "
                "passes, stations), full statistics, and a ranked list using the "
                "versioned technical_priority_v1 profile with every metric shown. "
                "Each finding carries evidence_ids — cite those records; never "
                "add figures of your own. This reports WHAT IS MEASURABLE, never "
                "what it means."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "survey_id": {
                        "type": "string",
                        "description": (
                            "Reuse a survey already computed in this conversation. Skips the scan AND guarantees you describe the same events; without it a recomputation can differ if settings changed."
                        ),
                    },
                    "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "profile": {"type": "string", "enum": sorted(TRANSIT_BODY_PROFILES)},
                    "transit_bodies": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(TRANSIT_BODY_NAMES)},
                    },
                    "target_profile": {
                        "type": "string", "enum": sorted(NATAL_TARGET_PROFILES)},
                    "natal_targets": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(NATAL_BODY_NAMES)},
                    },
                    "aspect_types": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(ASPECT_TYPE_NAMES)},
                    },
                    "timezone": {"type": "string"},
                },
                "required": ["start_date", "end_date"],
                "additionalProperties": False,
            },
        },
    }, {
        "type": "function",
        "function": {
            "name": "intersect_forecast_windows",
            "description": (
                "Find WHEN several transit contacts are active at the same time. "
                "Use for 'когда одновременно', 'что накладывается', 'самые "
                "насыщенные периоды', 'densest periods', or a named pair such as "
                "'когда Уран и Плутон одновременно аспектируют карту'. Takes the "
                "same survey arguments as survey_transits (it surveys, then "
                "intersects — no need to call survey_transits first) plus the "
                "overlap criteria. Returns timeline segments that are split "
                "wherever the active set changes, each carrying its event ids, "
                "the contributing bodies and both a raw contact count and an "
                "axis-collapsed target count."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "survey_id": {
                        "type": "string",
                        "description": (
                            "Reuse a survey already computed in this conversation. Skips the scan AND guarantees you describe the same events; without it a recomputation can differ if settings changed."
                        ),
                    },
                    "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "profile": {"type": "string", "enum": sorted(TRANSIT_BODY_PROFILES)},
                    "transit_bodies": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(TRANSIT_BODY_NAMES)},
                    },
                    "target_profile": {
                        "type": "string", "enum": sorted(NATAL_TARGET_PROFILES)},
                    "natal_targets": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(NATAL_BODY_NAMES)},
                    },
                    "aspect_types": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(ASPECT_TYPE_NAMES)},
                    },
                    "min_contacts": {
                        "type": "integer", "minimum": 1,
                        "description": "How many contacts must overlap. Default 2.",
                    },
                    "min_bodies": {
                        "type": "integer", "minimum": 1,
                        "description": "How many DISTINCT transiting bodies. Default 1.",
                    },
                    "bodies": {
                        "type": "array",
                        "items": {"type": "string", "enum": sorted(TRANSIT_BODY_NAMES)},
                        "description": (
                            "Every one of these must be active in a segment. Use for "
                            "'when are Uranus AND Pluto both active' — a different "
                            "question from 'when do any two contacts overlap'."
                        ),
                    },
                    "timezone": {"type": "string"},
                },
                "required": ["start_date", "end_date"],
                "additionalProperties": False,
            },
        },
    }, {
        "type": "function",
        "function": {
            "name": "find_symbolic_aspect_passes",
            "description": (
                "Find WHEN a progressed or directed body forms an aspect to a natal "
                "object: enter / each exact crossing / leave, motion per pass and "
                "stations. The symbolic counterpart of find_aspect_passes. "
                "calculate_progression and calculate_direction return a SNAPSHOT on "
                "one date and cannot answer a 'when' question — use this instead for "
                "'when does progressed Moon square natal Saturn'. Read contact_count "
                "and contacts to decide whether anything was found: the status field "
                "describes the currently selected date, NOT the searched window, so "
                "'selected_not_in_orb' is normal alongside contacts."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "method": {"type": "string", "enum": ["progression", "direction"]},
                    "source_body": {"type": "string", "enum": sorted(TRANSIT_BODY_NAMES)},
                    "target_body": {"type": "string", "enum": sorted(NATAL_BODY_NAMES)},
                    "aspect_type": {"type": "string", "enum": sorted(ASPECT_TYPE_NAMES)},
                    "contact_start": {
                        "type": "string",
                        "description": "YYYY-MM-DD. Omit for a wide window around the active date.",
                    },
                    "contact_end": {"type": "string", "description": "YYYY-MM-DD."},
                    "direction_type": {
                        "type": "string",
                        "enum": list(DIRECTION_TYPES),
                        "description": "Only meaningful when method=direction.",
                    },
                },
                "required": ["method", "source_body", "target_body", "aspect_type"],
                "additionalProperties": False,
            },
        },
    }, {
        "type": "function",
        "function": {
            "name": "survey_symbolic_ingresses",
            "description": (
                "List progression AND direction ingresses over a period: when a "
                "progressed or directed body changes sign or house, and when a "
                "directed house cusp changes sign. Every row carries the dates one "
                "degree before the boundary, exact on it, and one degree after. Use "
                "for 'when does my progressed Sun change sign' or a period overview "
                "of symbolic movement."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "direction_type": {
                        "type": "string",
                        "enum": list(DIRECTION_TYPES),
                        "description": "Direction method used for the direction rows.",
                    },
                },
                "required": ["start_date", "end_date"],
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
                "over (planets, natal_aspects, houses, configurations, and — after a "
                "survey has run this turn — transit_events, time_segments, "
                "pattern_findings), optional filter "
                "(column=value), group_by, sort, order, limit. The server computes "
                "the result and returns rows with ids; you narrate and cite rows by "
                "id. Use this for objective structure questions — most-aspected "
                "body (count over natal_aspects grouped by left), tightest orbs "
                "(rank over natal_aspects sorted by orb ascending), busiest house "
                "(extreme over houses sorted by planet_count). Never compute or "
                "invent the numbers yourself."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "op": {"type": "string", "enum": list(ANALYSIS_OPS)},
                    "aggregate": {
                        "type": "string",
                        "enum": ["sum", "avg", "min", "max"],
                        "description": "For op=aggregate; the column is `sort`.",
                    },
                    "bucket": {
                        "type": "string",
                        "enum": ["day", "month", "year"],
                        "description": "For op=bucket_time. Default month.",
                    },
                    "time_column": {
                        "type": "string",
                        "description": "For op=bucket_time; defaults to the table's start column.",
                    },
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
