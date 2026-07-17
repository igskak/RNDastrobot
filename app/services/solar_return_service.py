"""
Solar Return Service - расчёт соларной карты (годовой прогноз)

Соляр — карта на момент точного возвращения Солнца на натальную позицию.
Реализация по образцу ZET.
"""
from typing import Dict, List, Optional
from uuid import UUID
from datetime import date, time, datetime
from decimal import Decimal
import pytz
import swisseph as swe
from sqlalchemy.orm import Session
from loguru import logger

from app.database.models import User, NatalPlanet, NatalSpecialPoint, NatalHouse, Angle, SolarReturn, RefAspectType
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.services.aspect_service import AspectService
from app.services.chart_derivation_service import ChartDerivationService
from app.services.geocoding_service import GeocodingService
from app.services.planet_characteristics_service import PlanetCharacteristicsService
from app.services.preferences_runtime import (
    PreferencesRuntimeResolver, DEFAULT_STATIONARY_THRESHOLD_PERCENT,
)
from app.services.reference_data_cache import get_aspect_types
from app.services.natal_context import NatalContext
from app.services.natal_payload_cache import NatalPayloadCache
from app.services.special_points_service import SpecialPointsService
from app.utils.constants import (
    PROGNOSTIC_DEFAULT_ORB,
    PROGNOSTIC_EXACT_ORB,
    PROGNOSTIC_EXCLUDED_NATAL_TARGETS,
    get_zodiac_sign,
    get_degree_in_sign,
    format_degree_minutes_seconds,
    normalize_longitude,
)

# Поиск момента соляра стартует не с 1 января, а за несколько дней до дня
# рождения в целевом году. Иначе для рождённых в самом начале января
# `solcross_ut` (берёт ПЕРВОЕ пересечение после старта) проскакивает их
# январский возврат и цепляет декабрьский — соляр уезжает на год.
# Возврат отклоняется от григорианской даты рождения в пределах ≈[-1.5, +2.1]
# суток (скан 1900–2100), поэтому 3 дня — безопасный отступ: заведомо раньше
# истинного возврата и при этом много меньше ~365-дневного зазора до соседнего.
SOLAR_RETURN_SEARCH_MARGIN_DAYS = 3.0


class SolarReturnService:
    """Сервис для расчёта соларных карт"""

    def __init__(self, db_session: Session, ephe_path: str = None):
        self.db = db_session
        self.swisseph_engine = SwissEphemerisEngine(ephe_path)
        self.geocoding_service = GeocodingService()
        self.preferences_runtime = PreferencesRuntimeResolver(db_session)
        if ephe_path:
            swe.set_ephe_path(ephe_path)

    @staticmethod
    def _normalize_timezone_candidate(value: Optional[str]) -> Optional[str]:
        timezone = str(value or "").strip()
        if not timezone:
            return None
        try:
            pytz.timezone(timezone)
        except Exception:
            return None
        return timezone

    def find_solar_return_moment(
        self,
        natal_sun_lon: float,
        year: int,
        *,
        zodiac: str = 'tropical',
        ayanamsha: Optional[str] = None,
        birth_month: Optional[int] = None,
        birth_day: Optional[int] = None,
    ) -> float:
        """
        Найти точный момент соляра (возвращения Солнца на натальную позицию)

        Args:
            natal_sun_lon: Долгота натального Солнца (0-360°)
            year: Год для соляра
            birth_month/birth_day: дата рождения — поиск стартует за
                ``SOLAR_RETURN_SEARCH_MARGIN_DAYS`` дней до дня рождения в
                целевом году. Если не передана — fallback к 1 января (старое
                поведение; корректно для всех, кроме рождённых ~1–2 января).

        Returns:
            Julian Day момента соляра
        """
        if birth_month and birth_day:
            jd_start = swe.julday(year, birth_month, birth_day, 0.0) - SOLAR_RETURN_SEARCH_MARGIN_DAYS
        else:
            # Дата рождения неизвестна — стартуем с 1 января нужного года.
            jd_start = swe.julday(year, 1, 1, 0.0)

        if (zodiac or 'tropical').lower() == 'sidereal':
            return self._find_sidereal_solar_return_moment(
                natal_sun_lon,
                jd_start,
                ayanamsha=ayanamsha or 'lahiri',
            )

        # swe.solcross_ut находит момент когда Солнце пересекает заданную долготу
        # Возвращает Julian Day
        jd_solar = swe.solcross_ut(natal_sun_lon, jd_start, swe.FLG_SWIEPH)

        logger.debug(f"Solar return for Sun@{natal_sun_lon:.4f}° in {year}: JD={jd_solar}")

        return jd_solar

    def _find_sidereal_solar_return_moment(
        self,
        natal_sun_lon: float,
        jd_start: float,
        *,
        ayanamsha: str,
    ) -> float:
        def signed_delta(jd: float) -> float:
            lon = self.swisseph_engine.calculate_planet_longitude(
                jd,
                'Sun',
                zodiac='sidereal',
                ayanamsha=ayanamsha,
            )
            return ((normalize_longitude(lon - natal_sun_lon) + 180.0) % 360.0) - 180.0

        prev_jd = jd_start
        prev = signed_delta(prev_jd)
        step = 1.0
        for idx in range(1, 370):
            cur_jd = jd_start + idx * step
            cur = signed_delta(cur_jd)
            if prev == 0 or (prev < 0 <= cur) or (prev > 0 >= cur):
                lo, hi = prev_jd, cur_jd
                lo_val = prev
                for _ in range(48):
                    mid = (lo + hi) / 2.0
                    mid_val = signed_delta(mid)
                    if (lo_val < 0 <= mid_val) or (lo_val > 0 >= mid_val):
                        hi = mid
                    else:
                        lo = mid
                        lo_val = mid_val
                return (lo + hi) / 2.0
            prev_jd, prev = cur_jd, cur
        raise ValueError("Solar return crossing not found")

    def _calculate_solar_special_bodies(
        self,
        jd: float,
        *,
        solar_houses: List[Dict],
        solar_angles: Dict,
        solar_planets: List[Dict],
        latitude: float,
        longitude: float,
    ) -> List[Dict]:
        """Рассчитать солярные спецточки тем же набором, что и в остальных панелях."""
        north, south = SpecialPointsService.calculate_true_nodes(jd)
        lilith = SpecialPointsService.calculate_black_moon(jd)
        selena = SpecialPointsService.calculate_white_moon(jd)
        special_longs = [
            ('TrueNorthNode', north),
            ('TrueSouthNode', south),
            ('BlackMoon', lilith),
            ('WhiteMoon', selena),
        ]

        asc_lon = (solar_angles or {}).get('ASC', {}).get('longitude')
        sun = next((body for body in (solar_planets or []) if body.get('name') == 'Sun'), None)
        moon = next((body for body in (solar_planets or []) if body.get('name') == 'Moon'), None)
        if asc_lon is not None and sun and moon:
            sun_house = sun.get('house') or self.swisseph_engine.get_planet_house(
                sun['longitude'],
                solar_houses,
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
        for name, longitude_value in special_longs:
            degree_in_sign = get_degree_in_sign(longitude_value)
            bodies.append({
                'name': name,
                'longitude': longitude_value,
                'sign': get_zodiac_sign(longitude_value),
                'degree_in_sign': degree_in_sign,
                'degree_in_sign_formatted': format_degree_minutes_seconds(degree_in_sign),
                'house': self.swisseph_engine.get_planet_house(longitude_value, solar_houses),
                'retrograde': False,
                'speed': 0.0,
                'type': 'solar_point',
            })
        return bodies

    def jd_to_datetime(self, jd: float, timezone: str) -> datetime:
        """Конвертировать Julian Day в datetime с учётом timezone"""
        # Получаем компоненты даты/времени из JD
        year, month, day, hour_frac = swe.revjul(jd)
        
        hours = int(hour_frac)
        minutes = int((hour_frac - hours) * 60)
        seconds = int(((hour_frac - hours) * 60 - minutes) * 60)
        
        # Создаём UTC datetime
        utc_dt = datetime(year, month, day, hours, minutes, seconds, tzinfo=pytz.UTC)
        
        # Конвертируем в нужный timezone
        tz = pytz.timezone(timezone)
        local_dt = utc_dt.astimezone(tz)
        
        return local_dt

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

    def calculate_solar_return(
        self,
        user_id: UUID,
        year: int,
        location_lat: Optional[float] = None,
        location_lon: Optional[float] = None,
        location_name: Optional[str] = None,
        location_source_id: Optional[str] = None,
        location_timezone: Optional[str] = None,
        house_system: str = 'P',
        save_to_db: bool = True,
        name: Optional[str] = None,
    ) -> Dict:
        """
        Рассчитать соларную карту для пользователя
        
        Args:
            user_id: UUID пользователя с натальной картой
            year: Год соляра
            location_lat: Широта места соляра (по умолчанию = место рождения)
            location_lon: Долгота места соляра
            location_name: Название места соляра
            house_system: Система домов
            save_to_db: Сохранить результат в БД
            
        Returns:
            Dict с полными данными соларной карты
        """
        # 1. Построить контекст натала из сохранённого клиента (DB-путь)
        context = self._build_context_from_user_id(user_id)
        result = self.calculate_solar_return_from_context(
            context,
            year,
            location_lat=location_lat,
            location_lon=location_lon,
            location_name=location_name,
            location_source_id=location_source_id,
            location_timezone=location_timezone,
            house_system=house_system,
        )

        # 10. Сохранить в БД если нужно (только для сохранённого клиента)
        if save_to_db:
            result['solar_id'] = str(self._save_solar_return(user_id, year, result, name=name))
            result['name'] = self._normalize_solar_name(name)

        return result

    def calculate_solar_return_from_context(
        self,
        context: 'NatalContext',
        year: int,
        *,
        location_lat: Optional[float] = None,
        location_lon: Optional[float] = None,
        location_name: Optional[str] = None,
        location_source_id: Optional[str] = None,
        location_timezone: Optional[str] = None,
        house_system: str = 'P',
    ) -> Dict:
        """Соляр для произвольного источника натала (сохранённый или inline-ephemeral).

        Ядро метода. ``calculate_solar_return(user_id, ...)`` — обёртка, строящая контекст
        из БД и опционально сохраняющая результат. ``db`` используется только для ref-данных
        (типы аспектов, словари достоинств), натал берётся из контекста.
        """
        # 2. Долгота натального Солнца — из натала контекста
        natal_sun_lon = self._natal_sun_longitude(context)

        # 3. Определить место соляра (по умолчанию — место рождения из контекста)
        if location_lat is None or location_lon is None:
            location_lat = context.birth_lat
            location_lon = context.birth_lon
            location_name = location_name or (context.birth_data or {}).get('place')

        effective_timezone = self._normalize_timezone_candidate(location_timezone)
        if effective_timezone is None and location_source_id:
            effective_timezone = self._normalize_timezone_candidate(
                self.geocoding_service.resolve_timezone_by_source(location_source_id, self.db)
            )
        if effective_timezone is None:
            effective_timezone = self._normalize_timezone_candidate(context.birth_timezone) or "UTC"

        location_lat = float(location_lat)
        location_lon = float(location_lon)

        # 4. Найти момент соляра (поиск якорим на дне рождения, см. find_solar_return_moment)
        birth_month, birth_day = self._birth_month_day(context)
        jd_solar = self.find_solar_return_moment(
            natal_sun_lon,
            year,
            zodiac=context.zodiac or 'tropical',
            ayanamsha=context.ayanamsha or 'lahiri',
            birth_month=birth_month,
            birth_day=birth_day,
        )

        # 5. Конвертировать в datetime
        solar_datetime = self.jd_to_datetime(jd_solar, effective_timezone)

        # 6. Рассчитать планеты на момент соляра
        solar_planets = self.swisseph_engine.calculate_planets(
            jd_solar,
            zodiac=context.zodiac or 'tropical',
            ayanamsha=context.ayanamsha or 'lahiri',
        )

        # 7. Рассчитать дома на момент соляра для места соляра
        solar_houses, solar_angles = self.swisseph_engine.calculate_houses(
            jd_solar,
            location_lat,
            location_lon,
            house_system,
            zodiac=context.zodiac or 'tropical',
            ayanamsha=context.ayanamsha or 'lahiri',
        )

        # 8. Определить дома для планет
        for planet in solar_planets:
            planet['house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], solar_houses
            )
        solar_planets.extend(self._calculate_solar_special_bodies(
            jd_solar,
            solar_houses=solar_houses,
            solar_angles=solar_angles,
            solar_planets=solar_planets,
            latitude=location_lat,
            longitude=location_lon,
        ))

        # 8.1 Аспекты внутри соляра и соляр → натал
        solar_aspects = self._calculate_solar_aspects(solar_planets, astrologer_id=context.astrologer_id)
        natal_targets = context.natal_aspect_targets or []
        aspects_to_natal = self._calculate_solar_to_natal_aspects(
            context.astrologer_id, solar_planets, natal_targets,
        )
        solar_planets = self._enrich_motion_flags(solar_planets, astrologer_id=context.astrologer_id)

        # 9. Формируем результат
        result = self._build_solar_response(
            birth_data=context.birth_data or {},
            year=year,
            jd_solar=jd_solar,
            solar_datetime=solar_datetime,
            location_lat=location_lat,
            location_lon=location_lon,
            location_name=location_name,
            house_system=house_system,
            solar_planets=solar_planets,
            solar_houses=solar_houses,
            solar_angles=solar_angles,
            natal_sun_lon=natal_sun_lon,
            solar_aspects=solar_aspects,
            aspects_to_natal=aspects_to_natal,
            effective_timezone=effective_timezone,
        )
        result = ChartDerivationService(self.db).enrich_solar_payload(
            result,
            user_id=context.user_id,
            astrologer_id=context.astrologer_id,
        )
        return result

    def _build_context_from_user_id(self, user_id: UUID) -> 'NatalContext':
        """Построить NatalContext из сохранённого клиента (DB-путь). Соляру нужны
        натальное Солнце, координаты/таймзона рождения и натальные цели для аспектов."""
        user = self.db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise ValueError(f"User not found: {user_id}")
        natal_planets = self.db.query(NatalPlanet).filter(NatalPlanet.user_id == user_id).all()
        if not any(p.planet == 'Sun' for p in natal_planets):
            raise ValueError(f"Natal Sun not found for user: {user_id}")
        natal_data = {
            'planets': [
                {'name': p.planet, 'longitude': float(p.degree), 'type': 'planet'}
                for p in natal_planets
            ],
        }
        astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)
        birth_data = {
            'user_id': str(user.user_id),
            'date': user.birth_date.isoformat() if user.birth_date else None,
            'time': user.birth_time.isoformat() if user.birth_time else None,
            'place': user.birth_place,
            'timezone': user.timezone,
            'zodiac': getattr(user, 'zodiac', None) or 'tropical',
            'ayanamsha': getattr(user, 'ayanamsha', None),
        }
        return NatalContext(
            natal_data=natal_data,
            astrologer_id=astrologer_id,
            user_id=user_id,
            birth_data=birth_data,
            zodiac=birth_data['zodiac'],
            ayanamsha=birth_data['ayanamsha'],
            birth_date=user.birth_date,
            birth_lat=float(user.lat),
            birth_lon=float(user.lon),
            birth_timezone=user.timezone,
            natal_aspect_targets=self._load_natal_aspect_targets(user_id, user=user),
        )

    @staticmethod
    def _birth_month_day(context: 'NatalContext') -> tuple:
        """Месяц/день рождения для якоря поиска соляра.

        Предпочитаем типизированное ``context.birth_date``; иначе парсим
        ISO-строку из ``birth_data['date']``. Возвращаем (None, None), если
        дата недоступна — find_solar_return_moment откатится к 1 января.
        """
        bd = getattr(context, 'birth_date', None)
        if bd is not None:
            return bd.month, bd.day
        raw = str((context.birth_data or {}).get('date') or '').strip()
        if not raw:
            return None, None
        try:
            parsed = date.fromisoformat(raw[:10])
        except ValueError:
            return None, None
        return parsed.month, parsed.day

    @staticmethod
    def _natal_sun_longitude(context: 'NatalContext') -> float:
        for p in (context.natal_data or {}).get('planets', []):
            if p.get('name') == 'Sun':
                return float(p['longitude'])
        raise ValueError("Natal Sun not found in natal context")

    def _build_solar_response(
        self,
        birth_data: Dict,
        year: int,
        jd_solar: float,
        solar_datetime: datetime,
        location_lat: float,
        location_lon: float,
        location_name: Optional[str],
        house_system: str,
        solar_planets: List[Dict],
        solar_houses: List[Dict],
        solar_angles: Dict,
        natal_sun_lon: float,
        solar_aspects: List[Dict],
        aspects_to_natal: List[Dict],
        effective_timezone: str,
    ) -> Dict:
        """Сформировать ответ с данными соляра"""
        return {
            'solar_info': {
                'year': year,
                'solar_datetime_utc': solar_datetime.astimezone(pytz.UTC).isoformat(),
                'solar_datetime_local': solar_datetime.isoformat(),
                'julian_day': jd_solar,
                'natal_sun_longitude': natal_sun_lon,
                'location': {
                    'latitude': location_lat,
                    'longitude': location_lon,
                    'name': location_name,
                },
                'house_system': house_system,
                'timezone': effective_timezone,
            },
            'birth_data': {
                'user_id': birth_data.get('user_id'),
                'birth_date': birth_data.get('date'),
                'birth_time': birth_data.get('time'),
                'birth_place': birth_data.get('place'),
            },
            'planets': solar_planets,
            'houses': solar_houses,
            'angles': solar_angles,
            'aspects': solar_aspects,
            'aspects_to_natal': aspects_to_natal,
        }

    def _load_natal_aspect_targets(self, user_id: UUID, user=None) -> List[Dict]:
        # D2 (Фаза 4): 4 запроса на натальные цели кэшируются по версии карты;
        # ключ есть только когда передан user (горячий путь _build_context).
        cache_key = NatalPayloadCache.make_key(user, "aspect_targets") if user is not None else None
        if cache_key is not None:
            cached = NatalPayloadCache.get(cache_key)
            if cached is not None:
                return cached

        planets = self.db.query(NatalPlanet).filter(NatalPlanet.user_id == user_id).all()
        targets: List[Dict] = [
            {
                'name': p.planet,
                'longitude': float(p.degree),
                'type': 'planet',
                'speed': float(p.speed) if p.speed is not None else 0.0,
            }
            for p in planets
        ]

        special_points = self.db.query(NatalSpecialPoint).filter(
            NatalSpecialPoint.user_id == user_id
        ).all()
        targets.extend(
            {
                'name': sp.point,
                'longitude': float(sp.degree),
                'type': 'special_point',
                'speed': 0.0,
            }
            for sp in special_points
        )

        angles = self.db.query(Angle).filter(Angle.user_id == user_id).first()
        if angles:
            targets.extend([
                {'name': 'ASC', 'longitude': float(angles.asc_degree), 'type': 'angle', 'speed': 0.0},
                {'name': 'MC', 'longitude': float(angles.mc_degree), 'type': 'angle', 'speed': 0.0},
                {'name': 'IC', 'longitude': float(angles.ic_degree), 'type': 'angle', 'speed': 0.0},
                {'name': 'DSC', 'longitude': float(angles.dsc_degree), 'type': 'angle', 'speed': 0.0},
            ])
            if angles.vertex_degree:
                targets.append({'name': 'Vertex', 'longitude': float(angles.vertex_degree), 'type': 'angle', 'speed': 0.0})

        houses = self.db.query(NatalHouse).filter(
            NatalHouse.user_id == user_id
        ).order_by(NatalHouse.house_number).all()
        from app.services.natal_context import house_cusp_targets
        targets.extend(house_cusp_targets([
            {'number': house.house_number, 'longitude': float(house.cusp_degree)}
            for house in houses
        ]))

        result = [
            target for target in targets
            if target['name'] not in PROGNOSTIC_EXCLUDED_NATAL_TARGETS
        ]
        if cache_key is not None:
            NatalPayloadCache.set(cache_key, result)
        return result

    def _get_aspect_types(self) -> List[RefAspectType]:
        return get_aspect_types(self.db)

    def _calculate_prognostic_allowed_orb(self, astrologer_id: Optional[UUID], body_a: str, body_b: str, aspect_type: str) -> float:
        if astrologer_id:
            return self.preferences_runtime.resolve_orb_for_astrologer(
                astrologer_id,
                body_a,
                body_b,
                aspect_type,
                orb_profile='prognostic',
            )
        return PROGNOSTIC_DEFAULT_ORB

    @staticmethod
    def _angular_distance(longitude_a: float, longitude_b: float) -> float:
        diff = abs((float(longitude_a) % 360.0) - (float(longitude_b) % 360.0))
        return 360.0 - diff if diff > 180.0 else diff

    def _calculate_solar_to_natal_aspects(
        self, astrologer_id: Optional[UUID], solar_planets: List[Dict], natal_targets: List[Dict],
    ) -> List[Dict]:
        """Рассчитать аспекты солярных объектов к натальным объектам."""
        if not solar_planets or not natal_targets:
            return []

        aspect_types = self._get_aspect_types()
        phase_objects = [
            {
                'name': planet.get('name'),
                'longitude': planet.get('longitude'),
                'speed': planet.get('speed') or 0.0,
                'type': 'solar_planet',
            }
            for planet in solar_planets
            if planet.get('name') and planet.get('longitude') is not None
        ] + natal_targets

        aspect_service = AspectService(self.db)
        aspects: List[Dict] = []
        for solar_obj in phase_objects:
            if solar_obj.get('type') != 'solar_planet':
                continue
            for natal_obj in natal_targets:
                distance = self._angular_distance(solar_obj['longitude'], natal_obj['longitude'])
                for aspect_type in aspect_types:
                    max_orb = self._calculate_prognostic_allowed_orb(
                        astrologer_id,
                        solar_obj['name'],
                        natal_obj['name'],
                        aspect_type.aspect_type,
                    )
                    deviation = abs(distance - float(aspect_type.exact_angle))
                    if deviation > max_orb:
                        continue

                    aspect = {
                        'planet_1': solar_obj['name'],
                        'planet_2': natal_obj['name'],
                        'left_planet': solar_obj['name'],
                        'right_planet': natal_obj['name'],
                        'solar_planet': solar_obj['name'],
                        'natal_object': natal_obj['name'],
                        'natal_object_type': natal_obj['type'],
                        'aspect_type': aspect_type.aspect_type,
                        'orb': round(deviation, 4),
                        'max_allowed_orb': max_orb,
                        'is_exact': deviation <= PROGNOSTIC_EXACT_ORB,
                        'is_major': aspect_type.class_ == 'major',
                        'harmonic_type': aspect_type.character,
                    }
                    applying = aspect_service.infer_aspect_phase(aspect, aspect_service._build_phase_objects_lookup(phase_objects))
                    if applying is not None:
                        aspect['applying'] = applying
                    aspects.append(aspect)
                    break

        return aspects

    def _calculate_solar_aspects(self, solar_planets: List[Dict], *, astrologer_id: Optional[UUID]) -> List[Dict]:
        """
        Рассчитать аспекты между объектами солярной карты (планеты/точки).

        Используется та же логика орбисов и классификации, что и для натала.
        """
        objects = []
        for planet in solar_planets:
            name = planet.get('name')
            longitude = planet.get('longitude')
            if not name or longitude is None:
                continue
            objects.append({
                'name': name,
                'longitude': float(longitude),
                'type': 'planet',
            })

        if len(objects) < 2:
            return []

        aspect_service = AspectService(self.db)
        return aspect_service.calculate_aspects_for_objects(objects, astrologer_id=astrologer_id)

    def _annotate_payload_aspects_with_phase(self, payload: Dict) -> Dict:
        """Дообогатить сохранённый payload соляра фазой аспектов, если её ещё нет."""
        if not payload or not payload.get('aspects'):
            return payload

        objects = [
            {
                'name': planet.get('name'),
                'longitude': planet.get('longitude'),
                'speed': planet.get('speed') or 0.0,
                'type': 'planet',
            }
            for planet in payload.get('planets', [])
            if planet.get('name') and planet.get('longitude') is not None
        ]
        objects.extend(
            {
                'name': angle.get('name') or angle_name,
                'longitude': angle.get('longitude'),
                'speed': 0.0,
                'type': 'angle',
            }
            for angle_name, angle in (payload.get('angles') or {}).items()
            if angle.get('longitude') is not None
        )

        payload['aspects'] = AspectService(self.db).annotate_aspects_with_phase(payload['aspects'], objects)
        return payload

    @staticmethod
    def _normalize_solar_name(name: Optional[str]) -> Optional[str]:
        normalized = str(name or '').strip()
        return normalized[:160] or None

    def _save_solar_return(self, user_id: UUID, year: int, result: Dict, *, name: Optional[str] = None) -> UUID:
        """Сохранить соляр в БД"""
        import json

        # Проверяем, есть ли уже соляр для этого года
        existing = self.db.query(SolarReturn).filter(
            SolarReturn.user_id == user_id,
            SolarReturn.year == year
        ).first()

        solar_info = result['solar_info']
        solar_name = self._normalize_solar_name(name)

        if existing:
            # Обновляем существующий
            existing.solar_datetime = datetime.fromisoformat(
                solar_info['solar_datetime_utc'].replace('Z', '+00:00')
            )
            existing.julian_day = Decimal(str(solar_info['julian_day']))
            existing.location_lat = Decimal(str(solar_info['location']['latitude']))
            existing.location_lon = Decimal(str(solar_info['location']['longitude']))
            existing.location_name = solar_info['location']['name']
            existing.house_system = solar_info['house_system']
            if solar_name is not None:
                existing.name = solar_name
            existing.chart_data = json.dumps(result)
            solar_id = existing.solar_id
        else:
            # Создаём новый
            solar_return = SolarReturn(
                user_id=user_id,
                year=year,
                solar_datetime=datetime.fromisoformat(
                    solar_info['solar_datetime_utc'].replace('Z', '+00:00')
                ),
                julian_day=Decimal(str(solar_info['julian_day'])),
                location_lat=Decimal(str(solar_info['location']['latitude'])),
                location_lon=Decimal(str(solar_info['location']['longitude'])),
                location_name=solar_info['location']['name'],
                house_system=solar_info['house_system'],
                name=solar_name,
                chart_data=json.dumps(result)
            )
            self.db.add(solar_return)
            self.db.flush()
            solar_id = solar_return.solar_id

        self.db.commit()
        logger.info(f"Solar return saved: user={user_id}, year={year}")
        return solar_id

    def get_solar_return(self, user_id: UUID, year: int) -> Optional[Dict]:
        """Получить сохранённый соляр из БД"""
        import json

        solar = self.db.query(SolarReturn).filter(
            SolarReturn.user_id == user_id,
            SolarReturn.year == year
        ).first()

        if solar and solar.chart_data:
            payload = json.loads(solar.chart_data) if isinstance(solar.chart_data, str) else dict(solar.chart_data)
            payload['solar_id'] = str(solar.solar_id)
            payload['name'] = solar.name
            astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(user_id)
            payload['planets'] = self._enrich_motion_flags(payload.get('planets', []), astrologer_id=astrologer_id)
            changed = False
            has_cusp_targets = any(
                str(aspect.get('natal_object') or aspect.get('planet_2') or '').startswith('Cusp')
                for aspect in (payload.get('aspects_to_natal') or [])
            )
            if 'aspects_to_natal' not in payload or not has_cusp_targets:
                payload['aspects_to_natal'] = self._calculate_solar_to_natal_aspects(
                    astrologer_id, payload.get('planets', []), self._load_natal_aspect_targets(user_id),
                )
                changed = True
            payload = self._annotate_payload_aspects_with_phase(payload)
            derivation_service = ChartDerivationService(self.db)
            if not derivation_service.has_extended_blocks(payload):
                user = self.db.query(User).filter(User.user_id == user_id).first()
                payload = derivation_service.enrich_solar_payload(
                    payload,
                    user_id=user_id,
                    astrologer_id=user.astrologer_id if user else None,
                )
                payload['solar_id'] = str(solar.solar_id)
                payload['name'] = solar.name
                changed = True
            if changed:
                solar.chart_data = json.dumps(payload)
                self.db.commit()
            return payload
        return None

    def get_solar_return_by_id(self, solar_id: UUID) -> Optional[SolarReturn]:
        """Получить запись соляра по ID."""
        return self.db.query(SolarReturn).filter(SolarReturn.solar_id == solar_id).first()

    def rename_solar_return(self, solar_id: UUID, name: Optional[str]) -> Optional[Dict]:
        """Переименовать сохранённый соляр и вернуть обновлённый элемент списка."""
        solar = self.get_solar_return_by_id(solar_id)
        if not solar:
            return None

        solar.name = self._normalize_solar_name(name)
        self.db.commit()
        self.db.refresh(solar)
        return {
            'solar_id': str(solar.solar_id),
            'name': solar.name,
            'year': solar.year,
            'solar_datetime': solar.solar_datetime.isoformat() if solar.solar_datetime else None,
            'location_name': solar.location_name,
        }

    def list_solar_returns(self, user_id: UUID) -> List[Dict]:
        """Получить список всех соляров пользователя"""
        solars = self.db.query(SolarReturn).filter(
            SolarReturn.user_id == user_id
        ).order_by(SolarReturn.year.desc()).all()

        return [
            {
                'solar_id': str(s.solar_id),
                'name': s.name,
                'year': s.year,
                'solar_datetime': s.solar_datetime.isoformat() if s.solar_datetime else None,
                'location_name': s.location_name,
            }
            for s in solars
        ]
