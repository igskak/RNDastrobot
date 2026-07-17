"""In-process cache for inline/ephemeral natal chart computation (D3, Phase 4).

The forecast layers (transits/solar/progressions/directions) recompute the SAME
inline natal via swisseph on every date step during rectification — birth data
is fixed, only the transit date changes. This memoizes the pure compute result
by its inputs, keyed by sha256 of the natal parameters + astrologer_id.

Only the pure path (save_to_db=False) is cached: it does no DB writes and its
output is a deterministic function of the inputs. Results are deep-copied on get
and set so callers can freely mutate the returned dict.

TTL bounds any staleness (e.g. astrologer orb preferences) to 10 minutes; the
preferences writer additionally calls invalidate_for_astrologer() for immediacy.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date, time as time_type
from hashlib import sha256
from json import dumps
from threading import RLock
from time import monotonic
from typing import Any, Dict, Optional
from uuid import UUID


CACHE_TTL_SECONDS = 10 * 60
CACHE_MAX_ENTRIES = 256


class NatalChartCache:
    """Thread-safe TTL cache for NatalChartService.calculate_natal_chart results."""

    _cache: Dict[str, tuple[str, Dict[str, Any], float]] = {}
    _lock = RLock()

    @classmethod
    def clear_cache(cls) -> None:
        with cls._lock:
            cls._cache.clear()

    @classmethod
    def invalidate_for_astrologer(cls, astrologer_id: Any) -> None:
        """Drop cached charts for one astrologer (e.g. after orb-pref changes)."""
        token = str(astrologer_id or "")
        with cls._lock:
            stale = [key for key, entry in cls._cache.items() if entry[0] == token]
            for key in stale:
                cls._cache.pop(key, None)

    @classmethod
    def _key(cls, params: Dict[str, Any]) -> str:
        raw = dumps(params, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        return sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def get(cls, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        key = cls._key(params)
        now = monotonic()
        with cls._lock:
            entry = cls._cache.get(key)
            if entry and entry[2] > now:
                return deepcopy(entry[1])
            if entry:
                cls._cache.pop(key, None)
        return None

    @classmethod
    def set(cls, params: Dict[str, Any], value: Dict[str, Any]) -> None:
        key = cls._key(params)
        astrologer_token = str(params.get("astrologer_id") or "")
        now = monotonic()
        with cls._lock:
            if len(cls._cache) >= CACHE_MAX_ENTRIES:
                oldest = min(cls._cache.items(), key=lambda item: item[1][2])[0]
                cls._cache.pop(oldest, None)
            cls._cache[key] = (astrologer_token, deepcopy(value), now + CACHE_TTL_SECONDS)


def _normalize_param(value: Any) -> Any:
    if isinstance(value, (date, time_type)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def calculate_natal_chart_cached(
    service: Any,
    *,
    db_session: Any = None,
    birth_date: date,
    birth_time: time_type,
    timezone: str,
    astrologer_id: Optional[UUID] = None,
    place: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    house_system: str = "P",
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    zodiac: str = "tropical",
    ayanamsha: str = "lahiri",
) -> Dict[str, Any]:
    """Memoized wrapper over NatalChartService.calculate_natal_chart(save_to_db=False).

    The cache key covers every argument that influences the computed chart. Only
    db_session (a transient handle) is excluded. save_to_db is forced False.
    """
    key_params = {
        "birth_date": _normalize_param(birth_date),
        "birth_time": _normalize_param(birth_time),
        "timezone": timezone,
        "astrologer_id": _normalize_param(astrologer_id),
        "place": place,
        "latitude": latitude,
        "longitude": longitude,
        "house_system": house_system,
        "first_name": first_name,
        "last_name": last_name,
        "zodiac": zodiac,
        "ayanamsha": ayanamsha,
    }

    cached = NatalChartCache.get(key_params)
    if cached is not None:
        return cached

    result = service.calculate_natal_chart(
        birth_date=birth_date,
        birth_time=birth_time,
        timezone=timezone,
        astrologer_id=astrologer_id,
        place=place,
        latitude=latitude,
        longitude=longitude,
        house_system=house_system,
        save_to_db=False,
        db_session=db_session,
        first_name=first_name,
        last_name=last_name,
        zodiac=zodiac,
        ayanamsha=ayanamsha,
    )
    if isinstance(result, dict):
        NatalChartCache.set(key_params, result)
    return result
