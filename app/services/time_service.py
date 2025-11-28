"""
Сервис для работы со временем и датами
"""
import pytz
from datetime import datetime, date, time
import swisseph as swe
from typing import Tuple


class TimeService:
    """Сервис для конвертации времени и расчёта юлианского дня"""
    
    @staticmethod
    def to_utc(local_date: date, local_time: time, timezone_str: str) -> datetime:
        """
        Конвертация локального времени в UTC
        
        Args:
            local_date: Локальная дата
            local_time: Локальное время
            timezone_str: Строка временной зоны (например, 'America/New_York')
        
        Returns:
            Datetime в UTC
        """
        tz = pytz.timezone(timezone_str)
        dt = datetime.combine(local_date, local_time)
        
        # Локализуем время в указанной зоне
        local_dt = tz.localize(dt)
        
        # Конвертируем в UTC
        utc_dt = local_dt.astimezone(pytz.UTC)
        
        return utc_dt
    
    @staticmethod
    def to_julian_day(utc_datetime: datetime) -> float:
        """
        Расчёт юлианского дня из UTC datetime
        
        Args:
            utc_datetime: Datetime в UTC
        
        Returns:
            Юлианский день (JD)
        """
        hour_decimal = (
            utc_datetime.hour + 
            utc_datetime.minute / 60.0 + 
            utc_datetime.second / 3600.0
        )
        
        jd = swe.julday(
            utc_datetime.year,
            utc_datetime.month,
            utc_datetime.day,
            hour_decimal,
            swe.GREG_CAL  # Григорианский календарь
        )
        
        return jd
    
    @staticmethod
    def process_birth_time(
        birth_date: date,
        birth_time: time,
        timezone_str: str
    ) -> Tuple[datetime, float]:
        """
        Обработка времени рождения: конвертация в UTC и расчёт JD
        
        Args:
            birth_date: Дата рождения
            birth_time: Время рождения
            timezone_str: Временная зона
        
        Returns:
            Кортеж (UTC datetime, Julian Day)
        """
        utc_dt = TimeService.to_utc(birth_date, birth_time, timezone_str)
        jd = TimeService.to_julian_day(utc_dt)
        
        return utc_dt, jd

