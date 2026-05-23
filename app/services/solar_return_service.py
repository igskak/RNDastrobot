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

from app.database.models import User, NatalPlanet, NatalSpecialPoint, Angle, SolarReturn, RefAspectType
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.services.aspect_service import AspectService
from app.services.chart_derivation_service import ChartDerivationService
from app.services.geocoding_service import GeocodingService
from app.services.planet_characteristics_service import PlanetCharacteristicsService
from app.services.preferences_runtime import PreferencesRuntimeResolver
from app.utils.constants import (
    PROGNOSTIC_DEFAULT_ORB,
    PROGNOSTIC_EXACT_ORB,
    PROGNOSTIC_EXCLUDED_NATAL_TARGETS,
    get_zodiac_sign,
    get_degree_in_sign,
    format_degree_minutes_seconds,
)


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
        year: int
    ) -> float:
        """
        Найти точный момент соляра (возвращения Солнца на натальную позицию)
        
        Args:
            natal_sun_lon: Долгота натального Солнца (0-360°)
            year: Год для соляра
            
        Returns:
            Julian Day момента соляра
        """
        # Начинаем поиск с 1 января нужного года
        jd_start = swe.julday(year, 1, 1, 0.0)
        
        # swe.solcross_ut находит момент когда Солнце пересекает заданную долготу
        # Возвращает Julian Day
        jd_solar = swe.solcross_ut(natal_sun_lon, jd_start, swe.FLG_SWIEPH)
        
        logger.debug(f"Solar return for Sun@{natal_sun_lon:.4f}° in {year}: JD={jd_solar}")
        
        return jd_solar

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

    def _enrich_motion_flags(self, planets: List[Dict], *, user_id: UUID) -> List[Dict]:
        stationary_threshold_percent = self.preferences_runtime.get_stationary_threshold_for_user(user_id)
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
        # 1. Загрузить натальные данные пользователя
        user = self.db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise ValueError(f"User not found: {user_id}")
        
        # 2. Получить долготу натального Солнца
        natal_sun = self.db.query(NatalPlanet).filter(
            NatalPlanet.user_id == user_id,
            NatalPlanet.planet == 'Sun'
        ).first()
        if not natal_sun:
            raise ValueError(f"Natal Sun not found for user: {user_id}")
        
        natal_sun_lon = float(natal_sun.degree)
        
        # 3. Определить место соляра
        if location_lat is None or location_lon is None:
            # По умолчанию — место рождения
            location_lat = float(user.lat)
            location_lon = float(user.lon)
            location_name = location_name or user.birth_place

        effective_timezone = self._normalize_timezone_candidate(location_timezone)
        if effective_timezone is None and location_source_id:
            effective_timezone = self._normalize_timezone_candidate(
                self.geocoding_service.resolve_timezone_by_source(location_source_id, self.db)
            )
        if effective_timezone is None:
            effective_timezone = self._normalize_timezone_candidate(user.timezone) or "UTC"
        
        # 4. Найти момент соляра
        jd_solar = self.find_solar_return_moment(natal_sun_lon, year)
        
        # 5. Конвертировать в datetime
        solar_datetime = self.jd_to_datetime(jd_solar, effective_timezone)
        
        # 6. Рассчитать планеты на момент соляра
        solar_planets = self.swisseph_engine.calculate_planets(jd_solar)
        
        # 7. Рассчитать дома на момент соляра для места соляра
        solar_houses, solar_angles = self.swisseph_engine.calculate_houses(
            jd_solar, location_lat, location_lon, house_system
        )
        
        # 8. Определить дома для планет
        for planet in solar_planets:
            planet['house'] = self.swisseph_engine.get_planet_house(
                planet['longitude'], solar_houses
            )

        # 8.1 Рассчитать аспекты внутри солярной карты и соляр → натал
        solar_aspects = self._calculate_solar_aspects(solar_planets, user_id=user_id)
        aspects_to_natal = self._calculate_solar_to_natal_aspects(user_id, solar_planets)
        solar_planets = self._enrich_motion_flags(solar_planets, user_id=user_id)
        
        # 9. Формируем результат
        result = self._build_solar_response(
            user=user,
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
            user_id=user_id,
            astrologer_id=user.astrologer_id,
        )
        
        # 10. Сохранить в БД если нужно
        if save_to_db:
            result['solar_id'] = str(self._save_solar_return(user_id, year, result, name=name))
            result['name'] = self._normalize_solar_name(name)

        return result

    def _build_solar_response(
        self,
        user: User,
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
                'user_id': str(user.user_id),
                'birth_date': user.birth_date.isoformat(),
                'birth_time': user.birth_time.isoformat() if user.birth_time else None,
                'birth_place': user.birth_place,
            },
            'planets': solar_planets,
            'houses': solar_houses,
            'angles': solar_angles,
            'aspects': solar_aspects,
            'aspects_to_natal': aspects_to_natal,
        }

    def _load_natal_aspect_targets(self, user_id: UUID) -> List[Dict]:
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

        return [
            target for target in targets
            if target['name'] not in PROGNOSTIC_EXCLUDED_NATAL_TARGETS
        ]

    def _get_aspect_types(self) -> List[RefAspectType]:
        return self.db.query(RefAspectType).all()

    def _calculate_prognostic_allowed_orb(self, user_id: UUID, body_a: str, body_b: str, aspect_type: str) -> float:
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

    @staticmethod
    def _angular_distance(longitude_a: float, longitude_b: float) -> float:
        diff = abs((float(longitude_a) % 360.0) - (float(longitude_b) % 360.0))
        return 360.0 - diff if diff > 180.0 else diff

    def _calculate_solar_to_natal_aspects(self, user_id: UUID, solar_planets: List[Dict]) -> List[Dict]:
        """Рассчитать аспекты солярных объектов к натальным объектам."""
        natal_targets = self._load_natal_aspect_targets(user_id)
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
                        user_id,
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

    def _calculate_solar_aspects(self, solar_planets: List[Dict], *, user_id: UUID) -> List[Dict]:
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
        return aspect_service.calculate_aspects_for_objects(objects, user_id=user_id)

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
            payload['planets'] = self._enrich_motion_flags(payload.get('planets', []), user_id=user_id)
            changed = False
            if 'aspects_to_natal' not in payload:
                payload['aspects_to_natal'] = self._calculate_solar_to_natal_aspects(user_id, payload.get('planets', []))
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
