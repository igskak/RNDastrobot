"""
Solar Return Service - расчёт соларной карты (годовой прогноз)

Соляр — карта на момент точного возвращения Солнца на натальную позицию.
Реализация по образцу ZET.
"""
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from datetime import date, time, datetime
from decimal import Decimal
import pytz
import swisseph as swe
from sqlalchemy.orm import Session
from loguru import logger

from app.database.models import User, NatalPlanet, SolarReturn
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.services.aspect_service import AspectService
from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds


class SolarReturnService:
    """Сервис для расчёта соларных карт"""

    def __init__(self, db_session: Session, ephe_path: str = None):
        self.db = db_session
        self.swisseph_engine = SwissEphemerisEngine(ephe_path)
        if ephe_path:
            swe.set_ephe_path(ephe_path)

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

    def calculate_solar_return(
        self,
        user_id: UUID,
        year: int,
        location_lat: Optional[float] = None,
        location_lon: Optional[float] = None,
        location_name: Optional[str] = None,
        house_system: str = 'P',
        save_to_db: bool = True
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
        
        # 4. Найти момент соляра
        jd_solar = self.find_solar_return_moment(natal_sun_lon, year)
        
        # 5. Конвертировать в datetime
        solar_datetime = self.jd_to_datetime(jd_solar, user.timezone)
        
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
            natal_sun_lon=natal_sun_lon
        )
        
        # 10. Сохранить в БД если нужно
        if save_to_db:
            self._save_solar_return(user_id, year, result)

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
        natal_sun_lon: float
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
                'timezone': user.timezone,
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
        }

    def _save_solar_return(self, user_id: UUID, year: int, result: Dict) -> None:
        """Сохранить соляр в БД"""
        import json

        # Проверяем, есть ли уже соляр для этого года
        existing = self.db.query(SolarReturn).filter(
            SolarReturn.user_id == user_id,
            SolarReturn.year == year
        ).first()

        solar_info = result['solar_info']

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
            existing.chart_data = json.dumps(result)
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
                chart_data=json.dumps(result)
            )
            self.db.add(solar_return)

        self.db.commit()
        logger.info(f"Solar return saved: user={user_id}, year={year}")

    def get_solar_return(self, user_id: UUID, year: int) -> Optional[Dict]:
        """Получить сохранённый соляр из БД"""
        import json

        solar = self.db.query(SolarReturn).filter(
            SolarReturn.user_id == user_id,
            SolarReturn.year == year
        ).first()

        if solar and solar.chart_data:
            return json.loads(solar.chart_data)
        return None

    def list_solar_returns(self, user_id: UUID) -> List[Dict]:
        """Получить список всех соляров пользователя"""
        solars = self.db.query(SolarReturn).filter(
            SolarReturn.user_id == user_id
        ).order_by(SolarReturn.year.desc()).all()

        return [
            {
                'year': s.year,
                'solar_datetime': s.solar_datetime.isoformat() if s.solar_datetime else None,
                'location_name': s.location_name,
            }
            for s in solars
        ]

