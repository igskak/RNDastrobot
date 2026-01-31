"""
Direction Service — расчёт дирекций (Directions)

Реализация по образцу ZET. Поддерживаемые типы дирекций:
1. Solar Arc — дуга = движение прогрессивного Солнца от натального
2. Symbolic — дуга = возраст × 1° (1 градус = 1 год)
3. Equatorial (Naibod) — дуга = возраст × ключ Найбода (0.98565°/день)

Все точки карты (планеты, углы, спецточки) смещаются на вычисленную дугу.
Дома остаются натальными.
"""
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from datetime import date, time, datetime
from decimal import Decimal
import json
import swisseph as swe
from sqlalchemy.orm import Session
from loguru import logger

from app.database.models import (
    User, NatalPlanet, NatalHouse, Angle, NatalSpecialPoint,
    RefAspectType, RefPlanetOrb, Direction
)
from app.services.swisseph_engine import SwissEphemerisEngine
from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds


# Константы
TROPICAL_YEAR_DAYS = 365.2421897  # Тропический год в днях
NAIBOD_KEY = 0.98565  # Ключ Найбода: среднее суточное движение Солнца в градусах


class DirectionService:
    """Сервис для расчёта дирекций"""

    # Допустимые типы дирекций
    DIRECTION_TYPES = ('solar_arc', 'symbolic', 'equatorial')

    def __init__(self, db_session: Session, ephe_path: str = None):
        self.db = db_session
        self.swisseph_engine = SwissEphemerisEngine(ephe_path)
        if ephe_path:
            swe.set_ephe_path(ephe_path)
        self._aspect_types_cache: Optional[List[RefAspectType]] = None
        self._planet_orbs_cache: Optional[Dict[Tuple[str, str], float]] = None

    def calculate_direction(
        self,
        user_id: UUID,
        target_date: date,
        direction_type: str = 'solar_arc',
        save_to_db: bool = False
    ) -> Dict:
        """
        Рассчитать дирекционную карту для пользователя.
        
        Args:
            user_id: UUID пользователя с натальной картой
            target_date: Дата, на которую рассчитывается дирекция
            direction_type: Тип дирекции (solar_arc, symbolic, equatorial)
            save_to_db: Сохранить результат в БД
            
        Returns:
            Dict с полными данными дирекционной карты
        """
        if direction_type not in self.DIRECTION_TYPES:
            raise ValueError(f"Invalid direction_type: {direction_type}. "
                           f"Must be one of: {self.DIRECTION_TYPES}")

        # 1. Загрузить данные пользователя
        user = self.db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise ValueError(f"User not found: {user_id}")

        birth_jd = float(user.julian_day)
        birth_date_val = user.birth_date

        # 2. Рассчитать возраст в годах
        days_elapsed = (target_date - birth_date_val).days
        age_years = days_elapsed / TROPICAL_YEAR_DAYS

        # 3. Рассчитать дугу дирекции
        arc_degrees = self._calculate_arc(
            direction_type=direction_type,
            birth_jd=birth_jd,
            age_years=age_years
        )

        # 4. Загрузить натальные данные
        natal_data = self._load_natal_data(user_id)

        # 5. Применить дугу ко всем точкам карты
        directed_planets = self._apply_arc_to_objects(natal_data['planets'], arc_degrees)
        directed_angles = self._apply_arc_to_objects(natal_data['angles'], arc_degrees)
        directed_special_points = self._apply_arc_to_objects(
            natal_data['special_points'], arc_degrees
        )

        # 6. Определить натальные дома для направленных планет
        for planet in directed_planets:
            planet['natal_house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], natal_data['houses']
            )

        # 7. Рассчитать аспекты направленное→натал
        aspects = self._calculate_direction_aspects(
            directed_objects=directed_planets + directed_angles + directed_special_points,
            natal_data=natal_data
        )

        # 8. Формируем результат
        result = {
            'direction_info': {
                'target_date': target_date.isoformat(),
                'direction_type': direction_type,
                'arc_degrees': round(arc_degrees, 6),
                'arc_formatted': format_degree_minutes_seconds(arc_degrees % 360),
                'age_years': round(age_years, 4),
                'method_description': self._get_method_description(direction_type),
            },
            'birth_data': {
                'user_id': str(user.user_id),
                'birth_date': user.birth_date.isoformat(),
                'birth_time': user.birth_time.isoformat() if user.birth_time else None,
                'birth_place': user.birth_place,
                'birth_jd': birth_jd,
            },
            'directed_planets': directed_planets,
            'directed_angles': directed_angles,
            'directed_special_points': directed_special_points,
            'natal_houses': natal_data['houses'],  # Дома остаются натальными
            'aspects_to_natal': aspects,
        }

        # 9. Сохранить в БД если нужно
        if save_to_db:
            self._save_direction(user_id, target_date, direction_type, arc_degrees,
                               age_years, result)

        return result

    def _calculate_arc(
        self,
        direction_type: str,
        birth_jd: float,
        age_years: float
    ) -> float:
        """
        Рассчитать дугу дирекции в зависимости от типа.

        Args:
            direction_type: Тип дирекции
            birth_jd: Julian Day рождения
            age_years: Возраст в годах

        Returns:
            Дуга в градусах
        """
        if direction_type == 'solar_arc':
            # Solar Arc: дуга = позиция прогрессивного Солнца - натальное Солнце
            # Прогрессивный JD = birth_jd + age_years (1 день = 1 год)
            progressed_jd = birth_jd + age_years

            # Получаем позицию натального Солнца
            natal_sun_data, _ = swe.calc_ut(birth_jd, swe.SUN, swe.FLG_SWIEPH)
            natal_sun_lon = natal_sun_data[0]

            # Получаем позицию прогрессивного Солнца
            prog_sun_data, _ = swe.calc_ut(progressed_jd, swe.SUN, swe.FLG_SWIEPH)
            prog_sun_lon = prog_sun_data[0]

            # Дуга = разница (с учётом перехода через 0°)
            arc = prog_sun_lon - natal_sun_lon
            if arc < 0:
                arc += 360

            logger.debug(f"Solar Arc: natal_sun={natal_sun_lon:.4f}°, "
                        f"prog_sun={prog_sun_lon:.4f}°, arc={arc:.4f}°")
            return arc

        elif direction_type == 'symbolic':
            # Symbolic: 1° = 1 год
            arc = age_years * 1.0
            logger.debug(f"Symbolic: age={age_years:.4f} years, arc={arc:.4f}°")
            return arc

        elif direction_type == 'equatorial':
            # Equatorial (Naibod): ключ Найбода = 0.98565°/день
            # За год: 0.98565° × 365.2421897 ≈ 360°
            # Но для дирекций используется: arc = age × 360° / 365.2421897
            # Что эквивалентно: arc = age × NAIBOD_KEY × 365.2421897
            arc = age_years * NAIBOD_KEY * TROPICAL_YEAR_DAYS
            # Нормализуем к 0-360
            arc = arc % 360
            logger.debug(f"Equatorial (Naibod): age={age_years:.4f} years, arc={arc:.4f}°")
            return arc

        raise ValueError(f"Unknown direction_type: {direction_type}")

    def _apply_arc_to_objects(
        self,
        objects: List[Dict],
        arc_degrees: float
    ) -> List[Dict]:
        """
        Применить дугу дирекции к списку объектов.

        Args:
            objects: Список объектов с полем 'longitude'
            arc_degrees: Дуга в градусах

        Returns:
            Новый список с направленными позициями
        """
        directed = []
        for obj in objects:
            new_lon = (obj['longitude'] + arc_degrees) % 360
            directed_obj = {
                **obj,
                'natal_longitude': obj['longitude'],
                'longitude': new_lon,
                'sign': get_zodiac_sign(new_lon),
                'degree_in_sign': get_degree_in_sign(new_lon),
                'degree_in_sign_formatted': format_degree_minutes_seconds(
                    get_degree_in_sign(new_lon)
                ),
                'arc_applied': arc_degrees,
            }
            directed.append(directed_obj)
        return directed

    def _get_method_description(self, direction_type: str) -> str:
        """Получить описание метода дирекции"""
        descriptions = {
            'solar_arc': 'Solar Arc Directions: все точки смещаются на дугу движения Солнца',
            'symbolic': 'Symbolic Directions: 1° = 1 год жизни',
            'equatorial': 'Equatorial (Naibod) Directions: ключ Найбода (0.98565°/день)',
        }
        return descriptions.get(direction_type, 'Unknown method')

    def _load_natal_data(self, user_id: UUID) -> Dict:
        """Загрузить натальные данные из БД"""
        # Планеты
        planets = self.db.query(NatalPlanet).filter(NatalPlanet.user_id == user_id).all()
        natal_planets = [
            {
                'name': p.planet,
                'longitude': float(p.degree),
                'type': 'planet',
                'retrograde': p.retrograde if hasattr(p, 'retrograde') else False,
            }
            for p in planets
        ]

        # Спецточки
        special_points = self.db.query(NatalSpecialPoint).filter(
            NatalSpecialPoint.user_id == user_id
        ).all()
        natal_special_points = [
            {'name': sp.point, 'longitude': float(sp.degree), 'type': 'special_point'}
            for sp in special_points
        ]

        # Углы
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

        # Дома
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
        """Получить base_orb для всех типов аспектов"""
        if not hasattr(self, '_base_orbs_cache'):
            aspects = self.db.query(RefAspectType).all()
            self._base_orbs_cache = {a.aspect_type: float(a.base_orb) for a in aspects}
        return self._base_orbs_cache

    def _calculate_allowed_orb(self, body_a: str, body_b: str, aspect_type: str) -> float:
        """
        Расчёт допустимого орбиса для пары тел.
        Для дирекций используем уменьшенные орбисы (как в прогрессиях): 1° для мажорных.
        """
        planet_orbs = self._get_planet_orbs()
        base_orbs = self._get_base_orbs()

        orb_a = planet_orbs.get((body_a, aspect_type))
        orb_b = planet_orbs.get((body_b, aspect_type))

        fallback_orb = base_orbs.get(aspect_type, 5.0)
        if orb_a is None:
            orb_a = fallback_orb
        if orb_b is None:
            orb_b = fallback_orb

        # Для дирекций орбисы уменьшаем в 5 раз (как в прогрессиях), минимум 1°
        max_orb = max(orb_a, orb_b) / 5.0
        return max(max_orb, 1.0)

    def _calculate_direction_aspects(
        self,
        directed_objects: List[Dict],
        natal_data: Dict
    ) -> List[Dict]:
        """Расчёт аспектов между направленными и натальными объектами"""
        aspects = []
        aspect_types = self._get_aspect_types()
        natal_objects = natal_data['all_objects']

        for dir_obj in directed_objects:
            for natal_obj in natal_objects:
                # Пропускаем аспект объекта к самому себе
                if dir_obj['name'] == natal_obj['name']:
                    continue

                aspect = self._check_aspect(dir_obj, natal_obj, aspect_types)
                if aspect:
                    aspects.append(aspect)

        return aspects

    def _check_aspect(
        self,
        dir_obj: Dict,
        natal_obj: Dict,
        aspect_types: List[RefAspectType]
    ) -> Optional[Dict]:
        """Проверить наличие аспекта между направленным и натальным объектом"""
        diff = abs(dir_obj['longitude'] - natal_obj['longitude'])
        if diff > 180:
            diff = 360 - diff

        for aspect_type in aspect_types:
            exact_angle = float(aspect_type.exact_angle)
            max_orb = self._calculate_allowed_orb(
                dir_obj['name'], natal_obj['name'], aspect_type.aspect_type
            )
            deviation = abs(diff - exact_angle)

            if deviation <= max_orb:
                return {
                    'directed_object': dir_obj['name'],
                    'directed_type': dir_obj['type'],
                    'natal_object': natal_obj['name'],
                    'natal_type': natal_obj['type'],
                    'aspect_type': aspect_type.aspect_type,
                    'orb': round(deviation, 4),
                    'is_major': aspect_type.class_ == 'major',
                    'harmonic_type': aspect_type.character,
                }

        return None

    def _save_direction(
        self,
        user_id: UUID,
        target_date: date,
        direction_type: str,
        arc_degrees: float,
        age_years: float,
        result: Dict
    ) -> None:
        """Сохранить дирекцию в БД"""
        # Проверяем, есть ли уже дирекция для этой даты и типа
        existing = self.db.query(Direction).filter(
            Direction.user_id == user_id,
            Direction.target_date == target_date,
            Direction.direction_type == direction_type
        ).first()

        if existing:
            existing.arc_degrees = Decimal(str(arc_degrees))
            existing.age_years = Decimal(str(age_years))
            existing.chart_data = json.dumps(result)
        else:
            direction = Direction(
                user_id=user_id,
                target_date=target_date,
                direction_type=direction_type,
                arc_degrees=Decimal(str(arc_degrees)),
                age_years=Decimal(str(age_years)),
                chart_data=json.dumps(result)
            )
            self.db.add(direction)

        self.db.commit()
        logger.info(f"Direction saved: user={user_id}, date={target_date}, type={direction_type}")

    def get_direction(
        self,
        user_id: UUID,
        target_date: date,
        direction_type: str
    ) -> Optional[Dict]:
        """Получить сохранённую дирекцию из БД"""
        direction = self.db.query(Direction).filter(
            Direction.user_id == user_id,
            Direction.target_date == target_date,
            Direction.direction_type == direction_type
        ).first()

        if direction and direction.chart_data:
            return json.loads(direction.chart_data)
        return None

    def list_directions(self, user_id: UUID) -> List[Dict]:
        """Получить список всех дирекций пользователя"""
        directions = self.db.query(Direction).filter(
            Direction.user_id == user_id
        ).order_by(Direction.target_date.desc()).all()

        return [
            {
                'target_date': d.target_date.isoformat(),
                'direction_type': d.direction_type,
                'arc_degrees': float(d.arc_degrees),
                'age_years': float(d.age_years) if d.age_years else None,
            }
            for d in directions
        ]

