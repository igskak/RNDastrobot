"""
Transit Service - расчёт транзитов для сохранённых натальных карт

Поддерживает:
1. Транзиты на момент времени (calculate_transits)
2. Поиск транзитных событий на период (find_transit_events) — как в ZET Aspects Diagram
"""
from typing import List, Dict, Optional, Tuple
from uuid import UUID
from datetime import date, time, datetime, timedelta
from sqlalchemy.orm import Session
import swisseph as swe
import pytz

import json
from decimal import Decimal
from loguru import logger

from app.database.models import (
    User, NatalPlanet, NatalSpecialPoint, Angle, NatalHouse, RefAspectType, RefPlanetOrb,
    TransitEventsCache, Astrologer
)
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.services.special_points_service import SpecialPointsService
from app.services.planet_characteristics_service import PlanetCharacteristicsService
from app.services.preferences_runtime import (
    PreferencesRuntimeResolver, DEFAULT_STATIONARY_THRESHOLD_PERCENT,
)
from app.services.reference_data_cache import get_aspect_types, get_planet_orbs
from app.services.natal_context import NatalContext
from app.utils.constants import (
    get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds,
    PROGNOSTIC_EXCLUDED_NATAL_TARGETS, PROGNOSTIC_EXACT_ORB, PROGNOSTIC_DEFAULT_ORB,
    TRANSIT_FOCUSED_BODIES, TRANSIT_FOCUSED_NATAL_TARGETS,
)


class TransitService:
    """Сервис для расчёта транзитов к натальной карте"""
    _BOUNDARY_SEARCH_DAYS = 45

    def __init__(self, db_session: Session, ephe_path: str = None):
        self.db = db_session
        self.swisseph_engine = SwissEphemerisEngine(ephe_path)
        self.preferences_runtime = PreferencesRuntimeResolver(db_session)
        self._aspect_types_cache: Optional[List[RefAspectType]] = None
        self._planet_orbs_cache: Optional[Dict[Tuple[str, str], float]] = None
        self._transit_positions_cache: Dict[float, Dict[str, float]] = {}

    def calculate_transits(
        self,
        user_id: UUID,
        transit_date: date,
        transit_time: time,
        timezone: str,
        location: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> Dict:
        """
        Расчёт транзитов для пользователя

        Args:
            user_id: ID пользователя с сохранённой натальной картой
            transit_date: Дата транзита
            transit_time: Время транзита
            timezone: Часовой пояс

        Returns:
            Dict с транзитными данными и аспектами к наталу
        """
        # 1. Построить контекст натала из сохранённого клиента (DB-путь)
        context = self._build_context_from_user_id(user_id)
        if context is None:
            raise ValueError(f"Natal chart not found for user_id={user_id}")
        return self.calculate_transits_from_context(
            context,
            transit_date,
            transit_time,
            timezone,
            location=location,
            latitude=latitude,
            longitude=longitude,
        )

    def calculate_transits_from_context(
        self,
        context: NatalContext,
        transit_date: date,
        transit_time: time,
        timezone: str,
        location: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> Dict:
        """Расчёт транзитов для произвольного источника натала (сохранённого или inline).

        Это «настоящее» ядро: ``calculate_transits(user_id, ...)`` — тонкая обёртка,
        строящая контекст из БД. Inline-путь (ephemeral-карта) строит контекст через
        ``NatalContext.from_inline`` и зовёт этот метод напрямую.
        """
        natal_data = context.natal_data

        # 2. Рассчитать транзитный JD
        utc_dt, jd_transit = TimeService.process_birth_time(transit_date, transit_time, timezone)

        # 3. Рассчитать транзитные планеты и дома
        self._active_zodiac = context.zodiac or 'tropical'
        self._active_ayanamsha = context.ayanamsha or 'lahiri'
        transit_planets = self.swisseph_engine.calculate_planets(
            jd_transit,
            zodiac=self._active_zodiac,
            ayanamsha=self._active_ayanamsha,
        )

        transit_houses = []
        transit_angles = {}
        if latitude is not None and longitude is not None:
            transit_houses, transit_angles = self.swisseph_engine.calculate_houses(
                jd=jd_transit,
                lat=float(latitude),
                lon=float(longitude),
                hsys=context.house_system,
                zodiac=self._active_zodiac,
                ayanamsha=self._active_ayanamsha,
            )

        transit_planets.extend(self._calculate_transit_special_bodies(
            jd_transit,
            transit_houses=transit_houses,
            transit_angles=transit_angles,
            transit_planets=transit_planets,
            latitude=latitude,
            longitude=longitude,
        ))
        self._enrich_motion_flags(transit_planets, astrologer_id=context.astrologer_id)

        # 4. Определить натальные и транзитные дома для транзитных планет
        for planet in transit_planets:
            planet['natal_house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], natal_data['houses']
            )
            if transit_houses:
                planet['house'] = self.swisseph_engine.get_planet_house(
                    planet['longitude'], transit_houses
                )

        # 5. Рассчитать транзит→натал аспекты
        aspects = self._calculate_transit_aspects(context.astrologer_id, transit_planets, natal_data)

        return {
            'transit_info': {
                'date': transit_date.isoformat(),
                'time': transit_time.isoformat(),
                'timezone': timezone,
                'utc_time': utc_dt.isoformat(),
                'julian_day': jd_transit,
                'location': location,
                'latitude': latitude,
                'longitude': longitude,
            },
            'transit_planets': transit_planets,
            'transit_houses': transit_houses,
            'aspects': aspects,
        }

    def _build_context_from_user_id(
        self, user_id: UUID, *, apply_exclusions: bool = True
    ) -> Optional[NatalContext]:
        """Построить NatalContext из сохранённого клиента (DB-путь).

        Несёт всё, что user_id давал косвенно: натал, astrologer_id (орбисы/стационарность),
        house_system. Inline-путь строит контекст через ``NatalContext.from_inline``.
        """
        natal_data = self._load_natal_data(user_id, apply_exclusions=apply_exclusions)
        if natal_data is None:
            return None
        astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)
        house_system = 'P'
        user = self.db.query(User).filter(User.user_id == user_id).first()
        if user and user.astrologer_id:
            astrologer = self.db.query(Astrologer).filter(Astrologer.id == user.astrologer_id).first()
            house_system = astrologer.default_house_system if astrologer and astrologer.default_house_system else 'P'
        return NatalContext(
            natal_data=natal_data,
            astrologer_id=astrologer_id,
            house_system=house_system,
            zodiac=getattr(user, 'zodiac', None) or 'tropical',
            ayanamsha=getattr(user, 'ayanamsha', None),
            user_id=user_id,
        )

    def _enrich_motion_flags(self, planets: List[Dict], *, astrologer_id: Optional[UUID]) -> List[Dict]:
        if astrologer_id:
            stationary_threshold_percent = self.preferences_runtime.get_stationary_threshold_for_astrologer(astrologer_id)
        else:
            stationary_threshold_percent = DEFAULT_STATIONARY_THRESHOLD_PERCENT
        for planet in planets:
            name = planet.get('name', '')
            speed = float(planet.get('speed') or 0.0)
            retrograde = bool(planet.get('retrograde') or planet.get('is_retrograde'))
            planet['speed_percent'] = PlanetCharacteristicsService.calculate_speed_percent(name, speed)
            is_stationary, stationary_type = PlanetCharacteristicsService.calculate_stationary_status(
                name,
                speed,
                retrograde,
                threshold_percent=stationary_threshold_percent,
            )
            planet['is_stationary'] = is_stationary
            planet['stationary_type'] = stationary_type
        return planets

    def _load_natal_data(self, user_id: UUID, apply_exclusions: bool = True) -> Optional[Dict]:
        """Загрузить натальные данные из БД. apply_exclusions=False — не применять PROGNOSTIC_EXCLUDED."""
        # Проверяем существование пользователя
        user = self.db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return None

        # Загружаем планеты
        planets = self.db.query(NatalPlanet).filter(NatalPlanet.user_id == user_id).all()
        natal_planets = [
            {'name': p.planet, 'longitude': float(p.degree), 'type': 'planet'}
            for p in planets
        ]

        # Загружаем спецточки
        special_points = self.db.query(NatalSpecialPoint).filter(
            NatalSpecialPoint.user_id == user_id
        ).all()
        natal_special_points = [
            {'name': sp.point, 'longitude': float(sp.degree), 'type': 'special_point'}
            for sp in special_points
        ]

        # Загружаем углы
        angles = self.db.query(Angle).filter(Angle.user_id == user_id).first()
        natal_angles = []
        if angles:
            natal_angles = [
                {'name': 'ASC', 'longitude': float(angles.asc_degree), 'type': 'angle'},
                {'name': 'MC', 'longitude': float(angles.mc_degree), 'type': 'angle'},
                {'name': 'IC', 'longitude': float(angles.ic_degree), 'type': 'angle'},
                {'name': 'DSC', 'longitude': float(angles.dsc_degree), 'type': 'angle'},
            ]
            if angles.vertex_degree:
                natal_angles.append(
                    {'name': 'Vertex', 'longitude': float(angles.vertex_degree), 'type': 'angle'}
                )

        # Загружаем дома (для определения положения транзитных планет)
        houses = self.db.query(NatalHouse).filter(
            NatalHouse.user_id == user_id
        ).order_by(NatalHouse.house_number).all()
        natal_houses = [
            {'number': h.house_number, 'longitude': float(h.cusp_degree)}
            for h in houses
        ]

        # Фильтруем исключённые натальные цели для прогностики
        all_objects = natal_planets + natal_special_points + natal_angles
        if apply_exclusions:
            all_objects = [
                o for o in all_objects
                if o['name'] not in PROGNOSTIC_EXCLUDED_NATAL_TARGETS
            ]

        return {
            'planets': natal_planets,
            'special_points': natal_special_points,
            'angles': natal_angles,
            'houses': natal_houses,
            'all_objects': all_objects,
        }

    def _get_aspect_types(self) -> List[RefAspectType]:
        """Получить типы аспектов с кешированием"""
        if self._aspect_types_cache is None:
            self._aspect_types_cache = get_aspect_types(self.db)
        return self._aspect_types_cache

    def _get_planet_orbs(self) -> Dict[Tuple[str, str], float]:
        """Получить орбисы планет с кешированием"""
        if self._planet_orbs_cache is None:
            orbs = get_planet_orbs(self.db)
            self._planet_orbs_cache = {
                (orb.planet, orb.aspect_type): float(orb.orb)
                for orb in orbs
            }
        return self._planet_orbs_cache

    def _get_base_orbs(self) -> Dict[str, float]:
        """Получить base_orb для всех типов аспектов (с кэшированием)."""
        if not hasattr(self, '_base_orbs_cache'):
            aspects = get_aspect_types(self.db)
            self._base_orbs_cache = {a.aspect_type: float(a.base_orb) for a in aspects}
        return self._base_orbs_cache

    def _calculate_allowed_orb(self, astrologer_id: Optional[UUID], body_a: str, body_b: str, aspect_type: str) -> float:
        """Разрешённый орбис для транзитной пары через account methodology."""
        if astrologer_id:
            return self.preferences_runtime.resolve_orb_for_astrologer(
                astrologer_id,
                body_a,
                body_b,
                aspect_type,
                orb_profile='prognostic',
            )
        return PROGNOSTIC_DEFAULT_ORB

    def _calculate_transit_special_bodies(
        self,
        jd: float,
        *,
        transit_houses: Optional[List[Dict]] = None,
        transit_angles: Optional[Dict] = None,
        transit_planets: Optional[List[Dict]] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> List[Dict]:
        """Рассчитать транзитные позиции спецточек единым набором для панелей."""
        north, south = SpecialPointsService.calculate_true_nodes(jd)
        lilith = SpecialPointsService.calculate_black_moon(jd)
        selena = SpecialPointsService.calculate_white_moon(jd)
        special_longs = [
            ('TrueNorthNode', north),
            ('TrueSouthNode', south),
            ('BlackMoon', lilith),
            ('WhiteMoon', selena),
        ]
        asc_lon = (transit_angles or {}).get('ASC', {}).get('longitude')
        sun = next((body for body in (transit_planets or []) if body.get('name') == 'Sun'), None)
        moon = next((body for body in (transit_planets or []) if body.get('name') == 'Moon'), None)
        if asc_lon is not None and sun and moon:
            sun_house = sun.get('house') or (
                self.swisseph_engine.get_planet_house(sun['longitude'], transit_houses or [])
                if transit_houses else 1
            )
            fortune = SpecialPointsService.calculate_part_of_fortune(
                asc_lon,
                sun['longitude'],
                moon['longitude'],
                sun_house,
                jd=jd,
                latitude=latitude,
                longitude=longitude,
            )
            special_longs.append(('Fortune', fortune))

        bodies: List[Dict] = []
        for name, longitude in special_longs:
            degree_in_sign = get_degree_in_sign(longitude)
            body = {
                'name': name,
                'longitude': longitude,
                'sign': get_zodiac_sign(longitude),
                'degree_in_sign': degree_in_sign,
                'degree_in_sign_formatted': format_degree_minutes_seconds(degree_in_sign),
                'retrograde': False,
                'speed': 0.0,
                'type': 'transit_planet',
            }
            if transit_houses:
                body['house'] = self.swisseph_engine.get_planet_house(longitude, transit_houses)
            bodies.append(body)
        return bodies

    def _calculate_transit_aspects(
        self,
        astrologer_id: Optional[UUID],
        transit_planets: List[Dict],
        natal_data: Dict
    ) -> List[Dict]:
        """
        Расчёт аспектов между транзитными и натальными объектами.
        Транзит → Натал (не натал→натал и не транзит→транзит).
        """
        aspects = []
        aspect_types = self._get_aspect_types()
        natal_objects = natal_data['all_objects']

        # Конвертируем транзитные планеты в формат объектов
        transit_objects = [
            {'name': p['name'], 'longitude': p['longitude'], 'type': 'transit_planet'}
            for p in transit_planets
        ]

        # Pre-compute orb lookup table (один раз вместо N*M*K вызовов)
        orb_lookup: Dict[Tuple[str, str, str], float] = {}
        for t_obj in transit_objects:
            for n_obj in natal_objects:
                for asp in aspect_types:
                    key = (t_obj['name'], n_obj['name'], asp.aspect_type)
                    orb_lookup[key] = self._calculate_allowed_orb(
                        astrologer_id, t_obj['name'], n_obj['name'], asp.aspect_type
                    )

        for transit_obj in transit_objects:
            for natal_obj in natal_objects:
                aspect = self._check_aspect_fast(transit_obj, natal_obj, aspect_types, orb_lookup)
                if aspect:
                    aspects.append(aspect)

        return aspects

    def _check_aspect_fast(
        self,
        transit_obj: Dict,
        natal_obj: Dict,
        aspect_types: List[RefAspectType],
        orb_lookup: Dict[Tuple[str, str, str], float],
    ) -> Optional[Dict]:
        """Проверить наличие аспекта с предвычисленными орбисами."""
        diff = abs(transit_obj['longitude'] - natal_obj['longitude'])
        if diff > 180:
            diff = 360 - diff

        for aspect_type in aspect_types:
            exact_angle = float(aspect_type.exact_angle)
            max_orb = orb_lookup[(transit_obj['name'], natal_obj['name'], aspect_type.aspect_type)]
            deviation = abs(diff - exact_angle)

            if deviation <= max_orb:
                return {
                    'transit_planet': transit_obj['name'],
                    'natal_object': natal_obj['name'],
                    'natal_object_type': natal_obj['type'],
                    'aspect_type': aspect_type.aspect_type,
                    'orb': round(deviation, 4),
                    'max_allowed_orb': max_orb,
                    'is_exact': deviation <= PROGNOSTIC_EXACT_ORB,
                    'is_major': aspect_type.class_ == 'major',
                    'harmonic_type': aspect_type.character,
                }

        return None

    # ========== ПОИСК СОБЫТИЙ НА ПЕРИОД (как в ZET Aspects Diagram) ==========

    def find_transit_events(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
        timezone: str,
        step_hours: int = 6,
        transit_bodies: Optional[List[str]] = None,
        natal_bodies: Optional[List[str]] = None,
        aspect_types: Optional[List[str]] = None,
        use_cache: bool = True,
        save_to_db: bool = True,
    ) -> List[Dict]:
        """
        Поиск транзитных событий на период (как в ZET Aspects Diagram).

        Находит интервалы, когда транзитная планета образует аспект к натальному объекту:
        - t_enter: момент входа в орбис
        - t_exact: точный момент аспекта (минимальный орбис)
        - t_leave: момент выхода из орбиса

        Args:
            user_id: ID пользователя
            start_date: Начало периода
            end_date: Конец периода
            timezone: Часовой пояс
            step_hours: Шаг сканирования в часах (по умолчанию 6)
            transit_bodies: Фильтр транзитных тел (None = все)
            natal_bodies: Фильтр натальных объектов (None = все)
            aspect_types: Фильтр типов аспектов (None = все)
            use_cache: Проверить кэш перед расчётом (по умолчанию True)
            save_to_db: Сохранить результат в кэш (по умолчанию True)

        Returns:
            Список событий с t_enter, t_exact, t_leave
        """
        # 0. Применить фокусные дефолты (медленные → личностные/социальные)
        if transit_bodies is None:
            transit_bodies = list(TRANSIT_FOCUSED_BODIES)
        if natal_bodies is None:
            natal_bodies = list(TRANSIT_FOCUSED_NATAL_TARGETS)

        # 0.5. Проверить кэш (после применения дефолтов, чтобы ключ был корректным)
        if use_cache:
            cached = self.get_cached_transit_events(
                user_id, start_date, end_date, timezone,
                step_hours, transit_bodies, natal_bodies, aspect_types
            )
            if cached is not None:
                if not self._cache_maybe_boundary_clipped(cached, start_date, end_date, timezone):
                    return cached

        # 1. Загрузить натальные данные (без blacklist — allowlist сам фильтрует)
        natal_data = self._load_natal_data(user_id, apply_exclusions=False)
        if natal_data is None:
            raise ValueError(f"Natal chart not found for user_id={user_id}")
        astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)

        # 2. Получить типы аспектов
        all_aspect_types = self._get_aspect_types()
        if aspect_types:
            all_aspect_types = [a for a in all_aspect_types if a.aspect_type in aspect_types]

        # 3. Фильтровать натальные объекты
        natal_objects = natal_data['all_objects']
        if natal_bodies:
            natal_objects = [o for o in natal_objects if o['name'] in natal_bodies]
        natal_obj_by_name = {o['name']: o for o in natal_objects}
        aspect_type_by_name = {a.aspect_type: a for a in all_aspect_types}

        # 4. Рассчитать JD границ периода
        _, jd_start = TimeService.process_birth_time(start_date, time(0, 0), timezone)
        _, jd_end = TimeService.process_birth_time(end_date, time(23, 59, 59), timezone)

        # 5. Сканировать период с заданным шагом
        step_jd = step_hours / 24.0
        events = []

        # 5.1. Pre-compute orb lookup table (один раз вместо N*M*K вызовов в цикле)
        orb_lookup: Dict[Tuple[str, str, str], float] = {}
        exact_angle_lookup: Dict[str, float] = {}
        for asp in all_aspect_types:
            exact_angle_lookup[asp.aspect_type] = float(asp.exact_angle)
            for t_name in transit_bodies:
                for n_obj in natal_objects:
                    key = (t_name, n_obj['name'], asp.aspect_type)
                    orb_lookup[key] = self._calculate_allowed_orb(
                        astrologer_id, t_name, n_obj['name'], asp.aspect_type
                    )

        # Словарь для отслеживания активных аспектов
        # Ключ: (transit_body, natal_body, aspect_type)
        active_aspects: Dict[Tuple[str, str, str], Dict] = {}

        # Множество имён транзитных тел для быстрого фильтра
        transit_bodies_set = set(transit_bodies) if transit_bodies else None

        jd = jd_start
        while jd <= jd_end:
            # Рассчитать транзитные позиции через кэширующий метод
            positions = self._get_transit_positions(jd)

            # Проверить все пары транзит→натал
            current_aspects = set()

            for t_name in transit_bodies:
                t_lon = positions.get(t_name)
                if t_lon is None:
                    continue
                for natal_obj in natal_objects:
                    for aspect_type in all_aspect_types:
                        aspect_key = (t_name, natal_obj['name'], aspect_type.aspect_type)

                        # Проверить аспект
                        diff = abs(t_lon - natal_obj['longitude'])
                        if diff > 180:
                            diff = 360 - diff

                        exact_angle = exact_angle_lookup[aspect_type.aspect_type]
                        max_orb = orb_lookup[aspect_key]
                        deviation = abs(diff - exact_angle)

                        if deviation <= max_orb:
                            current_aspects.add(aspect_key)

                            if aspect_key not in active_aspects:
                                # Новый аспект — запомнить t_enter
                                active_aspects[aspect_key] = {
                                    'transit_body': t_name,
                                    'natal_body': natal_obj['name'],
                                    'natal_type': natal_obj['type'],
                                    'aspect_type': aspect_type.aspect_type,
                                    'is_major': aspect_type.class_ == 'major',
                                    'harmonic_type': aspect_type.character,
                                    'max_allowed_orb': max_orb,
                                    'jd_enter': jd,
                                    'jd_exact': jd,
                                    'min_orb': deviation,
                                }
                            else:
                                # Обновить t_exact если орбис меньше
                                if deviation < active_aspects[aspect_key]['min_orb']:
                                    active_aspects[aspect_key]['min_orb'] = deviation
                                    active_aspects[aspect_key]['jd_exact'] = jd

            # Проверить завершённые аспекты (были активны, теперь нет)
            completed_keys = [k for k in active_aspects if k not in current_aspects]
            for key in completed_keys:
                aspect_data = active_aspects.pop(key)
                aspect_data['jd_leave'] = jd
                if abs(aspect_data['jd_enter'] - jd_start) < 1e-9:
                    aspect_data['jd_enter'] = self._find_aspect_boundary_jd(
                        anchor_jd=jd_start,
                        direction=-1,
                        step_jd=step_jd,
                        transit_body=aspect_data['transit_body'],
                        natal_longitude=float(natal_obj_by_name[aspect_data['natal_body']]['longitude']),
                        exact_angle=float(aspect_type_by_name[aspect_data['aspect_type']].exact_angle),
                        max_orb=float(aspect_data['max_allowed_orb']),
                    )
                exact_jd, min_orb = self._find_aspect_exact_and_orb(
                    jd_enter=aspect_data['jd_enter'],
                    jd_leave=aspect_data['jd_leave'],
                    step_jd=step_jd,
                    transit_body=aspect_data['transit_body'],
                    natal_longitude=float(natal_obj_by_name[aspect_data['natal_body']]['longitude']),
                    exact_angle=float(aspect_type_by_name[aspect_data['aspect_type']].exact_angle),
                )
                aspect_data['jd_exact'] = exact_jd
                aspect_data['min_orb'] = min_orb
                events.append(self._format_transit_event(aspect_data, timezone))

            jd += step_jd

        # 6. Закрыть аспекты, которые ещё активны в конце периода
        for key, aspect_data in active_aspects.items():
            if abs(aspect_data['jd_enter'] - jd_start) < 1e-9:
                aspect_data['jd_enter'] = self._find_aspect_boundary_jd(
                    anchor_jd=jd_start,
                    direction=-1,
                    step_jd=step_jd,
                    transit_body=aspect_data['transit_body'],
                    natal_longitude=float(natal_obj_by_name[aspect_data['natal_body']]['longitude']),
                    exact_angle=float(aspect_type_by_name[aspect_data['aspect_type']].exact_angle),
                    max_orb=float(aspect_data['max_allowed_orb']),
                )
            aspect_data['jd_leave'] = self._find_aspect_boundary_jd(
                anchor_jd=jd_end,
                direction=1,
                step_jd=step_jd,
                transit_body=aspect_data['transit_body'],
                natal_longitude=float(natal_obj_by_name[aspect_data['natal_body']]['longitude']),
                exact_angle=float(aspect_type_by_name[aspect_data['aspect_type']].exact_angle),
                max_orb=float(aspect_data['max_allowed_orb']),
            )
            exact_jd, min_orb = self._find_aspect_exact_and_orb(
                jd_enter=aspect_data['jd_enter'],
                jd_leave=aspect_data['jd_leave'],
                step_jd=step_jd,
                transit_body=aspect_data['transit_body'],
                natal_longitude=float(natal_obj_by_name[aspect_data['natal_body']]['longitude']),
                exact_angle=float(aspect_type_by_name[aspect_data['aspect_type']].exact_angle),
            )
            aspect_data['jd_exact'] = exact_jd
            aspect_data['min_orb'] = min_orb
            events.append(self._format_transit_event(aspect_data, timezone))

        # 7. Отсортировать по t_enter
        events.sort(key=lambda e: e['t_enter'])

        # 8. Сохранить в кэш
        if save_to_db:
            try:
                self._save_transit_events_cache(
                    user_id, start_date, end_date, timezone,
                    step_hours, transit_bodies, natal_bodies, aspect_types, events
                )
            except Exception as e:
                logger.warning(f"Failed to cache transit events: {e}")

        return events

    def _cache_maybe_boundary_clipped(
        self,
        cached_events: List[Dict],
        start_date: date,
        end_date: date,
        timezone: str,
    ) -> bool:
        """Проверка старого кэша: t_enter/t_leave могли быть обрезаны границами периода."""
        start_iso = self._day_boundary_iso(start_date, timezone, is_end=False)
        end_iso = self._day_boundary_iso(end_date, timezone, is_end=True)
        start_iso_legacy = f"{start_date.isoformat()}T00:00:00Z"
        end_iso_legacy = f"{end_date.isoformat()}T23:59:59Z"
        for ev in cached_events or []:
            if (
                ev.get('t_enter') in (start_iso, start_iso_legacy)
                or ev.get('t_leave') in (end_iso, end_iso_legacy)
            ):
                return True
        return False

    def _day_boundary_iso(self, target_date: date, timezone: str, is_end: bool) -> str:
        tz = pytz.timezone(timezone)
        local_time = time(23, 59, 59) if is_end else time(0, 0, 0)
        local_dt = tz.localize(datetime.combine(target_date, local_time))
        return local_dt.isoformat(timespec='seconds')

    def _find_aspect_boundary_jd(
        self,
        anchor_jd: float,
        direction: int,
        step_jd: float,
        transit_body: str,
        natal_longitude: float,
        exact_angle: float,
        max_orb: float,
    ) -> float:
        """
        Найти реальную границу аспекта (вход/выход из орбиса) за пределами окна сканирования.
        direction: -1 для поиска входа назад, +1 для поиска выхода вперёд.
        """
        if direction not in (-1, 1):
            return anchor_jd

        anchor_active = self._is_aspect_active_at_jd(
            anchor_jd, transit_body, natal_longitude, exact_angle, max_orb
        )
        if not anchor_active:
            return anchor_jd

        max_steps = max(1, int(self._BOUNDARY_SEARCH_DAYS / max(step_jd, 1e-6)))
        prev_jd = anchor_jd

        for _ in range(max_steps):
            probe_jd = prev_jd + direction * step_jd
            probe_active = self._is_aspect_active_at_jd(
                probe_jd, transit_body, natal_longitude, exact_angle, max_orb
            )

            if not probe_active:
                if direction == -1:
                    left, right = probe_jd, prev_jd  # inactive -> active
                else:
                    left, right = prev_jd, probe_jd  # active -> inactive
                return self._binary_search_boundary_jd(
                    left, right, direction, transit_body, natal_longitude, exact_angle, max_orb
                )

            prev_jd = probe_jd

        return anchor_jd

    def _binary_search_boundary_jd(
        self,
        left_jd: float,
        right_jd: float,
        direction: int,
        transit_body: str,
        natal_longitude: float,
        exact_angle: float,
        max_orb: float,
    ) -> float:
        """Уточнить границу аспекта бинарным поиском."""
        left = left_jd
        right = right_jd
        for _ in range(16):
            mid = (left + right) / 2.0
            mid_active = self._is_aspect_active_at_jd(
                mid, transit_body, natal_longitude, exact_angle, max_orb
            )
            if direction == -1:
                # Ищем переход inactive -> active (вход)
                if mid_active:
                    right = mid
                else:
                    left = mid
            else:
                # Ищем переход active -> inactive (выход)
                if mid_active:
                    left = mid
                else:
                    right = mid
        return (left + right) / 2.0

    def _find_aspect_exact_and_orb(
        self,
        jd_enter: float,
        jd_leave: float,
        step_jd: float,
        transit_body: str,
        natal_longitude: float,
        exact_angle: float,
    ) -> Tuple[float, float]:
        """Найти точный момент аспекта и минимальный орбис на полном интервале события."""
        if jd_leave < jd_enter:
            jd_enter, jd_leave = jd_leave, jd_enter
        if abs(jd_leave - jd_enter) < 1e-9:
            dev = self._aspect_deviation_at_jd(
                jd_enter, transit_body, natal_longitude, exact_angle
            )
            return jd_enter, dev

        sample_step = max(min(step_jd / 2.0, 1.0 / 12.0), 1.0 / 48.0)
        best_jd = jd_enter
        best_dev = float('inf')

        jd = jd_enter
        while jd <= jd_leave:
            dev = self._aspect_deviation_at_jd(
                jd, transit_body, natal_longitude, exact_angle
            )
            if dev < best_dev:
                best_dev = dev
                best_jd = jd
            jd += sample_step

        end_dev = self._aspect_deviation_at_jd(
            jd_leave, transit_body, natal_longitude, exact_angle
        )
        if end_dev < best_dev:
            best_dev = end_dev
            best_jd = jd_leave

        left = max(jd_enter, best_jd - sample_step)
        right = min(jd_leave, best_jd + sample_step)
        if right <= left:
            return best_jd, best_dev

        for _ in range(20):
            m1 = left + (right - left) / 3.0
            m2 = right - (right - left) / 3.0
            d1 = self._aspect_deviation_at_jd(m1, transit_body, natal_longitude, exact_angle)
            d2 = self._aspect_deviation_at_jd(m2, transit_body, natal_longitude, exact_angle)
            if d1 <= d2:
                right = m2
            else:
                left = m1

        refined_jd = (left + right) / 2.0
        refined_dev = self._aspect_deviation_at_jd(
            refined_jd, transit_body, natal_longitude, exact_angle
        )
        if refined_dev < best_dev:
            return refined_jd, refined_dev
        return best_jd, best_dev

    def _is_aspect_active_at_jd(
        self,
        jd: float,
        transit_body: str,
        natal_longitude: float,
        exact_angle: float,
        max_orb: float,
    ) -> bool:
        """Проверить, активен ли аспект для конкретной пары на момент JD."""
        transit_longitude = self._get_transit_body_longitude(jd, transit_body)
        if transit_longitude is None:
            return False

        diff = abs(transit_longitude - natal_longitude)
        if diff > 180:
            diff = 360 - diff
        deviation = abs(diff - exact_angle)
        return deviation <= max_orb

    def _aspect_deviation_at_jd(
        self,
        jd: float,
        transit_body: str,
        natal_longitude: float,
        exact_angle: float,
    ) -> float:
        """Отклонение аспекта (orb deviation) на момент JD."""
        transit_longitude = self._get_transit_body_longitude(jd, transit_body)
        if transit_longitude is None:
            return float('inf')
        diff = abs(transit_longitude - natal_longitude)
        if diff > 180:
            diff = 360 - diff
        return abs(diff - exact_angle)

    def _get_transit_body_longitude(self, jd: float, transit_body: str) -> Optional[float]:
        """Получить долготу транзитного тела на момент JD."""
        longitude = self.swisseph_engine.calculate_planet_longitude(
            jd,
            transit_body,
            zodiac=getattr(self, '_active_zodiac', 'tropical'),
            ayanamsha=getattr(self, '_active_ayanamsha', 'lahiri'),
        )
        if longitude is not None:
            return longitude
        positions = self._get_transit_positions(jd)
        return positions.get(transit_body)

    def _get_transit_positions(self, jd: float) -> Dict[str, float]:
        """
        Получить словарь долгот всех транзитных тел на момент JD с кешированием.
        Ключ кеша нормализован по точности float, чтобы повторные вычисления
        в бинарном/тернарном поиске не пересчитывали ephemeris заново.
        """
        cache_key = (round(jd, 10), getattr(self, '_active_zodiac', 'tropical'), getattr(self, '_active_ayanamsha', 'lahiri'))
        cached = self._transit_positions_cache.get(cache_key)
        if cached is not None:
            return cached

        if len(self._transit_positions_cache) > 10000:
            self._transit_positions_cache.clear()

        transit_planets = self.swisseph_engine.calculate_planets(
            jd,
            zodiac=getattr(self, '_active_zodiac', 'tropical'),
            ayanamsha=getattr(self, '_active_ayanamsha', 'lahiri'),
        )
        transit_planets.extend(self._calculate_transit_special_bodies(jd))
        positions = {body['name']: float(body['longitude']) for body in transit_planets}
        self._transit_positions_cache[cache_key] = positions
        return positions

    def _format_transit_event(self, aspect_data: Dict, timezone: str) -> Dict:
        """Форматировать событие транзита для ответа API"""
        return {
            'transit_body': aspect_data['transit_body'],
            'natal_body': aspect_data['natal_body'],
            'natal_type': aspect_data['natal_type'],
            'aspect_type': aspect_data['aspect_type'],
            't_enter': self._jd_to_iso(aspect_data['jd_enter'], timezone),
            't_exact': self._jd_to_iso(aspect_data['jd_exact'], timezone),
            't_leave': self._jd_to_iso(aspect_data['jd_leave'], timezone),
            'min_orb': round(aspect_data['min_orb'], 4),
            'max_allowed_orb': aspect_data['max_allowed_orb'],
            'is_exact': aspect_data['min_orb'] <= PROGNOSTIC_EXACT_ORB,
            'is_major': aspect_data['is_major'],
            'harmonic_type': aspect_data['harmonic_type'],
        }

    def _jd_to_iso(self, jd: float, timezone: str) -> str:
        """Конвертировать Julian Day в ISO строку"""
        year, month, day, hour_frac = swe.revjul(jd)
        hours = int(hour_frac)
        minutes = int((hour_frac - hours) * 60)
        seconds = int(((hour_frac - hours) * 60 - minutes) * 60)

        utc_dt = datetime(year, month, day, hours, minutes, seconds, tzinfo=pytz.UTC)
        target_tz = pytz.timezone(timezone)
        local_dt = utc_dt.astimezone(target_tz)
        return local_dt.isoformat(timespec='seconds')

    # ========================================================================
    # Aspect passes engine (assistant feature — signed-angle root finding)
    #
    # Unlike find_transit_events (which collapses a retrograde loop into ONE
    # interval with ONE jd_exact), this finds EVERY exact crossing within a
    # contact by locating the roots of a signed, unwrapped angular residual.
    # That makes it correct for conjunctions (residual is the signed
    # separation, sign-changing at 0°), oppositions (the ±180° branch is
    # handled by re-wrapping the residual), and retrograde triple-passes.
    # Orbs come from the astrologer's configured prognostic profile via
    # _calculate_allowed_orb (no hardcoded orbs).
    # ========================================================================

    CALC_VERSION = 'aspect_passes_v1'
    DYNAMICS_CALC_VERSION = 'aspect_dynamics_v1'

    # Forward-scan caps (days) for next_contact auto-expansion, by transit body.
    _NEXT_CONTACT_CAP_DAYS: Dict[str, int] = {
        'Moon': 45, 'Sun': 420, 'Mercury': 420, 'Venus': 540, 'Mars': 900,
        'Jupiter': 650, 'Saturn': 1150, 'Chiron': 1900,
        'Uranus': 1650, 'Neptune': 2300, 'Pluto': 2700, 'Proserpina': 4000,
    }
    _DEFAULT_NEXT_CONTACT_CAP_DAYS = 1150
    _MAX_SCAN_SAMPLES = 60000  # hard guard against runaway scans
    _SCAN_STEP_DAYS: Dict[str, float] = {
        'Moon': 1.0 / 24.0,
        'Sun': 0.25,
        'Mercury': 0.25,
        'Venus': 0.25,
        'Mars': 0.5,
    }
    _DEFAULT_SCAN_STEP_DAYS = 1.0
    _DEFAULT_DYNAMICS_POINTS = 320
    _MAX_DYNAMICS_POINTS = 720

    @staticmethod
    def _wrap_pm180(value: float) -> float:
        """Wrap an angle into (-180, 180]."""
        return ((value + 180.0) % 360.0) - 180.0

    def _signed_sep_at_jd(
        self, jd: float, transit_body: str, natal_longitude: float
    ) -> Optional[float]:
        """Signed ecliptic separation transit−natal, wrapped to (-180, 180]."""
        tlon = self._get_transit_body_longitude(jd, transit_body)
        if tlon is None:
            return None
        return self._wrap_pm180(tlon - natal_longitude)

    def _aspect_residual_at_jd(
        self, jd: float, transit_body: str, natal_longitude: float, target: float
    ) -> Optional[float]:
        """
        Residual whose root is the exact aspect on the given side.

        target is +exact_angle or -exact_angle. The residual is re-wrapped to
        (-180, 180] so it is continuous and changes sign across the aspect even
        at the 180° branch (opposition).
        """
        sep = self._signed_sep_at_jd(jd, transit_body, natal_longitude)
        if sep is None:
            return None
        return self._wrap_pm180(sep - target)

    def _aspect_targets(self, exact_angle: float) -> List[float]:
        """Aspect sides for a signed residual: one side for 0/180, two otherwise."""
        if exact_angle in (0.0, 180.0):
            return [exact_angle]
        return [exact_angle, -exact_angle]

    def _select_aspect_target(
        self, jd: float, transit_body: str, natal_longitude: float, exact_angle: float
    ) -> float:
        """Choose the aspect side closest to the selected moment."""
        targets = self._aspect_targets(exact_angle)
        if len(targets) == 1:
            return targets[0]
        scored = []
        for target in targets:
            residual = self._aspect_residual_at_jd(jd, transit_body, natal_longitude, target)
            if residual is None:
                continue
            scored.append((abs(residual), target))
        return min(scored, default=(0.0, targets[0]))[1]

    def _signed_orb_at_jd(
        self,
        jd: float,
        transit_body: str,
        natal_longitude: float,
        exact_angle: float,
        target: Optional[float] = None,
    ) -> Optional[float]:
        """Signed aspect orb for graphing, where 0 is the exact aspect line."""
        resolved_target = target
        if resolved_target is None:
            resolved_target = self._select_aspect_target(
                jd, transit_body, natal_longitude, exact_angle
            )
        return self._aspect_residual_at_jd(
            jd, transit_body, natal_longitude, resolved_target
        )

    def _format_aspect_dynamics_point(
        self,
        jd: float,
        timezone: str,
        transit_body: str,
        natal_longitude: float,
        exact_angle: float,
        max_orb: float,
        target: float,
    ) -> Dict:
        signed_orb = self._signed_orb_at_jd(
            jd, transit_body, natal_longitude, exact_angle, target
        )
        abs_orb = self._aspect_deviation_at_jd(
            jd, transit_body, natal_longitude, exact_angle
        )
        strength = 0.0
        if max_orb > 0 and abs_orb != float('inf'):
            strength = max(0.0, min(1.0, 1.0 - (abs_orb / max_orb)))
        return {
            'datetime': self._jd_to_iso(jd, timezone),
            'julian_day': round(jd, 8),
            'signed_orb': round(float(signed_orb), 6) if signed_orb is not None else None,
            'abs_orb': round(float(abs_orb), 6) if abs_orb != float('inf') else None,
            'strength': round(strength, 6),
            'in_orb': abs_orb <= max_orb,
        }

    def _build_aspect_dynamics_series(
        self,
        jd_start: float,
        jd_end: float,
        timezone: str,
        transit_body: str,
        natal_longitude: float,
        exact_angle: float,
        max_orb: float,
        target: float,
        max_points: int,
    ) -> List[Dict]:
        """Sample signed aspect-orb values across the graph window."""
        if jd_end < jd_start:
            jd_start, jd_end = jd_end, jd_start
        point_count = max(2, min(int(max_points), self._MAX_DYNAMICS_POINTS))
        if abs(jd_end - jd_start) < 1e-9:
            return [
                self._format_aspect_dynamics_point(
                    jd_start, timezone, transit_body, natal_longitude,
                    exact_angle, max_orb, target,
                )
            ]

        step = (jd_end - jd_start) / float(point_count - 1)
        return [
            self._format_aspect_dynamics_point(
                jd_start + step * idx,
                timezone,
                transit_body,
                natal_longitude,
                exact_angle,
                max_orb,
                target,
            )
            for idx in range(point_count)
        ]

    def _transit_speed_at_jd(
        self, jd: float, transit_body: str, h: float = 0.05
    ) -> float:
        """Longitudinal speed (deg/day) via central finite difference."""
        before = self._get_transit_body_longitude(jd - h, transit_body)
        after = self._get_transit_body_longitude(jd + h, transit_body)
        if before is None or after is None:
            return 0.0
        return self._wrap_pm180(after - before) / (2.0 * h)

    def _bisect_residual_root(
        self, jd_lo: float, jd_hi: float, transit_body: str,
        natal_longitude: float, target: float,
    ) -> float:
        """Refine an exact aspect crossing bracketed by a residual sign change."""
        r_lo = self._aspect_residual_at_jd(jd_lo, transit_body, natal_longitude, target)
        if r_lo is None:
            return 0.5 * (jd_lo + jd_hi)
        for _ in range(40):
            jd_mid = 0.5 * (jd_lo + jd_hi)
            r_mid = self._aspect_residual_at_jd(jd_mid, transit_body, natal_longitude, target)
            if r_mid is None:
                return jd_mid
            if (r_lo <= 0) == (r_mid <= 0):
                jd_lo, r_lo = jd_mid, r_mid
            else:
                jd_hi = jd_mid
        return 0.5 * (jd_lo + jd_hi)

    def _bisect_orb_boundary(
        self, jd_a: float, jd_b: float, transit_body: str,
        natal_longitude: float, exact_angle: float, max_orb: float,
    ) -> float:
        """Refine the orb-boundary crossing (deviation == max_orb)."""
        f_a = self._aspect_deviation_at_jd(jd_a, transit_body, natal_longitude, exact_angle) - max_orb
        for _ in range(30):
            jd_m = 0.5 * (jd_a + jd_b)
            f_m = self._aspect_deviation_at_jd(jd_m, transit_body, natal_longitude, exact_angle) - max_orb
            if (f_a <= 0) == (f_m <= 0):
                jd_a, f_a = jd_m, f_m
            else:
                jd_b = jd_m
        return 0.5 * (jd_a + jd_b)

    def _bisect_speed_zero(
        self, jd_a: float, jd_b: float, transit_body: str,
    ) -> float:
        """Refine a station (speed == 0) bracketed by a speed sign change."""
        s_a = self._transit_speed_at_jd(jd_a, transit_body)
        for _ in range(30):
            jd_m = 0.5 * (jd_a + jd_b)
            s_m = self._transit_speed_at_jd(jd_m, transit_body)
            if (s_a < 0) == (s_m < 0):
                jd_a, s_a = jd_m, s_m
            else:
                jd_b = jd_m
        return 0.5 * (jd_a + jd_b)

    def _scan_aspect_contacts(
        self, transit_body: str, natal_longitude: float, exact_angle: float,
        max_orb: float, jd_start: float, jd_end: float, step_jd: float,
    ) -> List[Dict]:
        """
        Scan [jd_start, jd_end] and return contact intervals with their exact
        passes (roots) and stations. A contact is a maximal interval where the
        unsigned orb deviation stays within max_orb.
        """
        # Conjunction (0°) and opposition (180°) have a single aspect side;
        # every other aspect has two (transit ahead vs behind natal).
        if exact_angle in (0.0, 180.0):
            targets = [exact_angle]
        else:
            targets = [exact_angle, -exact_angle]

        contacts: List[Dict] = []
        cur: Optional[Dict] = None
        prev_jd: Optional[float] = None
        prev_res: Dict[float, Optional[float]] = {t: None for t in targets}
        prev_speed: Optional[float] = None

        jd = jd_start
        samples = 0
        while jd <= jd_end + 1e-9:
            samples += 1
            if samples > self._MAX_SCAN_SAMPLES:
                break
            dev = self._aspect_deviation_at_jd(jd, transit_body, natal_longitude, exact_angle)
            in_orb = dev <= max_orb
            speed = self._transit_speed_at_jd(jd, transit_body)
            res = {
                t: self._aspect_residual_at_jd(jd, transit_body, natal_longitude, t)
                for t in targets
            }

            if in_orb and cur is None:
                if prev_jd is not None:
                    enter_jd = self._bisect_orb_boundary(
                        prev_jd, jd, transit_body, natal_longitude, exact_angle, max_orb)
                    enter_complete = True
                else:
                    enter_jd = jd  # window opened already inside orb
                    enter_complete = False
                cur = {
                    'jd_enter': enter_jd, 'enter_complete': enter_complete,
                    'passes': [], 'stations': [],
                    'min_orb': dev, 'min_orb_jd': jd,
                }

            if cur is not None and in_orb:
                if dev < cur['min_orb']:
                    cur['min_orb'] = dev
                    cur['min_orb_jd'] = jd
                # Exact crossings: residual root per aspect side. A root that
                # lands exactly on a sample (r1 == 0) is captured directly;
                # otherwise a strict sign change brackets it for bisection.
                for t in targets:
                    r0 = prev_res[t]
                    r1 = res[t]
                    if r1 is None:
                        continue
                    if r1 == 0.0:
                        root_jd = jd
                    elif (r0 is not None and r0 != 0.0
                            and (r0 < 0) != (r1 < 0)):
                        root_jd = self._bisect_residual_root(
                            prev_jd, jd, transit_body, natal_longitude, t)
                    else:
                        continue
                    spd = self._transit_speed_at_jd(root_jd, transit_body)
                    root_dev = self._aspect_deviation_at_jd(
                        root_jd, transit_body, natal_longitude, exact_angle)
                    cur['passes'].append({
                        'jd': root_jd,
                        'motion': 'retrograde' if spd < 0 else 'direct',
                        'orb': root_dev,
                    })
                # Stations: speed sign change inside the contact.
                if (prev_speed is not None and prev_speed != 0.0
                        and (prev_speed < 0) != (speed < 0)):
                    st_jd = self._bisect_speed_zero(prev_jd, jd, transit_body)
                    cur['stations'].append({
                        'jd': st_jd,
                        'type': 'R' if prev_speed > 0 and speed < 0 else 'D',
                    })

            if cur is not None and not in_orb:
                cur['jd_leave'] = self._bisect_orb_boundary(
                    prev_jd, jd, transit_body, natal_longitude, exact_angle, max_orb)
                cur['leave_complete'] = True
                contacts.append(cur)
                cur = None

            prev_jd = jd
            prev_res = res
            prev_speed = speed
            jd += step_jd

        if cur is not None:
            cur['jd_leave'] = jd_end
            cur['leave_complete'] = False
            contacts.append(cur)

        return contacts

    def find_aspect_passes(
        self,
        user_id: UUID,
        transit_body: str,
        natal_body: str,
        aspect_type: str,
        timezone: str,
        *,
        anchor_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        max_expansion_days: Optional[int] = None,
    ) -> Dict:
        """
        Find when a transiting body forms a given aspect to a natal object:
        enter / each exact crossing / leave, with retrograde motion per pass
        and station dates through each contact.

        Window resolution:
        - If start_date AND end_date are given → mode 'window' (scan that range).
        - Otherwise → mode 'next_contact': scan forward from anchor_date
          (default today), auto-expanding up to a per-body cap, and return the
          first contact found.

        Orbs are the astrologer's configured prognostic orbs.
        Returns a structured dict (see CALC_VERSION) with machine-readable
        result-quality fields so a caller never has to trust prose.
        """
        natal_data = self._load_natal_data(user_id, apply_exclusions=False)
        if natal_data is None:
            raise ValueError(f"Natal chart not found for user_id={user_id}")

        natal_obj = next(
            (o for o in natal_data['all_objects'] if o['name'] == natal_body), None)
        aspect_type_obj = next(
            (a for a in self._get_aspect_types() if a.aspect_type == aspect_type), None)

        base = {
            'transit_body': transit_body,
            'natal_body': natal_body,
            'aspect_type': aspect_type,
            'timezone': timezone,
            'calc_version': self.CALC_VERSION,
        }
        if natal_obj is None:
            return {**base, 'status': 'unknown_natal_body', 'contacts': []}
        if aspect_type_obj is None:
            return {**base, 'status': 'unknown_aspect_type', 'contacts': []}

        natal_longitude = float(natal_obj['longitude'])
        exact_angle = float(aspect_type_obj.exact_angle)

        astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)
        max_orb = self._calculate_allowed_orb(
            astrologer_id, transit_body, natal_body, aspect_type)
        base['exact_angle'] = exact_angle
        base['orb_used'] = round(max_orb, 4)
        base['orb_source'] = 'astrologer_settings' if astrologer_id else 'default'

        # Resolve scan window.
        if start_date is not None and end_date is not None:
            mode = 'window'
            _, jd_start = TimeService.process_birth_time(start_date, time(0, 0), timezone)
            _, jd_end = TimeService.process_birth_time(end_date, time(23, 59, 59), timezone)
            requested_window = {'start': start_date.isoformat(), 'end': end_date.isoformat()}
            cap_days = None
        else:
            mode = 'next_contact'
            anchor = anchor_date or date.today()
            cap_days = max_expansion_days or self._NEXT_CONTACT_CAP_DAYS.get(
                transit_body, self._DEFAULT_NEXT_CONTACT_CAP_DAYS)
            _, jd_start = TimeService.process_birth_time(anchor, time(0, 0), timezone)
            _, jd_end = TimeService.process_birth_time(
                anchor + timedelta(days=cap_days), time(23, 59, 59), timezone)
            requested_window = {'anchor': anchor.isoformat(), 'cap_days': cap_days}

        # Validate transit body resolves at all.
        if self._get_transit_body_longitude(jd_start, transit_body) is None:
            return {**base, 'status': 'unsupported_transit_body', 'contacts': []}

        # Fast bodies need finer sampling; slow-body roots and boundaries are
        # bracketed safely at one day and then refined independently.
        step_jd = self._SCAN_STEP_DAYS.get(transit_body, self._DEFAULT_SCAN_STEP_DAYS)

        contacts_raw = self._scan_aspect_contacts(
            transit_body, natal_longitude, exact_angle, max_orb,
            jd_start, jd_end, step_jd)

        if mode == 'next_contact':
            contacts_raw = contacts_raw[:1]

        contacts = [self._format_aspect_contact(c, timezone) for c in contacts_raw]

        if contacts:
            status = 'ok'
            window_cap_reached = (
                mode == 'next_contact' and not contacts_raw[-1]['leave_complete'])
            boundary_complete = all(
                c['enter_complete'] and c['leave_complete'] for c in contacts_raw)
        else:
            status = 'no_contact_in_window'
            window_cap_reached = (mode == 'next_contact')
            boundary_complete = True

        return {
            **base,
            'status': status,
            'mode': mode,
            'requested_window': requested_window,
            'effective_window': {
                'start': self._jd_to_iso(jd_start, timezone),
                'end': self._jd_to_iso(jd_end, timezone),
            },
            'window_cap_reached': window_cap_reached,
            'boundary_complete': boundary_complete,
            'contacts': contacts,
        }

    def calculate_aspect_dynamics(
        self,
        user_id: UUID,
        transit_body: str,
        natal_body: str,
        aspect_type: str,
        selected_date: date,
        selected_time: time,
        timezone: str,
        *,
        contact_start: Optional[date] = None,
        contact_end: Optional[date] = None,
        max_points: int = _DEFAULT_DYNAMICS_POINTS,
    ) -> Dict:
        """Return graph-ready signed-orb dynamics for one transit→natal aspect."""
        context = self._build_context_from_user_id(user_id, apply_exclusions=False)
        if context is None:
            raise ValueError(f"Natal chart not found for user_id={user_id}")
        self._active_zodiac = context.zodiac or 'tropical'
        self._active_ayanamsha = context.ayanamsha or 'lahiri'

        natal_obj = next(
            (o for o in context.natal_data['all_objects'] if o['name'] == natal_body),
            None,
        )
        aspect_type_obj = next(
            (a for a in self._get_aspect_types() if a.aspect_type == aspect_type),
            None,
        )
        base = {
            'transit_body': transit_body,
            'natal_body': natal_body,
            'aspect_type': aspect_type,
            'timezone': timezone,
            'calc_version': self.DYNAMICS_CALC_VERSION,
        }
        if natal_obj is None:
            return {**base, 'status': 'unknown_natal_body', 'contacts': [], 'series': []}
        if aspect_type_obj is None:
            return {**base, 'status': 'unknown_aspect_type', 'contacts': [], 'series': []}

        _, selected_jd = TimeService.process_birth_time(selected_date, selected_time, timezone)
        if self._get_transit_body_longitude(selected_jd, transit_body) is None:
            return {**base, 'status': 'unsupported_transit_body', 'contacts': [], 'series': []}

        natal_longitude = float(natal_obj['longitude'])
        exact_angle = float(aspect_type_obj.exact_angle)
        astrologer_id = context.astrologer_id
        max_orb = self._calculate_allowed_orb(
            astrologer_id, transit_body, natal_body, aspect_type
        )
        target = self._select_aspect_target(
            selected_jd, transit_body, natal_longitude, exact_angle
        )
        selected_point = self._format_aspect_dynamics_point(
            selected_jd, timezone, transit_body, natal_longitude,
            exact_angle, max_orb, target,
        )

        base.update({
            'exact_angle': exact_angle,
            'orb_used': round(max_orb, 4),
            'orb_source': 'astrologer_settings' if astrologer_id else 'default',
            'target_angle': target,
            'selected_point': selected_point,
        })

        step_jd = self._SCAN_STEP_DAYS.get(transit_body, self._DEFAULT_SCAN_STEP_DAYS)
        requested_window = {
            'selected': self._jd_to_iso(selected_jd, timezone),
        }
        if contact_start is not None and contact_end is not None:
            _, jd_start = TimeService.process_birth_time(contact_start, time(0, 0), timezone)
            _, jd_end = TimeService.process_birth_time(contact_end, time(23, 59, 59), timezone)
            requested_window.update({
                'start': contact_start.isoformat(),
                'end': contact_end.isoformat(),
            })
        else:
            cap_days = self._NEXT_CONTACT_CAP_DAYS.get(
                transit_body, self._DEFAULT_NEXT_CONTACT_CAP_DAYS
            )
            jd_start = selected_jd - cap_days
            jd_end = selected_jd + cap_days
            requested_window['cap_days_each_side'] = cap_days

        contacts_raw = self._scan_aspect_contacts(
            transit_body, natal_longitude, exact_angle, max_orb,
            jd_start, jd_end, step_jd,
        )
        contact_for_selected = next(
            (
                contact for contact in contacts_raw
                if contact['jd_enter'] - 1e-7 <= selected_jd <= contact['jd_leave'] + 1e-7
            ),
            None,
        )

        if contact_for_selected is None:
            graph_half_window = max(15.0, min(180.0, (jd_end - jd_start) / 12.0))
            graph_start = max(jd_start, selected_jd - graph_half_window)
            graph_end = min(jd_end, selected_jd + graph_half_window)
            contacts = []
            status = 'selected_not_in_orb'
            boundary_complete = True
        else:
            duration = max(contact_for_selected['jd_leave'] - contact_for_selected['jd_enter'], 1.0)
            padding = min(max(duration * 0.12, 3.0), 45.0)
            graph_start = max(jd_start, contact_for_selected['jd_enter'] - padding)
            graph_end = min(jd_end, contact_for_selected['jd_leave'] + padding)
            contacts = [self._format_aspect_contact(contact_for_selected, timezone)]
            status = 'ok'
            boundary_complete = (
                contact_for_selected['enter_complete']
                and contact_for_selected['leave_complete']
            )

        series = self._build_aspect_dynamics_series(
            graph_start,
            graph_end,
            timezone,
            transit_body,
            natal_longitude,
            exact_angle,
            max_orb,
            target,
            max_points,
        )

        return {
            **base,
            'status': status,
            'requested_window': requested_window,
            'effective_window': {
                'start': self._jd_to_iso(graph_start, timezone),
                'end': self._jd_to_iso(graph_end, timezone),
            },
            'boundary_complete': boundary_complete,
            'contacts': contacts,
            'series': series,
        }

    def _format_aspect_contact(self, contact: Dict, timezone: str) -> Dict:
        """Format an internal contact (JD-based) into an API-facing dict."""
        return {
            'enter': self._jd_to_iso(contact['jd_enter'], timezone),
            'enter_complete': contact['enter_complete'],
            'leave': self._jd_to_iso(contact['jd_leave'], timezone),
            'leave_complete': contact['leave_complete'],
            'exact_pass_count': len(contact['passes']),
            'passes': [
                {
                    'date': self._jd_to_iso(p['jd'], timezone),
                    'motion': p['motion'],
                    'orb': round(p['orb'], 4),
                }
                for p in sorted(contact['passes'], key=lambda p: p['jd'])
            ],
            'stations': [
                {'date': self._jd_to_iso(s['jd'], timezone), 'type': s['type']}
                for s in sorted(contact['stations'], key=lambda s: s['jd'])
            ],
            'closest_approach': {
                'orb': round(contact['min_orb'], 4),
                'date': self._jd_to_iso(contact['min_orb_jd'], timezone),
            },
        }

    # ========================================================================
    # Cache methods
    # ========================================================================

    def get_cached_transit_events(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
        timezone: str,
        step_hours: int = 6,
        transit_bodies: Optional[List[str]] = None,
        natal_bodies: Optional[List[str]] = None,
        aspect_types: Optional[List[str]] = None,
    ) -> Optional[List[Dict]]:
        """
        Получить кэшированные транзитные события.

        Ищет точное совпадение по user_id + period + параметрам расчёта.
        Возвращает None если кэш не найден.
        """
        query = self.db.query(TransitEventsCache).filter(
            TransitEventsCache.user_id == user_id,
            TransitEventsCache.start_date == start_date,
            TransitEventsCache.end_date == end_date,
            TransitEventsCache.timezone == timezone,
            TransitEventsCache.step_hours == step_hours,
        )
        methodology_hash = self.preferences_runtime.get_methodology_hash_for_user(user_id)

        # Фильтры: null в БД = все тела, сортированный JSON для сравнения
        tb_json = sorted(transit_bodies) if transit_bodies else None
        nb_json = sorted(natal_bodies) if natal_bodies else None
        af_json = sorted(aspect_types) if aspect_types else None

        cached = query.all()
        for entry in cached:
            stored_tb = sorted(entry.transit_bodies) if entry.transit_bodies else None
            stored_nb = sorted(entry.natal_bodies) if entry.natal_bodies else None
            stored_af = sorted(entry.aspect_filter) if entry.aspect_filter else None

            if (
                stored_tb == tb_json
                and stored_nb == nb_json
                and stored_af == af_json
                and (entry.methodology_hash or '') == methodology_hash
            ):
                logger.info(
                    f"Transit events cache HIT: user={user_id}, "
                    f"period={start_date}..{end_date}, events={entry.events_count}"
                )
                return entry.events_data

        return None

    def _save_transit_events_cache(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
        timezone: str,
        step_hours: int,
        transit_bodies: Optional[List[str]],
        natal_bodies: Optional[List[str]],
        aspect_types: Optional[List[str]],
        events: List[Dict],
    ) -> None:
        """Сохранить результат find_transit_events в кэш."""
        cache_entry = TransitEventsCache(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            timezone=timezone,
            step_hours=step_hours,
            transit_bodies=sorted(transit_bodies) if transit_bodies else None,
            natal_bodies=sorted(natal_bodies) if natal_bodies else None,
            aspect_filter=sorted(aspect_types) if aspect_types else None,
            methodology_hash=self.preferences_runtime.get_methodology_hash_for_user(user_id),
            events_data=events,
            events_count=len(events),
        )
        self.db.add(cache_entry)
        self.db.commit()
        logger.info(
            f"Transit events cached: user={user_id}, "
            f"period={start_date}..{end_date}, events={len(events)}"
        )
