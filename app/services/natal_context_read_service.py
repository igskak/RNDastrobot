"""Minimal read model for high-frequency forecast UI reads."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from hashlib import sha256
from json import dumps
from threading import RLock
from time import monotonic
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models import Angle, NatalHouse, NatalPlanet, NatalSpecialPoint, User


CONTEXT_TTL_SECONDS = 15 * 60
CONTEXT_MAX_ENTRIES = 512


def _float_or_none(value: Any) -> Optional[float]:
    if value is None:
        return None
    return float(value)


def _degree_in_sign(longitude: Optional[float]) -> Optional[float]:
    if longitude is None:
        return None
    return longitude % 30


def _iso_or_none(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


class NatalContextReadService:
    """Builds compact chart payloads without the full natal report graph."""

    _cache: Dict[str, tuple[Dict[str, Any], float]] = {}
    _lock = RLock()

    def __init__(self, db: Session):
        self.db = db

    @classmethod
    def clear_cache(cls) -> None:
        with cls._lock:
            cls._cache.clear()

    def get_aux_chart_for_user(self, user: User) -> Dict[str, Any]:
        key = self._cache_key(user)
        now = monotonic()
        with self._lock:
            cached = self._cache.get(key)
            if cached and cached[1] > now:
                return deepcopy(cached[0])

        chart = self._load_aux_chart(user)
        with self._lock:
            if len(self._cache) >= CONTEXT_MAX_ENTRIES:
                oldest_key = min(self._cache.items(), key=lambda item: item[1][1])[0]
                self._cache.pop(oldest_key, None)
            self._cache[key] = (deepcopy(chart), now + CONTEXT_TTL_SECONDS)
        return chart

    def fingerprint(self, chart: Dict[str, Any]) -> str:
        payload = {
            "user_id": chart.get("user_id"),
            "birth_data": chart.get("birth_data") or {},
            "planets": chart.get("planets") or [],
            "houses": chart.get("houses") or [],
            "angles": chart.get("angles") or {},
            "special_points": chart.get("special_points") or {},
        }
        raw = dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        return sha256(raw.encode("utf-8")).hexdigest()

    def _cache_key(self, user: User) -> str:
        updated_at = getattr(user, "updated_at", None)
        if isinstance(updated_at, datetime):
            updated_token = updated_at.isoformat()
        else:
            updated_token = str(updated_at or "")
        return "|".join(
            [
                str(user.user_id),
                updated_token,
                str(getattr(user, "julian_day", "") or ""),
                str(getattr(user, "house_system", "") or ""),
                str(getattr(user, "zodiac", "") or ""),
                str(getattr(user, "ayanamsha", "") or ""),
            ]
        )

    def _load_aux_chart(self, user: User) -> Dict[str, Any]:
        user_id = user.user_id
        planets = (
            self.db.query(NatalPlanet)
            .filter(NatalPlanet.user_id == user_id)
            .all()
        )
        houses = (
            self.db.query(NatalHouse)
            .filter(NatalHouse.user_id == user_id)
            .order_by(NatalHouse.house_number.asc())
            .all()
        )
        angles = self.db.query(Angle).filter(Angle.user_id == user_id).first()
        special_points = (
            self.db.query(NatalSpecialPoint)
            .filter(NatalSpecialPoint.user_id == user_id)
            .all()
        )

        return {
            "user_id": str(user.user_id),
            "birth_data": {
                "date": _iso_or_none(user.birth_date),
                "time": _iso_or_none(user.birth_time),
                "timezone": user.timezone,
                "place": user.birth_place,
                "latitude": _float_or_none(user.lat),
                "longitude": _float_or_none(user.lon),
                "julian_day": _float_or_none(user.julian_day),
                "house_system": user.house_system or "P",
                "zodiac": getattr(user, "zodiac", None) or "tropical",
                "ayanamsha": getattr(user, "ayanamsha", None),
            },
            "planets": [self._planet_payload(row) for row in planets],
            "houses": [self._house_payload(row) for row in houses],
            "angles": self._angles_payload(angles),
            "special_points": {
                row.point: self._special_point_payload(row)
                for row in special_points
            },
        }

    def _planet_payload(self, row: NatalPlanet) -> Dict[str, Any]:
        longitude = _float_or_none(row.degree)
        return {
            "name": row.planet,
            "longitude": longitude,
            "sign": row.sign,
            "degree_in_sign": _degree_in_sign(longitude),
            "house": row.house_number,
            "retrograde": bool(row.retrograde),
            "speed": _float_or_none(row.speed),
            "strength_score": _float_or_none(row.strength_score),
        }

    def _house_payload(self, row: NatalHouse) -> Dict[str, Any]:
        longitude = _float_or_none(row.cusp_degree)
        return {
            "number": row.house_number,
            "longitude": longitude,
            "sign": row.sign_on_cusp,
            "degree_in_sign": _degree_in_sign(longitude),
            "ruler_planet": row.ruler_planet,
        }

    def _angles_payload(self, row: Optional[Angle]) -> Dict[str, Dict[str, Any]]:
        if row is None:
            return {}
        specs = [
            ("ASC", row.asc_sign, row.asc_degree),
            ("MC", row.mc_sign, row.mc_degree),
            ("IC", row.ic_sign, row.ic_degree),
            ("DSC", row.dsc_sign, row.dsc_degree),
            ("Vertex", row.vertex_sign, row.vertex_degree),
        ]
        result: Dict[str, Dict[str, Any]] = {}
        for name, sign, raw_degree in specs:
            longitude = _float_or_none(raw_degree)
            if longitude is None:
                continue
            result[name] = {
                "name": name,
                "longitude": longitude,
                "sign": sign,
                "degree_in_sign": _degree_in_sign(longitude),
            }
        return result

    def _special_point_payload(self, row: NatalSpecialPoint) -> Dict[str, Any]:
        longitude = _float_or_none(row.degree)
        return {
            "name": row.point,
            "longitude": longitude,
            "sign": row.sign,
            "degree_in_sign": _degree_in_sign(longitude),
            "house": row.house_number,
        }
