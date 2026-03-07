"""
Сервис для геокодирования и автокомплита мест.

Слой приложения над локальной БД + внешним fallback:
- локальный поиск по geo_cities (primary)
- locale/script aware ранжирование
- дедупликация
- rate-limit + cache для внешнего fallback
"""
from collections import OrderedDict
from threading import RLock
from typing import Tuple, Optional, Dict, Any, List
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
import json
import logging
import socket
import time
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Встроенный кэш популярных городов (избегаем сетевых запросов для частых кейсов)
CITY_CACHE = {
    # Украина
    "киев": (50.4501, 30.5234, "Киев, Украина"),
    "київ": (50.4501, 30.5234, "Київ, Україна"),
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


class _BoundedTTLCache:
    """Потокобезопасный in-memory cache с TTL + LRU eviction."""

    def __init__(self, maxsize: int, ttl_seconds: int):
        self._maxsize = max(1, int(maxsize))
        self._ttl_seconds = max(1, int(ttl_seconds))
        self._data: "OrderedDict[str, Tuple[float, Any]]" = OrderedDict()
        self._lock = RLock()

    def _purge_expired(self, now: float) -> None:
        expired_keys = [
            key for key, (ts, _payload) in self._data.items()
            if (now - ts) > self._ttl_seconds
        ]
        for key in expired_keys:
            self._data.pop(key, None)

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            self._purge_expired(now)
            payload = self._data.get(key)
            if payload is None:
                return None
            self._data.move_to_end(key)
            return payload[1]

    def set(self, key: str, payload: Any) -> None:
        now = time.time()
        with self._lock:
            self._purge_expired(now)
            if key in self._data:
                self._data.pop(key, None)
            self._data[key] = (now, payload)
            self._data.move_to_end(key)
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)


class GeocodingService:
    """Качественный геокодинг-слой с дедупликацией и ранжированием."""

    BASE_URL = "https://nominatim.openstreetmap.org/search"
    CITY_TYPES = {"city", "town", "village", "municipality", "hamlet"}
    EXACT_CACHE_ONLY_KEYS = {"киев", "київ", "kyiv", "kiev"}

    def __init__(self):
        self._last_request_time = 0.0
        self._min_request_interval = 1.0
        self._max_retries = 3
        self._timeout_seconds = 8.0
        self._autocomplete_cache = _BoundedTTLCache(maxsize=2000, ttl_seconds=60 * 60 * 24)
        self._geocode_cache = _BoundedTTLCache(maxsize=1000, ttl_seconds=60 * 60 * 24)

    def _rate_limit(self) -> None:
        # TODO: limiter process-local. При multi-worker лимит Nominatim может нарушаться суммарно.
        # Для строгого межпроцессного лимита нужен shared backend (Redis/DB).
        current_time = time.time()
        since_last = current_time - self._last_request_time
        if since_last < self._min_request_interval:
            time.sleep(self._min_request_interval - since_last)
        self._last_request_time = time.time()

    @staticmethod
    def _normalize(value: str) -> str:
        return str(value or "").strip().lower()

    @staticmethod
    def _normalize_language(value: str) -> str:
        locale = str(value or "en").strip() or "en"
        return locale.split(",", 1)[0].split("-", 1)[0].lower()

    @staticmethod
    def _to_float(value: Any) -> Optional[float]:
        try:
            number = float(value)
            if number != number:  # NaN check
                return None
            return number
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _unique_parts(parts: List[Any]) -> List[str]:
        out: List[str] = []
        seen = set()
        for part in parts:
            text = str(part or "").strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(text)
        return out

    @staticmethod
    def _split_alternate_names(value: Optional[str], max_items: int = 80) -> List[str]:
        if not value:
            return []
        out: List[str] = []
        seen = set()
        for part in str(value).split(","):
            text = part.strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(text)
            if len(out) >= max_items:
                break
        return out

    @staticmethod
    def _detect_script(text: str) -> str:
        has_cyr = False
        has_lat = False
        for ch in str(text or ""):
            o = ord(ch)
            if (0x0400 <= o <= 0x04FF) or (0x0500 <= o <= 0x052F):
                has_cyr = True
            elif (0x0041 <= o <= 0x005A) or (0x0061 <= o <= 0x007A):
                has_lat = True
        if has_cyr and not has_lat:
            return "cyrillic"
        if has_lat and not has_cyr:
            return "latin"
        if has_cyr and has_lat:
            return "mixed"
        return "other"

    @staticmethod
    def _preferred_script_for_lang(language: str) -> str:
        if language in {"ru", "uk", "be", "bg", "sr", "mk"}:
            return "cyrillic"
        return "latin"

    def _match_score(self, query: str, candidate: str, query_script: str, preferred_script: str) -> float:
        q = self._normalize(query)
        q_head = self._normalize(query.split(",", 1)[0])
        c = self._normalize(candidate)

        score = 0.0
        if not c:
            return score

        if c == q or c == q_head:
            score += 150.0
        elif q_head and c.startswith(q_head):
            score += 95.0
        elif q_head and f" {q_head}" in c:
            score += 60.0
        elif q_head and q_head in c:
            score += 25.0

        script = self._detect_script(candidate)
        if query_script in {"cyrillic", "latin"} and script == query_script:
            score += 25.0
        if preferred_script in {"cyrillic", "latin"} and script == preferred_script:
            score += 10.0

        return score

    def _build_display_name(self, short_name: str, admin1: str, country: str) -> str:
        parts = self._unique_parts([short_name, admin1, country])
        return ", ".join(parts) if parts else short_name

    def _city_cache_autocomplete(self, query: str, limit: int, language: str) -> List[Dict[str, Any]]:
        q_norm = self._normalize(query)
        if len(q_norm) < 2:
            return []

        def localize_cached_label(key: str, fallback: str) -> Tuple[str, str]:
            if key in {"киев", "київ", "kyiv", "kiev"}:
                if language == "uk":
                    return "Київ", "Київ, Україна"
                if language == "ru":
                    return "Киев", "Киев, Украина"
                return "Kyiv", "Kyiv, Ukraine"
            short = fallback.split(",", 1)[0].strip() if fallback else key.title()
            return short, fallback or short

        items: List[Dict[str, Any]] = []
        seen = set()
        for key, (lat, lon, label) in CITY_CACHE.items():
            if key.startswith(q_norm) or q_norm.startswith(key):
                short_name, display_name = localize_cached_label(key, str(label))
                dedupe_key = (round(float(lat), 4), round(float(lon), 4))
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                items.append(
                    {
                        "short_name": short_name,
                        "display_name": display_name,
                        "lat": float(lat),
                        "lon": float(lon),
                        "importance": 1.0,
                        "place_rank": 35.0,
                        "source_id": f"cache:{key}",
                    }
                )
        return items[:limit]

    def _is_exact_city_cache_query(self, query: str) -> bool:
        return self._normalize(query) in self.EXACT_CACHE_ONLY_KEYS

    def _score(self, query: str, item: Dict[str, Any], language: str = "en") -> float:
        query_script = self._detect_script(query)
        preferred_script = self._preferred_script_for_lang(language)

        short_name = str(item.get("short_name") or "")
        score = self._match_score(query, short_name, query_script, preferred_script)
        score += (float(item.get("importance") or 0.0) * 1000.0)
        score += float(item.get("place_rank") or 0.0)
        return score

    def _rank_key(self, query: str, item: Dict[str, Any], language: str = "en") -> Tuple[float, str, str, str]:
        return (
            -self._score(query, item, language=language),
            self._normalize(item.get("display_name")),
            self._normalize(item.get("short_name")),
            str(item.get("source_id") or ""),
        )

    def _are_near_same_city(self, left: Dict[str, Any], right: Dict[str, Any]) -> bool:
        left_lat = self._to_float(left.get("lat"))
        left_lon = self._to_float(left.get("lon"))
        right_lat = self._to_float(right.get("lat"))
        right_lon = self._to_float(right.get("lon"))
        if left_lat is None or left_lon is None or right_lat is None or right_lon is None:
            return False
        return abs(left_lat - right_lat) <= 0.035 and abs(left_lon - right_lon) <= 0.035

    def _deduplicate_ranked(
        self,
        items: List[Dict[str, Any]],
        query: str,
        language: str,
        limit: int,
    ) -> List[Dict[str, Any]]:
        ranked = sorted(items, key=lambda x: self._rank_key(query, x, language=language))
        out: List[Dict[str, Any]] = []
        seen_display = set()
        for item in ranked:
            display_key = self._normalize(item.get("display_name"))
            if display_key and display_key in seen_display:
                continue
            if any(self._are_near_same_city(existing, item) for existing in out):
                continue
            if display_key:
                seen_display.add(display_key)
            out.append(item)
            if len(out) >= limit:
                break
        return out

    @staticmethod
    def _clone_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [dict(item) for item in items]

    def _cache_get(self, key: str) -> Optional[List[Dict[str, Any]]]:
        cached = self._autocomplete_cache.get(key)
        if cached is None:
            return None
        return self._clone_items(cached)

    def _cache_set(self, key: str, payload: List[Dict[str, Any]]) -> None:
        self._autocomplete_cache.set(key, self._clone_items(payload))

    def _fetch_raw(self, query: str, limit: int, language: str) -> List[Dict[str, Any]]:
        params = urlencode(
            {
                "format": "jsonv2",
                "q": query,
                "addressdetails": 1,
                "namedetails": 1,
                "dedupe": 1,
                "limit": max(limit * 4, 20),
            }
        )
        url = f"{self.BASE_URL}?{params}"
        request = Request(
            url,
            headers={
                "User-Agent": "swisseph-natal-chart/2.0",
                "Accept": "application/json",
                "Accept-Language": self._normalize_language(language),
            },
        )

        with urlopen(request, timeout=self._timeout_seconds) as response:
            if response.status != 200:
                raise GeocodingServiceError(f"Nominatim API error: HTTP {response.status}")
            body = response.read().decode("utf-8")
            payload = json.loads(body)
            return payload if isinstance(payload, list) else []

    def _autocomplete_local_db(
        self,
        query: str,
        limit: int,
        language: str,
        db_session: Optional[Session],
    ) -> List[Dict[str, Any]]:
        if db_session is None:
            return []

        try:
            q_norm = self._normalize(query)
            q_prefix = f"{q_norm}%"
            q_contains = f"%{q_norm}%"
            raw_limit = max(limit * 6, 80)

            sql = text(
                """
                WITH candidates AS (
                    (
                        SELECT
                            geoname_id, name, ascii_name, alternate_names, admin1_name, country_name,
                            latitude, longitude, population, 1 AS match_bucket
                        FROM geo_cities
                        WHERE lower(name) LIKE :q_prefix
                        ORDER BY population DESC
                        LIMIT :bucket_limit
                    )

                    UNION ALL

                    (
                        SELECT
                            geoname_id, name, ascii_name, alternate_names, admin1_name, country_name,
                            latitude, longitude, population, 2 AS match_bucket
                        FROM geo_cities
                        WHERE lower(COALESCE(ascii_name, '')) LIKE :q_prefix
                        ORDER BY population DESC
                        LIMIT :bucket_limit
                    )

                    UNION ALL

                    (
                        SELECT
                            geoname_id, name, ascii_name, alternate_names, admin1_name, country_name,
                            latitude, longitude, population, 3 AS match_bucket
                        FROM geo_cities
                        WHERE lower(COALESCE(alternate_names, '')) LIKE :q_contains
                        ORDER BY population DESC
                        LIMIT :bucket_limit
                    )
                ),
                dedup AS (
                    SELECT DISTINCT ON (geoname_id)
                        geoname_id,
                        name,
                        ascii_name,
                        alternate_names,
                        admin1_name,
                        country_name,
                        latitude,
                        longitude,
                        population,
                        match_bucket
                    FROM candidates
                    ORDER BY geoname_id, match_bucket ASC, population DESC
                )
                SELECT
                    geoname_id,
                    name,
                    ascii_name,
                    alternate_names,
                    admin1_name,
                    country_name,
                    latitude,
                    longitude,
                    population
                FROM dedup
                ORDER BY match_bucket ASC, population DESC, geoname_id ASC
                LIMIT :raw_limit
                """
            )

            rows = db_session.execute(
                sql,
                {
                    "q_prefix": q_prefix,
                    "q_contains": q_contains,
                    "bucket_limit": max(raw_limit, 40),
                    "raw_limit": raw_limit,
                },
            ).mappings().all()

            if not rows:
                return []

            q_script = self._detect_script(query)
            preferred_script = self._preferred_script_for_lang(language)

            by_label: Dict[str, Dict[str, Any]] = {}
            for row in rows:
                base_name = str(row.get("name") or "").strip()
                if not base_name:
                    continue

                lat = self._to_float(row.get("latitude"))
                lon = self._to_float(row.get("longitude"))
                if lat is None or lon is None:
                    continue

                candidates = [base_name]
                ascii_name = str(row.get("ascii_name") or "").strip()
                if ascii_name:
                    candidates.append(ascii_name)
                candidates.extend(self._split_alternate_names(row.get("alternate_names")))

                best_name = base_name
                best_name_score = -1.0
                best_script = self._detect_script(base_name)
                for candidate in candidates:
                    mscore = self._match_score(query, candidate, q_script, preferred_script)
                    if mscore > best_name_score:
                        best_name_score = mscore
                        best_name = candidate
                        best_script = self._detect_script(candidate)

                # Жёсткий отсев слабых совпадений: особенно для кириллицы.
                if best_name_score < 45.0:
                    continue
                if q_script == "cyrillic" and best_name_score < 90.0:
                    continue
                if q_script == "cyrillic" and best_script != "cyrillic" and best_name_score < 100.0:
                    continue

                admin1 = str(row.get("admin1_name") or "").strip()
                country = str(row.get("country_name") or "").strip()
                display_name = self._build_display_name(best_name, admin1, country)

                pop = int(row.get("population") or 0)
                item = {
                    "short_name": best_name,
                    "display_name": display_name,
                    "lat": lat,
                    "lon": lon,
                    "importance": float(min(1_000_000_000, pop)) / 1_000_000_000.0,
                    "place_rank": 30.0,
                    "source_id": f"geoname:{row.get('geoname_id')}",
                }

                key = self._normalize(display_name)
                existing = by_label.get(key)
                if not existing or self._score(query, item, language=language) > self._score(query, existing, language=language):
                    by_label[key] = item

            return self._deduplicate_ranked(list(by_label.values()), query, language, limit)
        except Exception as exc:
            logger.warning(f"Локальный геокодинг недоступен, fallback на внешний: {exc}")
            return []

    def _extract_short_name(self, raw: Dict[str, Any]) -> str:
        address = raw.get("address") or {}
        return str(
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("hamlet")
            or raw.get("name")
            or str(raw.get("display_name") or "").split(",", 1)[0]
            or ""
        ).strip()

    def _build_display_name_external(self, raw: Dict[str, Any]) -> str:
        address = raw.get("address") or {}
        parts = self._unique_parts([
            self._extract_short_name(raw),
            address.get("state") or address.get("region") or address.get("county"),
            address.get("country"),
        ])
        if parts:
            return ", ".join(parts)
        return str(raw.get("display_name") or "").strip()

    def _is_city_like(self, raw: Dict[str, Any]) -> bool:
        class_name = self._normalize(raw.get("class"))
        place_type = self._normalize(raw.get("type"))
        if class_name and class_name not in {"place", "boundary"}:
            return False
        if place_type and place_type not in self.CITY_TYPES:
            return False
        return True

    def autocomplete(
        self,
        query: str,
        limit: int = 5,
        language: str = "en",
        db_session: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        query_text = str(query or "").strip()
        if len(query_text) < 2:
            return []

        safe_limit = max(1, min(int(limit), 10))
        lang = self._normalize_language(language)

        primary_cache_hits = self._city_cache_autocomplete(query_text, safe_limit, lang)
        if primary_cache_hits and self._is_exact_city_cache_query(query_text):
            return primary_cache_hits[:safe_limit]

        local_results = self._autocomplete_local_db(query_text, safe_limit, lang, db_session)
        if primary_cache_hits or local_results:
            merged: Dict[str, Dict[str, Any]] = {}
            for item in primary_cache_hits + local_results:
                key = self._normalize(item["display_name"])
                existing = merged.get(key)
                if not existing or self._score(query_text, item, language=lang) > self._score(query_text, existing, language=lang):
                    merged[key] = item
            return self._deduplicate_ranked(list(merged.values()), query_text, lang, safe_limit)

        cache_key = f"{self._normalize(query_text)}|{safe_limit}|{lang}"
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        last_error: Optional[Exception] = None
        for attempt in range(self._max_retries):
            self._rate_limit()
            try:
                raw_items = self._fetch_raw(query_text, safe_limit, lang)
                normalized: List[Dict[str, Any]] = []
                for raw in raw_items:
                    if not isinstance(raw, dict):
                        continue
                    if not self._is_city_like(raw):
                        continue

                    lat = self._to_float(raw.get("lat"))
                    lon = self._to_float(raw.get("lon"))
                    if lat is None or lon is None:
                        continue

                    short_name = self._extract_short_name(raw)
                    display_name = self._build_display_name_external(raw)
                    if not short_name or not display_name:
                        continue

                    normalized.append(
                        {
                            "short_name": short_name,
                            "display_name": display_name,
                            "lat": lat,
                            "lon": lon,
                            "importance": float(raw.get("importance") or 0.0),
                            "place_rank": float(raw.get("place_rank") or 0.0),
                            "source_id": f"{raw.get('osm_type') or ''}:{raw.get('osm_id') or ''}",
                        }
                    )

                by_label: Dict[str, Dict[str, Any]] = {}
                for item in normalized:
                    key = self._normalize(item["display_name"])
                    existing = by_label.get(key)
                    if not existing:
                        by_label[key] = item
                        continue

                    if self._score(query_text, item, language=lang) > self._score(query_text, existing, language=lang):
                        by_label[key] = item

                ranked = self._deduplicate_ranked(list(by_label.values()), query_text, lang, safe_limit)

                self._cache_set(cache_key, ranked)
                return ranked
            except socket.timeout as e:
                last_error = e
                time.sleep(2 ** attempt)
            except HTTPError as e:
                last_error = e
                time.sleep(2 ** attempt)
            except URLError as e:
                last_error = e
                time.sleep(2 ** attempt)
            except json.JSONDecodeError as e:
                last_error = e
                time.sleep(2 ** attempt)

        if isinstance(last_error, socket.timeout):
            raise GeocodingTimeoutError("Превышено время ожидания при обращении к сервису геокодирования")
        raise GeocodingServiceError(
            "Сервис геокодирования временно недоступен. Попробуйте позже или укажите координаты вручную."
        )

    def geocode(self, place: str, db_session: Optional[Session] = None) -> Tuple[float, float, str]:
        """Получить координаты по названию места."""
        place_lower = self._normalize(place)
        cached = self._geocode_cache.get(place_lower)
        if cached is not None:
            return cached

        if place_lower in CITY_CACHE:
            logger.info(f"Город найден в кэше: {place}")
            self._geocode_cache.set(place_lower, CITY_CACHE[place_lower])
            return CITY_CACHE[place_lower]

        for city_key, coords in CITY_CACHE.items():
            if place_lower.startswith(city_key):
                logger.info(f"Город найден в кэше (частичное совпадение): {place} -> {city_key}")
                self._geocode_cache.set(place_lower, coords)
                return coords

        candidates = self.autocomplete(place, limit=1, language="en", db_session=db_session)
        if not candidates:
            raise ValueError(f"Место не найдено: {place}")

        best = candidates[0]
        resolved = (float(best["lat"]), float(best["lon"]), str(best["display_name"]))
        self._geocode_cache.set(place_lower, resolved)
        return resolved

    def get_coordinates(
        self,
        place: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        db_session: Optional[Session] = None,
    ) -> Tuple[float, float, Optional[str]]:
        """Получить координаты из места или использовать предоставленные."""
        if latitude is not None and longitude is not None:
            return latitude, longitude, place

        if place:
            lat, lon, formatted_address = self.geocode(place, db_session=db_session)
            return lat, lon, formatted_address

        raise ValueError("Необходимо указать либо place, либо latitude и longitude")
