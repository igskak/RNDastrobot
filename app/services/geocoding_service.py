"""
Сервис для геокодирования (определение координат по названию места)
"""
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError, GeocoderUnavailable
from functools import lru_cache
from typing import Tuple, Optional
import time
import logging

logger = logging.getLogger(__name__)

# Встроенный кэш популярных городов (избегаем запросов к Nominatim)
CITY_CACHE = {
    # Украина
    "киев": (50.4501, 30.5234, "Киев, Украина"),
    "kyiv": (50.4501, 30.5234, "Kyiv, Ukraine"),
    "kiev": (50.4501, 30.5234, "Kyiv, Ukraine"),
    "харьков": (49.9935, 36.2304, "Харьков, Украина"),
    "kharkiv": (49.9935, 36.2304, "Kharkiv, Ukraine"),
    "одесса": (46.4825, 30.7233, "Одесса, Украина"),
    "odessa": (46.4825, 30.7233, "Odessa, Ukraine"),
    "днепр": (48.4647, 35.0462, "Днепр, Украина"),
    "dnipro": (48.4647, 35.0462, "Dnipro, Ukraine"),
    "львов": (49.8397, 24.0297, "Львов, Украина"),
    "lviv": (49.8397, 24.0297, "Lviv, Ukraine"),
    "запорожье": (47.8388, 35.1396, "Запорожье, Украина"),
    # Россия
    "москва": (55.7558, 37.6173, "Москва, Россия"),
    "moscow": (55.7558, 37.6173, "Moscow, Russia"),
    "санкт-петербург": (59.9343, 30.3351, "Санкт-Петербург, Россия"),
    "saint petersburg": (59.9343, 30.3351, "Saint Petersburg, Russia"),
    "новосибирск": (55.0084, 82.9357, "Новосибирск, Россия"),
    "екатеринбург": (56.8389, 60.6057, "Екатеринбург, Россия"),
    "казань": (55.8304, 49.0661, "Казань, Россия"),
    # США
    "new york": (40.7128, -74.0060, "New York, NY, USA"),
    "los angeles": (34.0522, -118.2437, "Los Angeles, CA, USA"),
    "chicago": (41.8781, -87.6298, "Chicago, IL, USA"),
    # Европа
    "london": (51.5074, -0.1278, "London, UK"),
    "paris": (48.8566, 2.3522, "Paris, France"),
    "berlin": (52.5200, 13.4050, "Berlin, Germany"),
    "rome": (41.9028, 12.4964, "Rome, Italy"),
    "madrid": (40.4168, -3.7038, "Madrid, Spain"),
    "warsaw": (52.2297, 21.0122, "Warsaw, Poland"),
    "варшава": (52.2297, 21.0122, "Варшава, Польша"),
}


class GeocodingService:
    """Сервис для геокодирования с использованием Nominatim (OpenStreetMap)"""

    def __init__(self, user_agent: str = "swisseph-natal-chart/1.0 (educational project)"):
        """
        Инициализация геокодера

        Args:
            user_agent: User agent для запросов к Nominatim
        """
        self.geolocator = Nominatim(user_agent=user_agent, timeout=15)
        self._last_request_time = 0
        self._min_request_interval = 1.5  # Увеличиваем интервал для надёжности
        self._max_retries = 3
    
    def _rate_limit(self):
        """Ограничение частоты запросов (rate limiting)"""
        current_time = time.time()
        time_since_last_request = current_time - self._last_request_time
        
        if time_since_last_request < self._min_request_interval:
            sleep_time = self._min_request_interval - time_since_last_request
            time.sleep(sleep_time)
        
        self._last_request_time = time.time()
    
    @lru_cache(maxsize=1000)
    def geocode(self, place: str) -> Tuple[float, float, str]:
        """
        Получить координаты по названию места

        Args:
            place: Название места (например, "New York, NY, USA")

        Returns:
            Кортеж (latitude, longitude, formatted_address)

        Raises:
            ValueError: Если место не найдено
            GeocoderTimedOut: Если превышено время ожидания
            GeocoderServiceError: Если сервис недоступен
        """
        # Сначала проверяем встроенный кэш
        place_lower = place.lower().strip()
        if place_lower in CITY_CACHE:
            logger.info(f"Город найден в кэше: {place}")
            return CITY_CACHE[place_lower]

        # Проверяем частичное совпадение (город в начале строки)
        for city_key, coords in CITY_CACHE.items():
            if place_lower.startswith(city_key):
                logger.info(f"Город найден в кэше (частичное совпадение): {place} -> {city_key}")
                return coords

        last_error = None

        for attempt in range(self._max_retries):
            self._rate_limit()

            try:
                location = self.geolocator.geocode(place)

                if not location:
                    raise ValueError(f"Место не найдено: {place}")

                return (
                    location.latitude,
                    location.longitude,
                    location.address
                )

            except GeocoderTimedOut as e:
                last_error = e
                logger.warning(f"Таймаут геокодирования (попытка {attempt + 1}/{self._max_retries}): {place}")
                time.sleep(2 ** attempt)  # Exponential backoff
                continue

            except (GeocoderServiceError, GeocoderUnavailable) as e:
                last_error = e
                logger.warning(f"Ошибка сервиса геокодирования (попытка {attempt + 1}/{self._max_retries}): {e}")
                time.sleep(2 ** attempt)
                continue

        # Все попытки исчерпаны
        logger.error(f"Геокодирование не удалось после {self._max_retries} попыток: {place}")
        raise GeocoderServiceError(f"Сервис геокодирования временно недоступен. Попробуйте позже или укажите координаты вручную.")
    
    def get_coordinates(
        self,
        place: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Tuple[float, float, Optional[str]]:
        """
        Получить координаты из места или использовать предоставленные
        
        Args:
            place: Название места (опционально)
            latitude: Широта (опционально)
            longitude: Долгота (опционально)
        
        Returns:
            Кортеж (latitude, longitude, place_name)
        
        Raises:
            ValueError: Если не указаны ни место, ни координаты
        """
        # Если координаты уже предоставлены, используем их
        if latitude is not None and longitude is not None:
            return latitude, longitude, place
        
        # Если указано место, геокодируем его
        if place:
            lat, lon, formatted_address = self.geocode(place)
            return lat, lon, formatted_address
        
        # Если ничего не указано
        raise ValueError("Необходимо указать либо place, либо latitude и longitude")

