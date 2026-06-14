"""
Progression Service - расчёт вторичных прогрессий (Secondary Progressions)

Реализация по образцу ZET:
- Формула: 1 день после рождения = 1 год жизни
- Прогрессивный JD = birth_JD + elapsed_days / 365.2421897
"""
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from datetime import date, time, datetime, timedelta
from decimal import Decimal
import swisseph as swe
from sqlalchemy.orm import Session
from loguru import logger

from app.database.models import (
    User, NatalPlanet, NatalHouse, Angle, NatalSpecialPoint, RefAspectType, RefPlanetOrb
)
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.services.special_points_service import SpecialPointsService
from app.services.planet_characteristics_service import PlanetCharacteristicsService
from app.services.preferences_runtime import (
    PreferencesRuntimeResolver, DEFAULT_STATIONARY_THRESHOLD_PERCENT,
)
from app.services.natal_context import NatalContext
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
        self.preferences_runtime = PreferencesRuntimeResolver(db_session)
        self._aspect_types_cache: Optional[List[RefAspectType]] = None
        self._planet_orbs_cache: Optional[Dict[Tuple[str, str], float]] = None

    def calculate_progressed_jd(
        self,
        birth_jd: float,
        birth_date: date,
        target_date: date,
        target_time: Optional[time] = None,
        timezone: Optional[str] = None,
    ) -> float:
        """
        Рассчитать прогрессивный Julian Day

        Формула (по ZET): 1 день = 1 год
        progressed_jd = birth_jd + (years_elapsed)
        где years_elapsed = elapsed_days / 365.2421897
        
        Args:
            birth_jd: Julian Day рождения
            birth_date: Дата рождения
            target_date: Целевая дата прогрессии
            target_time: Локальное время прогностического момента
            timezone: IANA timezone для прогностического момента
            
        Returns:
            Julian Day для прогрессивной карты
        """
        timing = self._calculate_progression_timing(
            birth_jd=birth_jd,
            birth_date=birth_date,
            target_date=target_date,
            target_time=target_time,
            timezone=timezone,
        )
        return timing['progressed_jd']

    def calculate_progression(
        self,
        user_id: UUID,
        target_date: date,
        target_time: Optional[time] = None,
        timezone: Optional[str] = None,
        save_to_db: bool = False,
        name: Optional[str] = None,
    ) -> Dict:
        """
        Рассчитать прогрессивную карту для пользователя
        
        Args:
            user_id: UUID пользователя с натальной картой
            target_date: Дата, на которую рассчитывается прогрессия
            target_time: Локальное время прогностического момента
            timezone: IANA timezone для прогностического момента
            save_to_db: Сохранить результат в БД
            
        Returns:
            Dict с полными данными прогрессивной карты
        """
        # 1. Построить контекст натала из сохранённого клиента (DB-путь)
        context = self._build_context_from_user_id(user_id)
        result = self.calculate_progression_from_context(
            context, target_date, target_time=target_time, timezone=timezone,
        )

        # Сохранить в БД если нужно (только для сохранённого клиента)
        if save_to_db:
            progression_id = self._save_progression(user_id, target_date, result, name=name)
            result['progression_id'] = str(progression_id)
            result['name'] = self._normalize_saved_chart_name(name)

        return result

    def calculate_progression_from_context(
        self,
        context: NatalContext,
        target_date: date,
        target_time: Optional[time] = None,
        timezone: Optional[str] = None,
    ) -> Dict:
        """Прогрессия для произвольного источника натала (сохранённый или inline-ephemeral).

        Ядро метода. ``calculate_progression(user_id, ...)`` — тонкая обёртка, строящая
        контекст из БД и опционально сохраняющая результат.
        """
        birth_jd = context.birth_jd
        birth_date_val = context.birth_date
        lat = context.birth_lat
        lon = context.birth_lon

        # 2. Рассчитать прогрессивный JD
        timing = self._calculate_progression_timing(
            birth_jd=birth_jd,
            birth_date=birth_date_val,
            target_date=target_date,
            target_time=target_time,
            timezone=timezone,
        )
        progressed_jd = timing['progressed_jd']

        # 3. Рассчитать прогрессивные планеты
        progressed_planets = self.swisseph_engine.calculate_planets(progressed_jd)

        # 3.1 Рассчитать прогрессивные куспиды домов
        progressed_houses, progressed_angles = self.swisseph_engine.calculate_houses(
            jd=progressed_jd,
            lat=float(lat),
            lon=float(lon),
            hsys='P',
        )
        progressed_planets.extend(self._calculate_progressed_special_bodies(
            progressed_jd,
            progressed_houses=progressed_houses,
            progressed_angles=progressed_angles,
            progressed_planets=progressed_planets,
            latitude=float(lat),
            longitude=float(lon),
        ))
        progressed_planets = self._enrich_motion_flags(progressed_planets, astrologer_id=context.astrologer_id)

        # 4. Натальные данные для аспектов и домов
        natal_data = context.natal_data

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
        aspects = self._calculate_progression_aspects(context.astrologer_id, progressed_planets, natal_data)
        
        # 7. Рассчитать ингрессии планет (знак/дом)
        planet_ingresses = self._calculate_planet_ingresses(
            progressed_planets=progressed_planets,
            natal_data=natal_data,
        )

        # 8. Рассчитать возраст
        age_years = timing['age_years']

        # 9. Конвертировать прогрессивный JD в дату
        progressed_date = self._jd_to_date(progressed_jd)
        progressed_datetime = self._jd_to_datetime_iso(progressed_jd)
        
        # 10. Формируем результат
        target_datetime = None
        if target_time is not None:
            target_datetime = f"{target_date.isoformat()}T{target_time.isoformat()}"

        result = {
            'progression_info': {
                'target_date': target_date.isoformat(),
                'target_time': target_time.isoformat() if target_time is not None else None,
                'target_datetime': target_datetime,
                'timezone': timezone if target_time is not None else None,
                'target_utc': timing['target_utc'].isoformat() if timing.get('target_utc') else None,
                'age_years': round(age_years, 6),
                'progressed_jd': progressed_jd,
                'progressed_date': progressed_date.isoformat(),
                'progressed_datetime': progressed_datetime,
                'method': 'secondary',  # Вторичные прогрессии
                'rate': '1 day = 1 year',
            },
            'birth_data': {
                'user_id': (context.birth_data or {}).get('user_id'),
                'birth_date': birth_date_val.isoformat() if birth_date_val else None,
                'birth_time': (context.birth_data or {}).get('time'),
                'birth_place': (context.birth_data or {}).get('place'),
                'birth_jd': birth_jd,
            },
            'progressed_planets': progressed_planets,
            'natal_houses': natal_data['houses'],  # Дома остаются натальными
            'progressed_houses': progressed_houses,
            'aspects_to_natal': aspects,
            'planet_ingresses': planet_ingresses,
        }

        return result

    def _build_context_from_user_id(self, user_id: UUID) -> NatalContext:
        """Построить NatalContext из сохранённого клиента (DB-путь).

        Несёт натал, astrologer_id (орбисы/стационарность) и поля рождения (JD/координаты),
        которые прогрессии нужны для расчёта прогрессивных позиций. Inline-путь строит
        контекст через ``NatalContext.from_inline`` и зовёт ``calculate_progression_from_context``.
        """
        user = self.db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise ValueError(f"User not found: {user_id}")
        natal_data = self._load_natal_data(user_id)
        astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)
        birth_data = {
            'user_id': str(user.user_id),
            'date': user.birth_date.isoformat() if user.birth_date else None,
            'time': user.birth_time.isoformat() if user.birth_time else None,
            'place': user.birth_place,
            'julian_day': float(user.julian_day),
            'latitude': float(user.lat),
            'longitude': float(user.lon),
        }
        return NatalContext(
            natal_data=natal_data,
            astrologer_id=astrologer_id,
            user_id=user_id,
            birth_data=birth_data,
            birth_jd=float(user.julian_day),
            birth_date=user.birth_date,
            birth_lat=float(user.lat),
            birth_lon=float(user.lon),
        )

    def _calculate_progression_timing(
        self,
        *,
        birth_jd: float,
        birth_date: date,
        target_date: date,
        target_time: Optional[time] = None,
        timezone: Optional[str] = None,
    ) -> Dict:
        """Calculate elapsed/progressed timing, preserving legacy date-only behavior."""
        target_utc = None
        if target_time is None:
            days_elapsed = (target_date - birth_date).days
        else:
            if not timezone:
                raise ValueError("timezone is required when target_time is provided")
            target_utc, target_jd = TimeService.process_birth_time(target_date, target_time, timezone)
            days_elapsed = target_jd - birth_jd

        age_years = days_elapsed / TROPICAL_YEAR_DAYS
        progressed_jd = birth_jd + age_years

        logger.debug(
            f"Progression: birth_jd={birth_jd:.6f}, days_elapsed={days_elapsed:.6f}, "
            f"years={age_years:.6f}, progressed_jd={progressed_jd:.6f}"
        )

        return {
            'days_elapsed': days_elapsed,
            'age_years': age_years,
            'progressed_jd': progressed_jd,
            'target_utc': target_utc,
        }

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

    def _calculate_allowed_orb(self, astrologer_id: Optional[UUID], body_a: str, body_b: str, aspect_type: str) -> float:
        if astrologer_id:
            return self.preferences_runtime.resolve_orb_for_astrologer(
                astrologer_id,
                body_a,
                body_b,
                aspect_type,
                orb_profile='prognostic',
            )
        if body_a == 'Moon':
            return PROGNOSTIC_MOON_ORB
        return PROGNOSTIC_DEFAULT_ORB

    def _calculate_progressed_special_bodies(
        self,
        jd: float,
        *,
        progressed_houses: Optional[List[Dict]] = None,
        progressed_angles: Optional[Dict] = None,
        progressed_planets: Optional[List[Dict]] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> List[Dict]:
        """Рассчитать прогрессивные позиции спецточек единым набором для панелей."""
        north, south = SpecialPointsService.calculate_true_nodes(jd)
        lilith = SpecialPointsService.calculate_black_moon(jd)
        selena = SpecialPointsService.calculate_white_moon(jd)
        special_longs = [
            ('TrueNorthNode', north),
            ('TrueSouthNode', south),
            ('BlackMoon', lilith),
            ('WhiteMoon', selena),
        ]
        asc_lon = (progressed_angles or {}).get('ASC', {}).get('longitude')
        sun = next((body for body in (progressed_planets or []) if body.get('name') == 'Sun'), None)
        moon = next((body for body in (progressed_planets or []) if body.get('name') == 'Moon'), None)
        if asc_lon is not None and sun and moon:
            sun_house = (
                self.swisseph_engine.get_planet_house(sun['longitude'], progressed_houses or [])
                if progressed_houses else 1
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
                'type': 'progressed_planet',
            }
            if progressed_houses:
                body['house'] = self.swisseph_engine.get_planet_house(longitude, progressed_houses)
            bodies.append(body)
        return bodies

    def _calculate_progression_aspects(
        self,
        astrologer_id: Optional[UUID],
        progressed_planets: List[Dict],
        natal_data: Dict
    ) -> List[Dict]:
        """Расчёт аспектов между прогрессивными и натальными объектами"""
        aspects = []
        aspect_types = self._get_aspect_types()
        natal_objects = natal_data['all_objects']

        for prog_planet in progressed_planets:
            for natal_obj in natal_objects:
                aspect = self._check_aspect(astrologer_id, prog_planet, natal_obj, aspect_types)
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
        astrologer_id: Optional[UUID],
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
                astrologer_id,
                prog_obj['name'],
                natal_obj['name'],
                aspect_type.aspect_type,
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

    def _jd_to_datetime_iso(self, jd: float) -> str:
        """Конвертировать Julian Day в UTC datetime ISO без timezone suffix."""
        year, month, day, hour_decimal = swe.revjul(jd)
        hours = int(hour_decimal)
        minute_decimal = (hour_decimal - hours) * 60
        minutes = int(minute_decimal)
        second_decimal = (minute_decimal - minutes) * 60
        seconds = int(second_decimal)
        microseconds = int(round((second_decimal - seconds) * 1_000_000))
        if microseconds >= 1_000_000:
            seconds += 1
            microseconds -= 1_000_000
        dt = datetime(year, month, day) + timedelta(
            hours=hours,
            minutes=minutes,
            seconds=seconds,
            microseconds=microseconds,
        )
        return dt.isoformat(timespec='seconds')

    @staticmethod
    def _normalize_saved_chart_name(name: Optional[str]) -> Optional[str]:
        normalized = str(name or '').strip()
        return normalized[:160] or None

    def _save_progression(self, user_id: UUID, target_date: date, result: Dict, *, name: Optional[str] = None) -> UUID:
        """Сохранить прогрессию в БД"""
        from app.database.models import Progression
        import json

        prog_info = result['progression_info']
        target_time_value = time.fromisoformat(prog_info['target_time']) if prog_info.get('target_time') else None
        target_moment_key = self._build_target_moment_key(target_time_value, prog_info.get('timezone'))
        chart_name = self._normalize_saved_chart_name(name)

        # Проверяем, есть ли уже прогрессия для этого прогностического момента
        existing = self.db.query(Progression).filter(
            Progression.user_id == user_id,
            Progression.target_date == target_date,
            Progression.target_moment_key == target_moment_key,
        ).first()

        if existing:
            existing.progressed_jd = Decimal(str(prog_info['progressed_jd']))
            existing.target_time = target_time_value
            existing.timezone = prog_info.get('timezone')
            existing.target_utc = (
                datetime.fromisoformat(prog_info['target_utc'])
                if prog_info.get('target_utc') else None
            )
            existing.target_moment_key = target_moment_key
            if chart_name is not None:
                existing.name = chart_name
            existing.chart_data = json.dumps(result)
            progression_id = existing.progression_id
        else:
            progression = Progression(
                user_id=user_id,
                name=chart_name,
                target_date=target_date,
                target_time=target_time_value,
                timezone=prog_info.get('timezone'),
                target_utc=(
                    datetime.fromisoformat(prog_info['target_utc'])
                    if prog_info.get('target_utc') else None
                ),
                target_moment_key=target_moment_key,
                progressed_jd=Decimal(str(prog_info['progressed_jd'])),
                chart_data=json.dumps(result)
            )
            self.db.add(progression)
            self.db.flush()
            progression_id = progression.progression_id

        self.db.commit()
        logger.info(
            f"Progression saved: user={user_id}, target_date={target_date}, "
            f"target_moment_key={target_moment_key}"
        )
        return progression_id

    @staticmethod
    def _build_target_moment_key(target_time: Optional[time], timezone: Optional[str]) -> str:
        if target_time is None:
            return 'date-only'
        return f"{target_time.isoformat()}|{timezone or ''}"

    def get_progression(
        self,
        user_id: UUID,
        target_date: date,
        target_time: Optional[time] = None,
        timezone: Optional[str] = None,
    ) -> Optional[Dict]:
        """Получить сохранённую прогрессию из БД"""
        from app.database.models import Progression
        import json

        target_moment_key = self._build_target_moment_key(target_time, timezone)
        prog = self.db.query(Progression).filter(
            Progression.user_id == user_id,
            Progression.target_date == target_date,
            Progression.target_moment_key == target_moment_key,
        ).first()

        if prog and prog.chart_data:
            payload = json.loads(prog.chart_data)
            payload['progression_id'] = str(prog.progression_id)
            payload['name'] = prog.name
            return payload
        return None

    def get_progression_by_id(self, progression_id: UUID):
        """Получить запись прогрессии по ID."""
        from app.database.models import Progression
        return self.db.query(Progression).filter(Progression.progression_id == progression_id).first()

    def rename_progression(self, progression_id: UUID, name: Optional[str]) -> Optional[Dict]:
        """Переименовать сохранённую прогрессию и вернуть элемент списка."""
        prog = self.get_progression_by_id(progression_id)
        if not prog:
            return None

        prog.name = self._normalize_saved_chart_name(name)
        self.db.commit()
        self.db.refresh(prog)
        return {
            'progression_id': str(prog.progression_id),
            'name': prog.name,
            'target_date': prog.target_date.isoformat(),
            'target_time': prog.target_time.isoformat() if prog.target_time else None,
            'timezone': prog.timezone,
            'target_utc': prog.target_utc.isoformat() if prog.target_utc else None,
            'progressed_jd': float(prog.progressed_jd),
        }

    def list_progressions(self, user_id: UUID) -> List[Dict]:
        """Получить список всех прогрессий пользователя"""
        from app.database.models import Progression

        progs = self.db.query(Progression).filter(
            Progression.user_id == user_id
        ).order_by(
            Progression.target_date.desc(),
            Progression.target_time.desc().nullslast(),
        ).all()

        return [
            {
                'progression_id': str(p.progression_id),
                'name': p.name,
                'target_date': p.target_date.isoformat(),
                'target_time': p.target_time.isoformat() if p.target_time else None,
                'timezone': p.timezone,
                'target_utc': p.target_utc.isoformat() if p.target_utc else None,
                'progressed_jd': float(p.progressed_jd),
            }
            for p in progs
        ]
