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

import json
from decimal import Decimal
from loguru import logger

from app.database.models import (
    User, NatalPlanet, NatalSpecialPoint, Angle, NatalHouse, RefAspectType, RefPlanetOrb,
    TransitEventsCache
)
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds


class TransitService:
    """Сервис для расчёта транзитов к натальной карте"""

    def __init__(self, db_session: Session, ephe_path: str = None):
        self.db = db_session
        self.swisseph_engine = SwissEphemerisEngine(ephe_path)
        self._aspect_types_cache: Optional[List[RefAspectType]] = None
        self._planet_orbs_cache: Optional[Dict[Tuple[str, str], float]] = None

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

        # 3. Рассчитать транзитные планеты
        transit_planets = self.swisseph_engine.calculate_planets(jd_transit)

        # 4. Определить натальные дома для транзитных планет
        for planet in transit_planets:
            planet['natal_house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], natal_data['houses']
            )

        # 5. Рассчитать транзит→натал аспекты
        aspects = self._calculate_transit_aspects(transit_planets, natal_data)

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

    def _load_natal_data(self, user_id: UUID) -> Optional[Dict]:
        """Загрузить натальные данные из БД"""
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

        return {
            'planets': natal_planets,
            'special_points': natal_special_points,
            'angles': natal_angles,
            'houses': natal_houses,
            'all_objects': natal_planets + natal_special_points + natal_angles,
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

    def _calculate_allowed_orb(self, body_a: str, body_b: str, aspect_type: str) -> float:
        """
        Расчёт допустимого орбиса для пары тел.
        Правило: берём МАКСИМАЛЬНЫЙ орбис из двух тел.
        """
        planet_orbs = self._get_planet_orbs()
        base_orbs = self._get_base_orbs()

        orb_a = planet_orbs.get((body_a, aspect_type))
        orb_b = planet_orbs.get((body_b, aspect_type))

        # Fallback на base_orb из ref_aspect_types (кэшировано)
        fallback_orb = base_orbs.get(aspect_type, 5.0)
        if orb_a is None:
            orb_a = fallback_orb
        if orb_b is None:
            orb_b = fallback_orb

        return max(orb_a, orb_b)

    def _calculate_transit_aspects(
        self,
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
                aspect = self._check_aspect(transit_obj, natal_obj, aspect_types)
                if aspect:
                    aspects.append(aspect)

        return aspects

    def _check_aspect(
        self,
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
                transit_obj['name'], natal_obj['name'], aspect_type.aspect_type
            )
            deviation = abs(diff - exact_angle)

            if deviation <= max_orb:
                return {
                    'transit_planet': transit_obj['name'],
                    'natal_object': natal_obj['name'],
                    'natal_object_type': natal_obj['type'],
                    'aspect_type': aspect_type.aspect_type,
                    'orb': round(deviation, 4),
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
        # 0. Проверить кэш
        if use_cache:
            cached = self.get_cached_transit_events(
                user_id, start_date, end_date, timezone,
                step_hours, transit_bodies, natal_bodies, aspect_types
            )
            if cached is not None:
                return cached

        # 1. Загрузить натальные данные
        natal_data = self._load_natal_data(user_id)
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

        # 4. Рассчитать JD границ периода
        _, jd_start = TimeService.process_birth_time(start_date, time(0, 0), timezone)
        _, jd_end = TimeService.process_birth_time(end_date, time(23, 59, 59), timezone)

        # 5. Сканировать период с заданным шагом
        step_jd = step_hours / 24.0
        events = []

        # Словарь для отслеживания активных аспектов
        # Ключ: (transit_body, natal_body, aspect_type)
        active_aspects: Dict[Tuple[str, str, str], Dict] = {}

        jd = jd_start
        while jd <= jd_end:
            # Рассчитать транзитные позиции
            transit_planets = self.swisseph_engine.calculate_planets(jd)

            # Фильтр транзитных тел
            if transit_bodies:
                transit_planets = [p for p in transit_planets if p['name'] in transit_bodies]

            # Проверить все пары транзит→натал
            current_aspects = set()

            for transit_obj in transit_planets:
                for natal_obj in natal_objects:
                    for aspect_type in all_aspect_types:
                        aspect_key = (transit_obj['name'], natal_obj['name'], aspect_type.aspect_type)

                        # Проверить аспект
                        diff = abs(transit_obj['longitude'] - natal_obj['longitude'])
                        if diff > 180:
                            diff = 360 - diff

                        exact_angle = float(aspect_type.exact_angle)
                        max_orb = self._calculate_allowed_orb(
                            transit_obj['name'], natal_obj['name'], aspect_type.aspect_type
                        )
                        deviation = abs(diff - exact_angle)

                        if deviation <= max_orb:
                            current_aspects.add(aspect_key)

                            if aspect_key not in active_aspects:
                                # Новый аспект — запомнить t_enter
                                active_aspects[aspect_key] = {
                                    'transit_body': transit_obj['name'],
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
                events.append(self._format_transit_event(aspect_data, timezone))

            jd += step_jd

        # 6. Закрыть аспекты, которые ещё активны в конце периода
        for key, aspect_data in active_aspects.items():
            aspect_data['jd_leave'] = jd_end
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
            'is_major': aspect_data['is_major'],
            'harmonic_type': aspect_data['harmonic_type'],
        }

    def _jd_to_iso(self, jd: float, timezone: str) -> str:
        """Конвертировать Julian Day в ISO строку"""
        year, month, day, hour_frac = swe.revjul(jd)
        hours = int(hour_frac)
        minutes = int((hour_frac - hours) * 60)
        seconds = int(((hour_frac - hours) * 60 - minutes) * 60)

        utc_dt = datetime(year, month, day, hours, minutes, seconds)
        return utc_dt.isoformat() + 'Z'

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

        # Фильтры: null в БД = все тела, сортированный JSON для сравнения
        tb_json = sorted(transit_bodies) if transit_bodies else None
        nb_json = sorted(natal_bodies) if natal_bodies else None
        af_json = sorted(aspect_types) if aspect_types else None

        cached = query.all()
        for entry in cached:
            stored_tb = sorted(entry.transit_bodies) if entry.transit_bodies else None
            stored_nb = sorted(entry.natal_bodies) if entry.natal_bodies else None
            stored_af = sorted(entry.aspect_filter) if entry.aspect_filter else None

            if stored_tb == tb_json and stored_nb == nb_json and stored_af == af_json:
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
            events_data=events,
            events_count=len(events),
        )
        self.db.add(cache_entry)
        self.db.commit()
        logger.info(
            f"Transit events cached: user={user_id}, "
            f"period={start_date}..{end_date}, events={len(events)}"
        )

