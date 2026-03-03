"""
Сервис для геокодирования (определение координат по названию места)
"""
from functools import lru_cache
from typing import Tuple, Optional, Dict, Any, List
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
import json
import logging
import socket
import time

logger = logging.getLogger(__name__)

# Встроенный кэш популярных городов (избегаем сетевых запросов)
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


class GeocodingTimeoutError(Exception):
    """Timeout при обращении к геокодеру."""


class GeocodingServiceError(Exception):
    """Внешний сервис геокодирования временно недоступен."""


class GeocodingService:
    """Сервис геокодирования на Open-Meteo Geocoding API."""

    BASE_URL = "https://geocoding-api.open-meteo.com/v1/search"

    def __init__(self):
        self._last_request_time = 0.0
        self._min_request_interval = 0.35
        self._max_retries = 3
        self._timeout_seconds = 8.0

    def _rate_limit(self) -> None:
        current_time = time.time()
        time_since_last_request = current_time - self._last_request_time

        if time_since_last_request < self._min_request_interval:
            sleep_time = self._min_request_interval - time_since_last_request
            time.sleep(sleep_time)

        self._last_request_time = time.time()

    @staticmethod
    def _normalize(value: str) -> str:
        return str(value or "").strip().lower()

    @staticmethod
    def _build_label(result: Dict[str, Any]) -> str:
        parts = []
        seen = set()
        for key in ("name", "admin1", "country"):
            value = str(result.get(key) or "").strip()
            if not value:
                continue
            lowered = value.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            parts.append(value)
        return ", ".join(parts) if parts else "Unknown location"

    @staticmethod
    def _is_city_like(result: Dict[str, Any]) -> bool:
        code = str(result.get("feature_code") or "").upper()
        if not code:
            return True
        return code.startswith("PPL") or code == "PPLC"

    @staticmethod
    def _parse_results(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        results = payload.get("results")
        if not isinstance(results, list):
            return []

        parsed: List[Dict[str, Any]] = []
        for item in results:
            if not isinstance(item, dict):
                continue
            try:
                lat = float(item.get("latitude"))
                lon = float(item.get("longitude"))
            except (TypeError, ValueError):
                continue
            if not GeocodingService._is_city_like(item):
                continue
            parsed.append(
                {
                    "name": item.get("name") or "",
                    "admin1": item.get("admin1") or "",
                    "country": item.get("country") or "",
                    "population": int(item.get("population") or 0),
                    "latitude": lat,
                    "longitude": lon,
                }
            )
        return parsed

    def _fetch_candidates(self, query: str, count: int = 12, language: str = "en") -> List[Dict[str, Any]]:
        params = urlencode(
            {
                "name": query,
                "count": max(1, int(count)),
                "language": language,
                "format": "json",
            }
        )
        url = f"{self.BASE_URL}?{params}"
        headers = {
            "User-Agent": "swisseph-natal-chart/2.0",
            "Accept": "application/json",
        }

        request = Request(url, headers=headers)
        with urlopen(request, timeout=self._timeout_seconds) as response:
            if response.status != 200:
                raise GeocodingServiceError(f"Geocoding API error: HTTP {response.status}")
            body = response.read().decode("utf-8")
            payload = json.loads(body)
            return self._parse_results(payload)

    def _score_candidate(self, query: str, item: Dict[str, Any]) -> float:
        normalized_query = self._normalize(query)
        query_head = self._normalize(query.split(",", 1)[0])
        item_name = self._normalize(item.get("name", ""))

        score = 0.0
        if item_name == normalized_query or item_name == query_head:
            score += 120.0
        elif item_name.startswith(query_head) and query_head:
            score += 75.0
        elif query_head and query_head in item_name:
            score += 40.0

        population = max(0, int(item.get("population") or 0))
        score += min(60.0, population / 200000.0)

        return score

    @lru_cache(maxsize=1000)
    def geocode(self, place: str) -> Tuple[float, float, str]:
        """
        Получить координаты по названию места.

        Args:
            place: Название места (например, "New York, NY, USA")

        Returns:
            Кортеж (latitude, longitude, formatted_address)

        Raises:
            ValueError: Если место не найдено
            GeocodingTimeoutError: Если превышено время ожидания
            GeocodingServiceError: Если сервис недоступен
        """
        place_lower = self._normalize(place)
        if place_lower in CITY_CACHE:
            logger.info(f"Город найден в кэше: {place}")
            return CITY_CACHE[place_lower]

        for city_key, coords in CITY_CACHE.items():
            if place_lower.startswith(city_key):
                logger.info(f"Город найден в кэше (частичное совпадение): {place} -> {city_key}")
                return coords

        last_error: Optional[Exception] = None

        for attempt in range(self._max_retries):
            self._rate_limit()
            try:
                candidates = self._fetch_candidates(place, count=15, language="en")
                if not candidates:
                    raise ValueError(f"Место не найдено: {place}")

                best = max(candidates, key=lambda item: self._score_candidate(place, item))
                return (
                    float(best["latitude"]),
                    float(best["longitude"]),
                    self._build_label(best),
                )
            except ValueError:
                raise
            except HTTPError as e:
                last_error = e
                logger.warning(
                    f"HTTP ошибка геокодирования (попытка {attempt + 1}/{self._max_retries}): {e}"
                )
                time.sleep(2 ** attempt)
            except socket.timeout as e:
                last_error = e
                logger.warning(
                    f"Таймаут геокодирования (попытка {attempt + 1}/{self._max_retries}): {place}"
                )
                time.sleep(2 ** attempt)
            except URLError as e:
                last_error = e
                logger.warning(
                    f"Ошибка сети геокодирования (попытка {attempt + 1}/{self._max_retries}): {e}"
                )
                time.sleep(2 ** attempt)
            except json.JSONDecodeError as e:
                last_error = e
                logger.warning(
                    f"Некорректный JSON от геокодера (попытка {attempt + 1}/{self._max_retries}): {e}"
                )
                time.sleep(2 ** attempt)

        if isinstance(last_error, socket.timeout):
            raise GeocodingTimeoutError(
                "Превышено время ожидания при обращении к сервису геокодирования"
            )

        logger.error(f"Геокодирование не удалось после {self._max_retries} попыток: {place}")
        raise GeocodingServiceError(
            "Сервис геокодирования временно недоступен. Попробуйте позже или укажите координаты вручную."
        )

    def get_coordinates(
        self,
        place: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Tuple[float, float, Optional[str]]:
        """
        Получить координаты из места или использовать предоставленные.

        Args:
            place: Название места (опционально)
            latitude: Широта (опционально)
            longitude: Долгота (опционально)

        Returns:
            Кортеж (latitude, longitude, place_name)

        Raises:
            ValueError: Если не указаны ни место, ни координаты
        """
        if latitude is not None and longitude is not None:
            return latitude, longitude, place

        if place:
            lat, lon, formatted_address = self.geocode(place)
            return lat, lon, formatted_address

        raise ValueError("Необходимо указать либо place, либо latitude и longitude")
