"""
Progression Service - расчёт вторичных прогрессий (Secondary Progressions)

Реализация по образцу ZET:
- Формула: 1 день после рождения = 1 год жизни
- Прогрессивный JD = birth_JD + (target_date - birth_date).days / 365.25
"""
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from datetime import date, time, datetime
from decimal import Decimal
import pytz
import swisseph as swe
from sqlalchemy.orm import Session
from loguru import logger

from app.database.models import (
    User, NatalPlanet, NatalHouse, Angle, NatalSpecialPoint, RefAspectType, RefPlanetOrb
)
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.services.special_points_service import SpecialPointsService
from app.utils.constants import (
    get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds,
    PROGNOSTIC_EXCLUDED_NATAL_TARGETS, PROGNOSTIC_EXACT_ORB,
    PROGNOSTIC_DEFAULT_ORB, PROGNOSTIC_MOON_ORB,
    PLANETS,
)


# Коэффициент: 1 тропический год в днях
TROPICAL_YEAR_DAYS = 365.2421897


class ProgressionService:
    """Сервис для расчёта вторичных прогрессий"""

    def __init__(self, db_session: Session, ephe_path: str = None):
        self.db = db_session
        self.swisseph_engine = SwissEphemerisEngine(ephe_path)
        if ephe_path:
            swe.set_ephe_path(ephe_path)
        self._aspect_types_cache: Optional[List[RefAspectType]] = None
        self._planet_orbs_cache: Optional[Dict[Tuple[str, str], float]] = None

    def calculate_progressed_jd(self, birth_jd: float, birth_date: date, target_date: date) -> float:
        """
        Рассчитать прогрессивный Julian Day
        
        Формула (по ZET): 1 день = 1 год
        progressed_jd = birth_jd + (years_elapsed)
        где years_elapsed = (target_date - birth_date).days / 365.2421897
        
        Args:
            birth_jd: Julian Day рождения
            birth_date: Дата рождения
            target_date: Целевая дата прогрессии
            
        Returns:
            Julian Day для прогрессивной карты
        """
        days_elapsed = (target_date - birth_date).days
        years_elapsed = days_elapsed / TROPICAL_YEAR_DAYS
        
        # Прогрессивный JD = birth_jd + количество дней (= количество лет)
        progressed_jd = birth_jd + years_elapsed
        
        logger.debug(
            f"Progression: birth_jd={birth_jd:.6f}, days_elapsed={days_elapsed}, "
            f"years={years_elapsed:.4f}, progressed_jd={progressed_jd:.6f}"
        )
        
        return progressed_jd

    def calculate_progression(
        self,
        user_id: UUID,
        target_date: date,
        save_to_db: bool = False
    ) -> Dict:
        """
        Рассчитать прогрессивную карту для пользователя
        
        Args:
            user_id: UUID пользователя с натальной картой
            target_date: Дата, на которую рассчитывается прогрессия
            save_to_db: Сохранить результат в БД
            
        Returns:
            Dict с полными данными прогрессивной карты
        """
        # 1. Загрузить натальные данные пользователя
        user = self.db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        birth_jd = float(user.julian_day)
        birth_date_val = user.birth_date
        
        # 2. Рассчитать прогрессивный JD
        progressed_jd = self.calculate_progressed_jd(birth_jd, birth_date_val, target_date)
        
        # 3. Рассчитать прогрессивные планеты + узлы и Лилит
        progressed_planets = self.swisseph_engine.calculate_planets(progressed_jd)
        progressed_planets.extend(self._calculate_progressed_special_bodies(progressed_jd))

        # 3.1 Рассчитать прогрессивные куспиды домов
        progressed_houses, _ = self.swisseph_engine.calculate_houses(
            jd=progressed_jd,
            lat=float(user.lat),
            lon=float(user.lon),
            hsys='P',
        )
        
        # 4. Загрузить натальные данные для аспектов и домов
        natal_data = self._load_natal_data(user_id)
        
        # 5. Определить натальные и прогрессивные дома для прогрессивных планет
        for planet in progressed_planets:
            planet['natal_house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], natal_data['houses']
            )
            planet['progressed_house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], progressed_houses
            )
            # Поле house используется фронтендом в подсказке
            planet['house'] = planet['progressed_house']
        
        # 6. Рассчитать аспекты прогрессия→натал
        aspects = self._calculate_progression_aspects(progressed_planets, natal_data)
        
        # 7. Рассчитать ингрессии планет (знак/дом)
        planet_ingresses = self._calculate_planet_ingresses(
            progressed_planets=progressed_planets,
            natal_data=natal_data,
        )

        # 8. Рассчитать возраст
        age_years = (target_date - birth_date_val).days / TROPICAL_YEAR_DAYS
        
        # 9. Конвертировать прогрессивный JD в дату
        progressed_date = self._jd_to_date(progressed_jd)
        
        # 10. Формируем результат
        result = {
            'progression_info': {
                'target_date': target_date.isoformat(),
                'age_years': round(age_years, 2),
                'progressed_jd': progressed_jd,
                'progressed_date': progressed_date.isoformat(),
                'method': 'secondary',  # Вторичные прогрессии
                'rate': '1 day = 1 year',
            },
            'birth_data': {
                'user_id': str(user.user_id),
                'birth_date': user.birth_date.isoformat(),
                'birth_time': user.birth_time.isoformat() if user.birth_time else None,
                'birth_place': user.birth_place,
                'birth_jd': birth_jd,
            },
            'progressed_planets': progressed_planets,
            'natal_houses': natal_data['houses'],  # Дома остаются натальными
            'progressed_houses': progressed_houses,
            'aspects_to_natal': aspects,
            'planet_ingresses': planet_ingresses,
        }
        
        # 11. Сохранить в БД если нужно
        if save_to_db:
            self._save_progression(user_id, target_date, result)

        return result

    def _load_natal_data(self, user_id: UUID) -> Dict:
        """Загрузить натальные данные из БД"""
        # Планеты
        planets = self.db.query(NatalPlanet).filter(NatalPlanet.user_id == user_id).all()
        natal_planets = [
            {'name': p.planet, 'longitude': float(p.degree), 'type': 'planet'}
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

        # Фильтруем исключённые натальные цели для прогностики
        all_objects = natal_planets + natal_special_points + natal_angles
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
        """Получить base_orb для всех типов аспектов"""
        if not hasattr(self, '_base_orbs_cache'):
            aspects = self.db.query(RefAspectType).all()
            self._base_orbs_cache = {a.aspect_type: float(a.base_orb) for a in aspects}
        return self._base_orbs_cache

    def _calculate_allowed_orb(self, body_a: str, body_b: str, aspect_type: str) -> float:
        """
        Фиксированный орбис для прогрессий:
        - 3° если прогрессивная Луна (body_a = 'Moon')
        - 1° для всех остальных
        """
        if body_a == 'Moon':
            return PROGNOSTIC_MOON_ORB
        return PROGNOSTIC_DEFAULT_ORB

    def _calculate_progressed_special_bodies(self, jd: float) -> List[Dict]:
        """Рассчитать прогрессивные позиции узлов и Лилит."""
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
                'type': 'progressed_planet',
            })
        return bodies

    def _calculate_progression_aspects(
        self,
        progressed_planets: List[Dict],
        natal_data: Dict
    ) -> List[Dict]:
        """Расчёт аспектов между прогрессивными и натальными объектами"""
        aspects = []
        aspect_types = self._get_aspect_types()
        natal_objects = natal_data['all_objects']

        for prog_planet in progressed_planets:
            for natal_obj in natal_objects:
                aspect = self._check_aspect(prog_planet, natal_obj, aspect_types)
                if aspect:
                    aspects.append(aspect)

        return aspects

    def _calculate_planet_ingresses(
        self,
        progressed_planets: List[Dict],
        natal_data: Dict,
    ) -> List[Dict]:
        """Определить ингрессии планет в знак и дом (натал -> прогрессия)."""
        planet_names = set(PLANETS.values())
        natal_planets = [p for p in natal_data['planets'] if p['name'] in planet_names]
        natal_by_name = {p['name']: p for p in natal_planets}
        natal_houses = natal_data['houses']

        ingresses: List[Dict] = []
        for progressed in progressed_planets:
            name = progressed.get('name')
            if name not in planet_names:
                continue

            natal = natal_by_name.get(name)
            if not natal:
                continue

            natal_lon = float(natal['longitude'])
            natal_sign = get_zodiac_sign(natal_lon)
            natal_house = self.swisseph_engine.get_planet_house(natal_lon, natal_houses)
            progressed_sign = progressed.get('sign')
            progressed_house = progressed.get('progressed_house')

            if progressed_sign and progressed_sign != natal_sign:
                ingresses.append({
                    'body': name,
                    'ingress_type': 'sign',
                    'from_sign': natal_sign,
                    'to_sign': progressed_sign,
                    'from_house': natal_house,
                    'to_house': progressed_house,
                    'from_longitude': natal_lon,
                    'to_longitude': progressed.get('longitude'),
                    'from_degree_in_sign_formatted': format_degree_minutes_seconds(
                        get_degree_in_sign(natal_lon)
                    ),
                    'to_degree_in_sign_formatted': progressed.get('degree_in_sign_formatted'),
                })

            if (
                natal_house is not None
                and progressed_house is not None
                and progressed_house != natal_house
            ):
                ingresses.append({
                    'body': name,
                    'ingress_type': 'house',
                    'from_sign': natal_sign,
                    'to_sign': progressed_sign,
                    'from_house': natal_house,
                    'to_house': progressed_house,
                    'from_longitude': natal_lon,
                    'to_longitude': progressed.get('longitude'),
                    'from_degree_in_sign_formatted': format_degree_minutes_seconds(
                        get_degree_in_sign(natal_lon)
                    ),
                    'to_degree_in_sign_formatted': progressed.get('degree_in_sign_formatted'),
                })

        return ingresses

    def _check_aspect(
        self,
        prog_obj: Dict,
        natal_obj: Dict,
        aspect_types: List[RefAspectType]
    ) -> Optional[Dict]:
        """Проверить наличие аспекта между прогрессивным и натальным объектом"""
        diff = abs(prog_obj['longitude'] - natal_obj['longitude'])
        if diff > 180:
            diff = 360 - diff

        for aspect_type in aspect_types:
            exact_angle = float(aspect_type.exact_angle)
            max_orb = self._calculate_allowed_orb(
                prog_obj['name'], natal_obj['name'], aspect_type.aspect_type
            )
            deviation = abs(diff - exact_angle)

            if deviation <= max_orb:
                return {
                    'progressed_planet': prog_obj['name'],
                    'natal_object': natal_obj['name'],
                    'natal_object_type': natal_obj['type'],
                    'aspect_type': aspect_type.aspect_type,
                    'orb': round(deviation, 4),
                    'is_exact': deviation <= PROGNOSTIC_EXACT_ORB,
                    'is_major': aspect_type.class_ == 'major',
                    'harmonic_type': aspect_type.character,
                }

        return None

    def _jd_to_date(self, jd: float) -> date:
        """Конвертировать Julian Day в date"""
        year, month, day, _ = swe.revjul(jd)
        return date(year, month, day)

    def _save_progression(self, user_id: UUID, target_date: date, result: Dict) -> None:
        """Сохранить прогрессию в БД"""
        from app.database.models import Progression
        import json

        # Проверяем, есть ли уже прогрессия для этой даты
        existing = self.db.query(Progression).filter(
            Progression.user_id == user_id,
            Progression.target_date == target_date
        ).first()

        prog_info = result['progression_info']

        if existing:
            existing.progressed_jd = Decimal(str(prog_info['progressed_jd']))
            existing.chart_data = json.dumps(result)
        else:
            progression = Progression(
                user_id=user_id,
                target_date=target_date,
                progressed_jd=Decimal(str(prog_info['progressed_jd'])),
                chart_data=json.dumps(result)
            )
            self.db.add(progression)

        self.db.commit()
        logger.info(f"Progression saved: user={user_id}, target_date={target_date}")

    def get_progression(self, user_id: UUID, target_date: date) -> Optional[Dict]:
        """Получить сохранённую прогрессию из БД"""
        from app.database.models import Progression
        import json

        prog = self.db.query(Progression).filter(
            Progression.user_id == user_id,
            Progression.target_date == target_date
        ).first()

        if prog and prog.chart_data:
            return json.loads(prog.chart_data)
        return None

    def list_progressions(self, user_id: UUID) -> List[Dict]:
        """Получить список всех прогрессий пользователя"""
        from app.database.models import Progression

        progs = self.db.query(Progression).filter(
            Progression.user_id == user_id
        ).order_by(Progression.target_date.desc()).all()

        return [
            {
                'target_date': p.target_date.isoformat(),
                'progressed_jd': float(p.progressed_jd),
            }
            for p in progs
        ]
