"""
NatalContext — источник натальной карты для прогностических сервисов.

Развязывает форкаст-сервисы (transit/progression/direction/solar) от обязательного
сохранённого ``user_id`` (план UNIFIED_WORKSPACE_PIVOT_PLAN.md — D3, Findings C1).

``user_id`` исторически нёс не только данные натала, но и косвенно: ``astrologer_id``
(орбисы/стационарность через account methodology) и ``house_system``. NatalContext
несёт всё это явно, поэтому один и тот же сервис работает и для сохранённого клиента
(``from_user_id``-путь строит сервис), и для введённого вручную inline-натала
(``from_inline``), без записи в БД.

Адаптер ``natal_data_from_calc_result`` гарантирует ту же внутреннюю форму, что и
DB-путь (``TransitService._load_natal_data``), — это база для parity-тестов: inline
и сохранённый натал для одних и тех же данных рождения должны давать идентичные аспекты.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date as date_type
from typing import Dict, List, Optional
from uuid import UUID

from app.utils.constants import PROGNOSTIC_EXCLUDED_NATAL_TARGETS


def _parse_iso_date(value) -> Optional[date_type]:
    if value is None or value == '':
        return None
    if isinstance(value, date_type):
        return value
    try:
        return date_type.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def natal_data_from_calc_result(calc_result: Dict, *, apply_exclusions: bool = True) -> Dict:
    """Адаптер: вывод ``NatalChartService.calculate_natal_chart`` → внутренняя форма
    ``_load_natal_data`` ({planets, special_points, angles, houses, all_objects}).

    Должен давать ту же форму, что DB-путь, иначе inline и сохранённый натал разойдутся
    по аспектам (Findings M1).
    """
    planets_in = calc_result.get('planets') or []
    natal_planets = [
        {'name': p['name'], 'longitude': float(p['longitude']), 'type': 'planet'}
        for p in planets_in
    ]

    # special_points в calculate — dict {name: {longitude, ...}}; допускаем и список
    sp_in = calc_result.get('special_points') or {}
    sp_items = sp_in.items() if isinstance(sp_in, dict) else [(sp.get('name'), sp) for sp in sp_in]
    natal_special_points = [
        {'name': name, 'longitude': float(data['longitude']), 'type': 'special_point'}
        for name, data in sp_items
        if data and data.get('longitude') is not None
    ]

    # angles в calculate — dict {ASC: {longitude}, MC, IC, DSC, Vertex, AntiVertex}.
    # DB-путь добавляет только ASC/MC/IC/DSC и опционально Vertex — зеркалим точно.
    angles_in = calc_result.get('angles') or {}
    natal_angles = []
    for name in ('ASC', 'MC', 'IC', 'DSC'):
        a = angles_in.get(name)
        if a and a.get('longitude') is not None:
            natal_angles.append({'name': name, 'longitude': float(a['longitude']), 'type': 'angle'})
    vertex = angles_in.get('Vertex')
    if vertex and vertex.get('longitude') is not None:
        natal_angles.append({'name': 'Vertex', 'longitude': float(vertex['longitude']), 'type': 'angle'})

    houses_in = calc_result.get('houses') or []
    natal_houses = [
        {'number': h['number'], 'longitude': float(h['longitude'])}
        for h in houses_in
        if h.get('longitude') is not None
    ]

    all_objects = natal_planets + natal_special_points + natal_angles
    if apply_exclusions:
        all_objects = [o for o in all_objects if o['name'] not in PROGNOSTIC_EXCLUDED_NATAL_TARGETS]

    return {
        'planets': natal_planets,
        'special_points': natal_special_points,
        'angles': natal_angles,
        'houses': natal_houses,
        'all_objects': all_objects,
    }


def aspect_targets_from_calc_result(calc_result: Dict) -> List[Dict]:
    """Натальные цели для аспектов соляр→натал (со скоростями), форма как у
    solar_return_service._load_natal_aspect_targets. Скорости планет берём из calc_result."""
    targets: List[Dict] = []
    for p in (calc_result.get('planets') or []):
        targets.append({
            'name': p['name'],
            'longitude': float(p['longitude']),
            'type': 'planet',
            'speed': float(p['speed']) if p.get('speed') is not None else 0.0,
        })
    sp_in = calc_result.get('special_points') or {}
    sp_items = sp_in.items() if isinstance(sp_in, dict) else [(sp.get('name'), sp) for sp in sp_in]
    for name, data in sp_items:
        if data and data.get('longitude') is not None:
            targets.append({'name': name, 'longitude': float(data['longitude']), 'type': 'special_point', 'speed': 0.0})
    angles_in = calc_result.get('angles') or {}
    for name in ('ASC', 'MC', 'IC', 'DSC'):
        a = angles_in.get(name)
        if a and a.get('longitude') is not None:
            targets.append({'name': name, 'longitude': float(a['longitude']), 'type': 'angle', 'speed': 0.0})
    vertex = angles_in.get('Vertex')
    if vertex and vertex.get('longitude') is not None:
        targets.append({'name': 'Vertex', 'longitude': float(vertex['longitude']), 'type': 'angle', 'speed': 0.0})
    return [t for t in targets if t['name'] not in PROGNOSTIC_EXCLUDED_NATAL_TARGETS]


@dataclass
class NatalContext:
    """Источник натальной карты для прогностических сервисов.

    Attributes:
        natal_data: внутренняя форма натала ({planets, special_points, angles, houses, all_objects}).
        astrologer_id: для резолва орбисов/порогов стационарности. None → дефолты.
        house_system: код системы домов (для транзитных домов).
        user_id: только для DB-backed карт; None для inline (ephemeral).
        birth_data: данные рождения (для inline — из calc_result).
    """
    natal_data: Dict
    astrologer_id: Optional[UUID] = None
    house_system: str = 'P'
    user_id: Optional[UUID] = None
    birth_data: Optional[Dict] = None
    # Поля рождения, нужные производным методикам (прогрессии/дирекции/соляр):
    # им мало позиций — нужен JD и координаты натала.
    birth_jd: Optional[float] = None
    birth_date: Optional[date_type] = None
    birth_lat: Optional[float] = None
    birth_lon: Optional[float] = None
    birth_timezone: Optional[str] = None
    # Натальные цели для аспектов соляр→натал (со скоростями). DB-путь и inline
    # заполняют их по-своему, чтобы поведение DB-пути осталось идентичным.
    natal_aspect_targets: Optional[List[Dict]] = None

    @property
    def is_ephemeral(self) -> bool:
        return self.user_id is None

    @classmethod
    def from_inline(
        cls,
        calc_result: Dict,
        *,
        astrologer_id: Optional[UUID],
        apply_exclusions: bool = True,
    ) -> "NatalContext":
        """Построить контекст из результата ``NatalChartService.calculate_natal_chart``
        (save_to_db=False). Аутентифицированный астролог имеет ``astrologer_id`` даже для
        ephemeral-карты — передаём его, чтобы орбисы/методика не упали на дефолты (Findings C1)."""
        birth_data = calc_result.get('birth_data') or {}
        return cls(
            natal_data=natal_data_from_calc_result(calc_result, apply_exclusions=apply_exclusions),
            astrologer_id=astrologer_id,
            house_system=(birth_data.get('house_system') or 'P'),
            user_id=None,
            birth_data=birth_data,
            birth_jd=birth_data.get('julian_day'),
            birth_date=_parse_iso_date(birth_data.get('date')),
            birth_lat=birth_data.get('latitude'),
            birth_lon=birth_data.get('longitude'),
            birth_timezone=birth_data.get('timezone'),
            natal_aspect_targets=aspect_targets_from_calc_result(calc_result),
        )
