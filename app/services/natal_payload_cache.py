"""Shared in-process cache for the raw natal payload read by forecast layers (D2, Phase 4).

Transit/progression/direction/solar services each re-read the SAME natal data
(NatalPlanet/NatalHouse/Angle/NatalSpecialPoint) — 4-5 queries — on every date
step and even several times within one request. Since the natal rows only change
when the chart is recomputed (which updates+flushes the `users` row and bumps
`users.updated_at`), a cache keyed on the user's identity + updated_at + chart
parameters is self-invalidating for every production natal-edit path.

Modelled on NatalContextReadService's cache key. Payloads are deep-copied on get
and set so callers may mutate the returned structure freely.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from threading import RLock
from time import monotonic
from typing import Any, Dict, Optional


PAYLOAD_TTL_SECONDS = 15 * 60
PAYLOAD_MAX_ENTRIES = 512


class NatalPayloadCache:
    """Thread-safe TTL cache of prognostic natal payloads keyed by chart version."""

    _cache: Dict[str, tuple[Any, float]] = {}
    _lock = RLock()

    @classmethod
    def clear_cache(cls) -> None:
        with cls._lock:
            cls._cache.clear()

    @classmethod
    def make_key(cls, user: Any, *extra: Any) -> str:
        """Key = user_id | updated_at | julian_day | house_system | zodiac | ayanamsha | extra.

        updated_at auto-bumps on any UPDATE of the users row, so every chart edit
        (birth data, house system, zodiac) produces a fresh key. `extra` lets a
        caller add discriminators (e.g. apply_exclusions) that change the payload
        shape without touching the chart itself.
        """
        updated_at = getattr(user, "updated_at", None)
        if isinstance(updated_at, datetime):
            updated_token = updated_at.isoformat()
        else:
            updated_token = str(updated_at or "")
        parts = [
            str(getattr(user, "user_id", "")),
            updated_token,
            str(getattr(user, "julian_day", "") or ""),
            str(getattr(user, "house_system", "") or ""),
            str(getattr(user, "zodiac", "") or ""),
            str(getattr(user, "ayanamsha", "") or ""),
        ]
        parts.extend(str(item) for item in extra)
        return "|".join(parts)

    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        now = monotonic()
        with cls._lock:
            entry = cls._cache.get(key)
            if entry and entry[1] > now:
                return deepcopy(entry[0])
            if entry:
                cls._cache.pop(key, None)
        return None

    @classmethod
    def set(cls, key: str, value: Any) -> None:
        now = monotonic()
        with cls._lock:
            if len(cls._cache) >= PAYLOAD_MAX_ENTRIES:
                oldest = min(cls._cache.items(), key=lambda item: item[1][1])[0]
                cls._cache.pop(oldest, None)
            cls._cache[key] = (deepcopy(value), now + PAYLOAD_TTL_SECONDS)
