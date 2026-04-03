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
    TransitEventsCache
)
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.services.special_points_service import SpecialPointsService
from app.services.preferences_runtime import PreferencesRuntimeResolver
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
        timezone: str
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
        # 1. Загрузить натальные данные
        natal_data = self._load_natal_data(user_id)
        if natal_data is None:
            raise ValueError(f"Natal chart not found for user_id={user_id}")

        # 2. Рассчитать транзитный JD
        utc_dt, jd_transit = TimeService.process_birth_time(transit_date, transit_time, timezone)

        # 3. Рассчитать транзитные планеты + узлы и Лилит
        transit_planets = self.swisseph_engine.calculate_planets(jd_transit)
        transit_planets.extend(self._calculate_transit_special_bodies(jd_transit))

        # 4. Определить натальные дома для транзитных планет
        for planet in transit_planets:
            planet['natal_house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], natal_data['houses']
            )

        # 5. Рассчитать транзит→натал аспекты
        aspects = self._calculate_transit_aspects(user_id, transit_planets, natal_data)

        return {
            'transit_info': {
                'date': transit_date.isoformat(),
                'time': transit_time.isoformat(),
                'timezone': timezone,
                'utc_time': utc_dt.isoformat(),
                'julian_day': jd_transit,
            },
            'transit_planets': transit_planets,
            'aspects': aspects,
        }

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
            self._aspect_types_cache = self.db.query(RefAspectType).all()
        return self._aspect_types_cache

    def _get_planet_orbs(self) -> Dict[Tuple[str, str], float]:
        """Получить орбисы планет с кешированием"""
        if self._planet_orbs_cache is None:
            orbs = self.db.query(RefPlanetOrb).all()
            self._planet_orbs_cache = {
                (orb.planet, orb.aspect_type): float(orb.orb)
                for orb in orbs
            }
        return self._planet_orbs_cache

    def _get_base_orbs(self) -> Dict[str, float]:
        """Получить base_orb для всех типов аспектов (с кэшированием)."""
        if not hasattr(self, '_base_orbs_cache'):
            aspects = self.db.query(RefAspectType).all()
            self._base_orbs_cache = {a.aspect_type: float(a.base_orb) for a in aspects}
        return self._base_orbs_cache

    def _calculate_allowed_orb(self, user_id: UUID, body_a: str, body_b: str, aspect_type: str) -> float:
        """Разрешённый орбис для транзитной пары через account methodology."""
        astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)
        if astrologer_id:
            return self.preferences_runtime.resolve_orb_for_astrologer(
                astrologer_id,
                body_a,
                body_b,
                aspect_type,
                orb_profile='prognostic',
            )
        return PROGNOSTIC_DEFAULT_ORB

    def _calculate_transit_special_bodies(self, jd: float) -> List[Dict]:
        """Рассчитать транзитные позиции узлов и Лилит."""
        north, south = SpecialPointsService.calculate_true_nodes(jd)
        lilith = SpecialPointsService.calculate_black_moon(jd)
        special_longs = [
            ('TrueNorthNode', north),
            ('TrueSouthNode', south),
            ('BlackMoon', lilith),
        ]
        bodies: List[Dict] = []
        for name, longitude in special_longs:
            degree_in_sign = get_degree_in_sign(longitude)
            bodies.append({
                'name': name,
                'longitude': longitude,
                'sign': get_zodiac_sign(longitude),
                'degree_in_sign': degree_in_sign,
                'degree_in_sign_formatted': format_degree_minutes_seconds(degree_in_sign),
                'retrograde': False,
                'speed': 0.0,
                'type': 'transit_planet',
            })
        return bodies

    def _calculate_transit_aspects(
        self,
        user_id: UUID,
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

        for transit_obj in transit_objects:
            for natal_obj in natal_objects:
                aspect = self._check_aspect(user_id, transit_obj, natal_obj, aspect_types)
                if aspect:
                    aspects.append(aspect)

        return aspects

    def _check_aspect(
        self,
        user_id: UUID,
        transit_obj: Dict,
        natal_obj: Dict,
        aspect_types: List[RefAspectType]
    ) -> Optional[Dict]:
        """Проверить наличие аспекта между транзитным и натальным объектом"""
        diff = abs(transit_obj['longitude'] - natal_obj['longitude'])
        if diff > 180:
            diff = 360 - diff

        for aspect_type in aspect_types:
            exact_angle = float(aspect_type.exact_angle)
            max_orb = self._calculate_allowed_orb(
                user_id,
                transit_obj['name'],
                natal_obj['name'],
                aspect_type.aspect_type,
            )
            deviation = abs(diff - exact_angle)

            if deviation <= max_orb:
                return {
                    'transit_planet': transit_obj['name'],
                    'natal_object': natal_obj['name'],
                    'natal_object_type': natal_obj['type'],
                    'aspect_type': aspect_type.aspect_type,
                    'orb': round(deviation, 4),
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
                        user_id, t_name, n_obj['name'], asp.aspect_type
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
        positions = self._get_transit_positions(jd)
        return positions.get(transit_body)

    def _get_transit_positions(self, jd: float) -> Dict[str, float]:
        """
        Получить словарь долгот всех транзитных тел на момент JD с кешированием.
        Ключ кеша нормализован по точности float, чтобы повторные вычисления
        в бинарном/тернарном поиске не пересчитывали ephemeris заново.
        """
        cache_key = round(jd, 10)
        cached = self._transit_positions_cache.get(cache_key)
        if cached is not None:
            return cached

        if len(self._transit_positions_cache) > 10000:
            self._transit_positions_cache.clear()

        transit_planets = self.swisseph_engine.calculate_planets(jd)
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
