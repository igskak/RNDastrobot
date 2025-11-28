"""
Сервис для геокодирования (определение координат по названию места)
"""
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from functools import lru_cache
from typing import Tuple, Optional
import time


class GeocodingService:
    """Сервис для геокодирования с использованием Nominatim (OpenStreetMap)"""
    
    def __init__(self, user_agent: str = "astrobot/1.0"):
        """
        Инициализация геокодера
        
        Args:
            user_agent: User agent для запросов к Nominatim
        """
        self.geolocator = Nominatim(user_agent=user_agent, timeout=10)
        self._last_request_time = 0
        self._min_request_interval = 1.0  # Nominatim требует минимум 1 секунду между запросами
    
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
        
        except GeocoderTimedOut:
            raise GeocoderTimedOut(f"Превышено время ожидания при геокодировании: {place}")
        
        except GeocoderServiceError as e:
            raise GeocoderServiceError(f"Ошибка сервиса геокодирования: {str(e)}")
    
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

