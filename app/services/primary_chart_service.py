"""Резолвер «первичной карты» (primary) для расчёта аспектов слоёв к произвольной
карте, а не только к наталу (фича aspects_to_<primary>).

Слой-сервисы (transit/progression/direction/solar) аспектируют свои тела против
``context.aspect_reference`` если он задан, иначе против натала. Этот модуль строит
такой ``aspect_reference`` из спецификации первичной карты ``{method, params}``,
переиспользуя деривацию соответствующих слой-сервисов.

primary.method == 'natal' → возвращаем контекст без изменений (цель = натал).
Иные методы → деривируем позиции первичной карты от того же натала субъекта и
оборачиваем через :meth:`NatalContext.with_primary`.

Деривация первичной идёт от натала ``base_context`` (его JD/координаты), поэтому
прогрессии/дирекции первичной карты остаются корректными производными натала.
"""
from __future__ import annotations

from datetime import date as date_type, time as time_type
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.services.natal_context import NatalContext

VALID_PRIMARY_METHODS = {'natal', 'progression', 'direction', 'solar_return'}


def _parse_date(value) -> Optional[date_type]:
    if value is None or value == '':
        return None
    if isinstance(value, date_type):
        return value
    return date_type.fromisoformat(str(value)[:10])


def _parse_time(value) -> Optional[time_type]:
    if value is None or value == '':
        return None
    if isinstance(value, time_type):
        return value
    return time_type.fromisoformat(str(value))


def _angles_dict_from_list(angles: List[Dict]) -> Dict:
    """[{name, longitude}] → {name: {longitude}} — форма, ожидаемая
    ``aspect_targets_from_calc_result``."""
    return {a['name']: {'longitude': a['longitude']} for a in (angles or []) if a.get('longitude') is not None}


def _angles_from_houses(houses: List[Dict]) -> Dict:
    """Углы из куспидов домов: ASC=куспид I, MC=куспид X, DSC/IC — противоположные.
    Используется для прогрессий, чьи углы не выносятся отдельным полем в payload."""
    if not houses or len(houses) < 10:
        return {}
    by_num = {h['number']: float(h['longitude']) for h in houses if h.get('longitude') is not None}
    asc, mc = by_num.get(1), by_num.get(10)
    if asc is None or mc is None:
        return {}
    return {
        'ASC': {'longitude': asc},
        'MC': {'longitude': mc},
        'DSC': {'longitude': (asc + 180.0) % 360.0},
        'IC': {'longitude': (mc + 180.0) % 360.0},
    }


def _calc_like_from_direction(payload: Dict) -> Dict:
    return {
        'planets': payload.get('directed_planets') or [],
        'special_points': payload.get('directed_special_points') or [],
        'angles': _angles_dict_from_list(payload.get('directed_angles') or []),
        'houses': payload.get('directed_houses') or [],
    }


def _calc_like_from_progression(payload: Dict) -> Dict:
    houses = payload.get('progressed_houses') or []
    return {
        # progressed_planets уже включает спец-тела (см. progression_service)
        'planets': payload.get('progressed_planets') or [],
        'special_points': {},
        'angles': _angles_from_houses(houses),
        'houses': houses,
    }


def _calc_like_from_solar(payload: Dict) -> Dict:
    return {
        # solar payload уже calc_result-формы: planets (со спец-телами), angles (dict), houses
        'planets': payload.get('planets') or [],
        'special_points': {},
        'angles': payload.get('angles') or {},
        'houses': payload.get('houses') or [],
    }


def apply_primary(
    db: Session,
    base_context: NatalContext,
    method: Optional[str],
    params: Optional[Dict] = None,
) -> NatalContext:
    """Вернуть контекст, чьи аспекты слоёв считаются к первичной карте ``method``.

    Для ``method`` in (None, '', 'natal') — возвращает ``base_context`` без изменений
    (цель аспектов = натал, исходное поведение). Иначе деривирует первичную карту и
    оборачивает через :meth:`NatalContext.with_primary`.

    Raises:
        ValueError: неизвестный ``method``.
    """
    method = (method or 'natal').strip()
    if method == 'natal':
        return base_context
    if method not in VALID_PRIMARY_METHODS:
        raise ValueError(
            f"Invalid primary.method: {method!r}. Must be one of {sorted(VALID_PRIMARY_METHODS)}"
        )

    params = params or {}

    if method == 'direction':
        from app.services.direction_service import DirectionService
        payload = DirectionService(db).calculate_direction_from_context(
            base_context,
            target_date=_parse_date(params.get('target_date')),
            direction_type=params.get('direction_type') or 'zodiacal',
        )
        calc_like = _calc_like_from_direction(payload)
    elif method == 'progression':
        from app.services.progression_service import ProgressionService
        payload = ProgressionService(db).calculate_progression_from_context(
            base_context,
            target_date=_parse_date(params.get('target_date')),
            target_time=_parse_time(params.get('target_time')),
            timezone=params.get('timezone'),
        )
        calc_like = _calc_like_from_progression(payload)
    else:  # solar_return
        from app.services.solar_return_service import SolarReturnService
        payload = SolarReturnService(db).calculate_solar_return_from_context(
            base_context,
            year=int(params['year']),
            location_lat=params.get('location_lat'),
            location_lon=params.get('location_lon'),
            location_name=params.get('location_name'),
            location_timezone=params.get('location_timezone'),
        )
        calc_like = _calc_like_from_solar(payload)

    return NatalContext.with_primary(base_context, calc_like)
