"""
Workspace-command validation for the astro assistant.

The server NEVER executes workspace commands — workspace state lives in the
browser. This module validates the model's command intent against the shared
vocabularies, normalizes the args to only the known/validated keys (never raw
model junk), and returns a receipt + a structured action for the client to apply.

Extracted from astro_assistant_service.py in the chat-v2 module split; the
service re-exports these names for backward compatibility.
"""
from __future__ import annotations

from typing import Dict

from app.services.astro_vocab import (
    COMMAND_REGISTRY,
    HOUSE_SYSTEM_CODES,
    SOLAR_YEAR_MAX,
    SOLAR_YEAR_MIN,
    STEP_AMOUNT_MAX,
    STEP_AMOUNT_MIN,
    STEP_DIRECTIONS,
    STEP_UNITS,
    WHEEL_VIEWS,
    WORKSPACE_LAYER_METHODS,
    _coerce_float,
    _valid_date,
    _valid_int,
    _valid_time,
    _validate_manual_synastry,
)


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
    if name == 'set_synastry_partner':
        chart_id = args.get('chart_id')
        has_chart_id = isinstance(chart_id, str) and bool(chart_id.strip())
        manual = args.get('manual')
        has_manual = manual is not None
        if has_chart_id == has_manual:
            return 'bad_synastry_source'
        if has_manual:
            return _validate_manual_synastry(manual)
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
    if name == 'set_synastry_partner':
        if args.get('manual') is not None:
            manual = args['manual']
            out_manual = {
                'date': manual['date'],
                'time': manual['time'],
                'timezone': manual['timezone'].strip(),
            }
            for key, max_len in (
                ('name', 120),
                ('title', 120),
                ('place', 180),
            ):
                value = manual.get(key)
                if isinstance(value, str) and value.strip():
                    out_manual[key] = value.strip()[:max_len]
            lat = _coerce_float(manual.get('latitude'))
            lon = _coerce_float(manual.get('longitude'))
            if lat is not None and lon is not None:
                out_manual['latitude'] = lat
                out_manual['longitude'] = lon
            return {'manual': out_manual}
        out = {'chart_id': str(args['chart_id']).strip()}
        title = args.get('title')
        if isinstance(title, str) and title.strip():
            out['title'] = title.strip()[:120]
        return out
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
