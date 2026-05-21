from __future__ import annotations

import copy
import hashlib
import json
import threading
import time
from dataclasses import dataclass
from datetime import date, datetime, time as dt_time, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import UUID

import swisseph as swe
from loguru import logger

from app.database.connection import db_manager
from app.database.models import NatalHouse, NatalPlanet, NatalSpecialPoint, User
from app.services.special_points_service import SpecialPointsService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.utils.constants import get_zodiac_sign
from app.utils.ephemeris import get_ephemeris_path

TROPICAL_YEAR_DAYS = 365.2421897
NAIBOD_KEY = 0.98565
DEFAULT_DIRECTION_TYPE = "zodiacal"
DIRECTION_TYPE_ALIASES = {
    "symbolic": "zodiacal",
}

PLANET_SUMMARY_ORDER = [
    "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
    "Uranus", "Neptune", "Pluto",
]
SPECIAL_POINTS_ORDER = [
    "TrueNorthNode", "TrueSouthNode", "BlackMoon", "WhiteMoon", "Fortune",
    "Chiron", "Proserpina", "Vertex", "AntiVertex",
]


@dataclass
class _CacheEntry:
    expires_at: float
    payload: Dict


@dataclass
class _InFlightEntry:
    event: threading.Event
    payload: Optional[Dict] = None
    error: Optional[BaseException] = None


@dataclass
class _NatalContext:
    user_id: UUID
    birth_jd: float
    birth_date: date
    lat: float
    lon: float
    natal_planets: Dict[str, float]
    natal_special_points: Dict[str, float]
    natal_houses: List[Dict]
    natal_hash: str


class PeriodIngressSummaryService:
    """Server-side ingress summary for a whole period (biwheel table)."""

    CACHE_TTL_SECONDS = 15 * 60
    CALC_VERSION = "ingress_period_summary_v6"

    _cache: Dict[str, _CacheEntry] = {}
    _in_flight: Dict[str, _InFlightEntry] = {}
    _lock = threading.Lock()

    def __init__(self, ephe_path: Optional[str] = None):
        self._ephe_path = ephe_path or get_ephemeris_path()
        self._engine = SwissEphemerisEngine(self._ephe_path)
        swe.set_ephe_path(self._ephe_path)

    def calculate_period_summary(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
        timezone: str,
        direction_type: str,
    ) -> Dict:
        started = time.perf_counter()
        start_date, end_date = self._normalize_period(start_date, end_date)
        direction_type = self._normalize_direction_type(direction_type)

        natal = self._load_natal_context(user_id)
        cache_key = self._build_cache_key(
            user_id=user_id,
            natal_hash=natal.natal_hash,
            start_date=start_date,
            end_date=end_date,
            timezone=timezone,
            direction_type=direction_type,
        )

        cached = self._try_get_cache(cache_key)
        if cached is not None:
            latency_ms = int((time.perf_counter() - started) * 1000)
            cached.setdefault("meta", {})
            cached["meta"].update({"cache_hit": True, "latency_ms": latency_ms})
            logger.info(
                "Ingress period summary cache HIT user={} period={}..{} dir={} latency_ms={}",
                user_id,
                start_date,
                end_date,
                direction_type,
                latency_ms,
            )
            return cached

        with self._lock:
            cached = self._cache.get(cache_key)
            now = time.time()
            if cached and cached.expires_at > now:
                payload = copy.deepcopy(cached.payload)
                latency_ms = int((time.perf_counter() - started) * 1000)
                payload.setdefault("meta", {})
                payload["meta"].update({"cache_hit": True, "latency_ms": latency_ms})
                return payload

            in_flight = self._in_flight.get(cache_key)
            if in_flight is None:
                in_flight = _InFlightEntry(event=threading.Event())
                self._in_flight[cache_key] = in_flight
                owner = True
            else:
                owner = False

        if not owner:
            in_flight.event.wait()
            if in_flight.error:
                raise in_flight.error
            payload = copy.deepcopy(in_flight.payload or {})
            latency_ms = int((time.perf_counter() - started) * 1000)
            payload.setdefault("meta", {})
            payload["meta"].update({"cache_hit": True, "latency_ms": latency_ms})
            logger.info(
                "Ingress period summary deduplicated user={} period={}..{} dir={} latency_ms={}",
                user_id,
                start_date,
                end_date,
                direction_type,
                latency_ms,
            )
            return payload

        try:
            payload = self._calculate_uncached(
                natal=natal,
                start_date=start_date,
                end_date=end_date,
                timezone=timezone,
                direction_type=direction_type,
            )
            with self._lock:
                self._cache[cache_key] = _CacheEntry(
                    expires_at=time.time() + self.CACHE_TTL_SECONDS,
                    payload=copy.deepcopy(payload),
                )
        except BaseException as exc:
            with self._lock:
                entry = self._in_flight.get(cache_key)
                if entry:
                    entry.error = exc
                    entry.event.set()
                    del self._in_flight[cache_key]
            raise

        with self._lock:
            entry = self._in_flight.get(cache_key)
            if entry:
                entry.payload = copy.deepcopy(payload)
                entry.event.set()
                del self._in_flight[cache_key]

        latency_ms = int((time.perf_counter() - started) * 1000)
        payload.setdefault("meta", {})
        payload["meta"].update({"cache_hit": False, "latency_ms": latency_ms})
        logger.info(
            "Ingress period summary computed user={} period={}..{} dir={} rows={} latency_ms={}",
            user_id,
            start_date,
            end_date,
            direction_type,
            len(payload.get("rows", [])),
            latency_ms,
        )
        return payload

    @classmethod
    def _normalize_period(cls, start_date: date, end_date: date) -> Tuple[date, date]:
        return (start_date, end_date) if start_date <= end_date else (end_date, start_date)

    @staticmethod
    def _normalize_direction_type(direction_type: str) -> str:
        value = str(direction_type or DEFAULT_DIRECTION_TYPE).strip()
        value = DIRECTION_TYPE_ALIASES.get(value, value)
        return value if value in {"solar_arc", "zodiacal", "equatorial"} else DEFAULT_DIRECTION_TYPE

    @classmethod
    def _build_cache_key(
        cls,
        user_id: UUID,
        natal_hash: str,
        start_date: date,
        end_date: date,
        timezone: str,
        direction_type: str,
    ) -> str:
        raw = {
            "user_id": str(user_id),
            "natal_hash": natal_hash,
            "direction_type": direction_type,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "timezone": timezone,
            "calc_version": cls.CALC_VERSION,
        }
        return hashlib.sha256(json.dumps(raw, sort_keys=True).encode("utf-8")).hexdigest()

    @classmethod
    def _try_get_cache(cls, cache_key: str) -> Optional[Dict]:
        with cls._lock:
            entry = cls._cache.get(cache_key)
            if not entry:
                return None
            if entry.expires_at <= time.time():
                del cls._cache[cache_key]
                return None
            return copy.deepcopy(entry.payload)

    def _load_natal_context(self, user_id: UUID) -> _NatalContext:
        session = db_manager.get_new_session()
        try:
            user = session.query(User).filter(User.user_id == user_id).first()
            if not user:
                raise ValueError(f"User not found: {user_id}")

            planets = session.query(NatalPlanet).filter(NatalPlanet.user_id == user_id).all()
            houses = (
                session.query(NatalHouse)
                .filter(NatalHouse.user_id == user_id)
                .order_by(NatalHouse.house_number)
                .all()
            )
            special_points = (
                session.query(NatalSpecialPoint)
                .filter(NatalSpecialPoint.user_id == user_id)
                .all()
            )

            natal_planets = {p.planet: float(p.degree) for p in planets}
            natal_special_points = {sp.point: float(sp.degree) for sp in special_points}
            natal_houses = [
                {"number": h.house_number, "longitude": float(h.cusp_degree)}
                for h in houses
            ]

            if len(natal_houses) < 12:
                raise ValueError(f"Incomplete natal houses for user: {user_id}")

            natal_hash_payload = {
                "birth_jd": float(user.julian_day),
                "birth_date": user.birth_date.isoformat(),
                "lat": float(user.lat),
                "lon": float(user.lon),
                "planets": sorted((k, v) for k, v in natal_planets.items()),
                "special_points": sorted((k, v) for k, v in natal_special_points.items()),
                "houses": [(h["number"], h["longitude"]) for h in natal_houses],
            }
            natal_hash = hashlib.sha256(
                json.dumps(natal_hash_payload, sort_keys=True).encode("utf-8")
            ).hexdigest()

            return _NatalContext(
                user_id=user_id,
                birth_jd=float(user.julian_day),
                birth_date=user.birth_date,
                lat=float(user.lat),
                lon=float(user.lon),
                natal_planets=natal_planets,
                natal_special_points=natal_special_points,
                natal_houses=natal_houses,
                natal_hash=natal_hash,
            )
        finally:
            session.close()

    def _calculate_uncached(
        self,
        natal: _NatalContext,
        start_date: date,
        end_date: date,
        timezone: str,
        direction_type: str,
    ) -> Dict:
        dates = list(self._iter_dates(start_date, end_date))
        progression_snaps = [self._build_progression_snapshot(natal, d) for d in dates]
        direction_snaps = [self._build_direction_snapshot(natal, d, direction_type) for d in dates]

        progression_rows = self._build_period_rows(
            snapshots=progression_snaps,
            method="progressions",
            timezone=timezone,
        )
        direction_rows = self._build_period_rows(
            snapshots=direction_snaps,
            method="directions",
            timezone=timezone,
        )

        rows = progression_rows + direction_rows
        rows.sort(key=lambda row: (self._object_sort_priority(row.get("object_key")), self._method_sort_priority(row.get("method"))))

        return {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "direction_type": direction_type,
            "rows": rows,
            "meta": {
                "calc_version": self.CALC_VERSION,
                "sample_points": len(dates),
            },
        }

    @staticmethod
    def _iter_dates(start_date: date, end_date: date):
        current = start_date
        while current <= end_date:
            yield current
            current += timedelta(days=1)

    def _build_progression_snapshot(self, natal: _NatalContext, target_date: date) -> Dict:
        progressed_jd = natal.birth_jd + ((target_date - natal.birth_date).days / TROPICAL_YEAR_DAYS)
        planets = self._engine.calculate_planets(progressed_jd)
        north, south = SpecialPointsService.calculate_true_nodes(progressed_jd)
        lilith = SpecialPointsService.calculate_black_moon(progressed_jd)
        progressed_houses, _ = self._engine.calculate_houses(
            jd=progressed_jd,
            lat=natal.lat,
            lon=natal.lon,
            hsys="P",
        )

        objects: Dict[str, Dict] = {}
        for p in planets:
            name = p.get("name")
            if not name:
                continue
            lon = float(p.get("longitude")) % 360
            objects[name] = {
                "longitude": lon,
                "sign": get_zodiac_sign(lon),
                "sign_index": int(lon // 30),
                # По требованиям: для прогрессий движение анализируем по натальным домам.
                "house": self._engine.get_planet_house(lon, natal.natal_houses),
            }

        for name, lon in (("TrueNorthNode", north), ("TrueSouthNode", south), ("BlackMoon", lilith)):
            nlon = float(lon) % 360
            objects[name] = {
                "longitude": nlon,
                "sign": get_zodiac_sign(nlon),
                "sign_index": int(nlon // 30),
                "house": self._engine.get_planet_house(nlon, natal.natal_houses),
            }

        houses = {
            int(h["number"]): {
                "longitude": float(h["longitude"]) % 360,
                "sign": h.get("sign") or get_zodiac_sign(float(h["longitude"])),
                "sign_index": int((float(h["longitude"]) % 360) // 30),
            }
            for h in progressed_houses
        }

        return {
            "date": target_date.isoformat(),
            "date_ms": self._date_to_ms(target_date),
            "objects": objects,
            "houses": houses,
        }

    def _build_direction_snapshot(self, natal: _NatalContext, target_date: date, direction_type: str) -> Dict:
        age_years = (target_date - natal.birth_date).days / TROPICAL_YEAR_DAYS
        arc = self._calculate_direction_arc(direction_type, natal.birth_jd, age_years)

        directed_houses = []
        for h in natal.natal_houses:
            lon = (float(h["longitude"]) + arc) % 360
            directed_houses.append({
                "number": int(h["number"]),
                "longitude": lon,
                "sign": get_zodiac_sign(lon),
            })

        objects: Dict[str, Dict] = {}
        for name, natal_lon in natal.natal_planets.items():
            lon = (float(natal_lon) + arc) % 360
            objects[name] = {
                "longitude": lon,
                "sign": get_zodiac_sign(lon),
                "sign_index": int(lon // 30),
                # По требованиям: для дирекций движение анализируем по дирекционным домам.
                "house": self._engine.get_planet_house(lon, directed_houses),
            }

        for name, natal_lon in natal.natal_special_points.items():
            lon = (float(natal_lon) + arc) % 360
            objects[name] = {
                "longitude": lon,
                "sign": get_zodiac_sign(lon),
                "sign_index": int(lon // 30),
                "house": self._engine.get_planet_house(lon, directed_houses),
            }

        houses = {
            int(h["number"]): {
                "longitude": float(h["longitude"]) % 360,
                "sign": h.get("sign") or get_zodiac_sign(float(h["longitude"])),
                "sign_index": int((float(h["longitude"]) % 360) // 30),
            }
            for h in directed_houses
        }

        return {
            "date": target_date.isoformat(),
            "date_ms": self._date_to_ms(target_date),
            "objects": objects,
            "houses": houses,
        }

    @staticmethod
    def _date_to_ms(value: date) -> int:
        dt = datetime.combine(value, dt_time(12, 0, 0))
        return int(dt.timestamp() * 1000)

    @staticmethod
    def _calculate_direction_arc(direction_type: str, birth_jd: float, age_years: float) -> float:
        if direction_type == "solar_arc":
            natal_sun_data, _ = swe.calc_ut(birth_jd, swe.SUN, swe.FLG_SWIEPH)
            progressed_jd = birth_jd + age_years
            prog_sun_data, _ = swe.calc_ut(progressed_jd, swe.SUN, swe.FLG_SWIEPH)
            arc = prog_sun_data[0] - natal_sun_data[0]
            return arc + 360 if arc < 0 else arc
        if direction_type in {"zodiacal", "symbolic"}:
            return age_years
        if direction_type == "equatorial":
            return (age_years * NAIBOD_KEY) % 360
        return 0.0

    def _build_period_rows(self, snapshots: List[Dict], method: str, timezone: str) -> List[Dict]:
        if not snapshots:
            return []

        first = snapshots[0]
        last = snapshots[-1]
        object_keys = self._ordered_object_keys(first, last)

        rows: List[Dict] = []
        for key in object_keys:
            row = self._build_object_row(key, snapshots, method, timezone)
            if row:
                rows.append(row)

        for house_number in range(1, 13):
            row = self._build_cusp_row(house_number, snapshots, method, timezone)
            if row:
                rows.append(row)

        return rows

    def _ordered_object_keys(self, first: Dict, last: Dict) -> List[str]:
        first_keys = set(first.get("objects", {}).keys())
        last_keys = set(last.get("objects", {}).keys())
        available = first_keys | last_keys

        ordered: List[str] = []
        for key in PLANET_SUMMARY_ORDER:
            if key in available:
                ordered.append(key)
        for key in SPECIAL_POINTS_ORDER:
            if key in available and key not in ordered:
                ordered.append(key)

        rest = sorted(k for k in available if k not in ordered)
        ordered.extend(rest)
        return ordered

    def _build_object_row(self, object_key: str, snapshots: List[Dict], method: str, timezone: str) -> Optional[Dict]:
        first_obj = snapshots[0].get("objects", {}).get(object_key)
        last_obj = snapshots[-1].get("objects", {}).get(object_key)
        if not first_obj or not last_obj:
            return None

        details: List[Dict] = []
        for i in range(1, len(snapshots)):
            prev_snap = snapshots[i - 1]
            next_snap = snapshots[i]
            prev_obj = prev_snap.get("objects", {}).get(object_key)
            next_obj = next_snap.get("objects", {}).get(object_key)
            if not prev_obj or not next_obj:
                continue

            if prev_obj.get("sign_index") != next_obj.get("sign_index"):
                boundary = int(next_obj.get("sign_index", 0)) * 30
                times = self._compute_sign_transition_times(
                    float(prev_obj.get("longitude")),
                    float(next_obj.get("longitude")),
                    float(boundary),
                    float(prev_snap.get("date_ms")),
                    float(next_snap.get("date_ms")),
                )
                if not times:
                    times = {
                        "before": float(prev_snap.get("date_ms")),
                        "exact": float(next_snap.get("date_ms")),
                        "after": float(next_snap.get("date_ms")),
                    }
                details.append(self._build_hover_item(
                    ingress_type="sign",
                    from_value=prev_obj.get("sign"),
                    to_value=next_obj.get("sign"),
                    times=times,
                    timezone=timezone,
                ))

            prev_house = prev_obj.get("house")
            next_house = next_obj.get("house")
            if prev_house is None or next_house is None or prev_house == next_house:
                continue

            prev_cusp = prev_snap.get("houses", {}).get(int(next_house))
            next_cusp = next_snap.get("houses", {}).get(int(next_house))
            times = self._compute_house_transition_times(
                float(prev_obj.get("longitude")),
                float(next_obj.get("longitude")),
                float(prev_cusp.get("longitude")) if prev_cusp else float("nan"),
                float(next_cusp.get("longitude")) if next_cusp else float("nan"),
                float(prev_snap.get("date_ms")),
                float(next_snap.get("date_ms")),
            )
            if not times:
                times = {
                    "before": float(prev_snap.get("date_ms")),
                    "exact": float(next_snap.get("date_ms")),
                    "after": float(next_snap.get("date_ms")),
                }
            details.append(self._build_hover_item(
                ingress_type="house",
                from_value=int(prev_house),
                to_value=int(next_house),
                times=times,
                timezone=timezone,
            ))

        details.sort(key=lambda item: item.get("sort_ts") or 0)
        if not details:
            return None
        hover_lines = [d["text"] for d in details]

        transition = (
            f"{first_obj.get('sign') or '—'} / H{first_obj.get('house') or '—'}"
            f" -> {last_obj.get('sign') or '—'} / H{last_obj.get('house') or '—'}"
        )

        return {
            "object_key": object_key,
            "object": object_key,
            "method": method,
            "method_class": "progression" if method == "progressions" else "direction",
            "transition": transition,
            "hover_lines": hover_lines,
            "hover_details": [self._strip_sort_key(d) for d in details],
        }

    def _build_cusp_row(self, house_number: int, snapshots: List[Dict], method: str, timezone: str) -> Optional[Dict]:
        first_cusp = snapshots[0].get("houses", {}).get(house_number)
        last_cusp = snapshots[-1].get("houses", {}).get(house_number)
        if not first_cusp or not last_cusp:
            return None

        details: List[Dict] = []
        for i in range(1, len(snapshots)):
            prev_snap = snapshots[i - 1]
            next_snap = snapshots[i]
            prev = prev_snap.get("houses", {}).get(house_number)
            nxt = next_snap.get("houses", {}).get(house_number)
            if not prev or not nxt:
                continue
            if prev.get("sign_index") == nxt.get("sign_index"):
                continue

            boundary = int(nxt.get("sign_index", 0)) * 30
            times = self._compute_sign_transition_times(
                float(prev.get("longitude")),
                float(nxt.get("longitude")),
                float(boundary),
                float(prev_snap.get("date_ms")),
                float(next_snap.get("date_ms")),
            )
            if not times:
                times = {
                    "before": float(prev_snap.get("date_ms")),
                    "exact": float(next_snap.get("date_ms")),
                    "after": float(next_snap.get("date_ms")),
                }
            details.append(self._build_hover_item(
                ingress_type="sign",
                from_value=prev.get("sign"),
                to_value=nxt.get("sign"),
                times=times,
                timezone=timezone,
            ))

        details.sort(key=lambda item: item.get("sort_ts") or 0)
        if not details:
            return None
        hover_lines = [d["text"] for d in details]

        return {
            "object_key": f"Cusp{house_number}",
            "object": f"Cusp {house_number}",
            "method": method,
            "method_class": "progression" if method == "progressions" else "direction",
            "transition": f"{first_cusp.get('sign') or '—'} -> {last_cusp.get('sign') or '—'}",
            "hover_lines": hover_lines,
            "hover_details": [self._strip_sort_key(d) for d in details],
        }

    @staticmethod
    def _strip_sort_key(item: Dict) -> Dict:
        out = dict(item)
        out.pop("sort_ts", None)
        return out

    @staticmethod
    def _normalize_deg(value: float) -> float:
        out = value % 360.0
        return out + 360.0 if out < 0 else out

    @classmethod
    def _unwrap_near(cls, value: float, reference: float) -> float:
        out = value
        while out - reference > 180:
            out -= 360
        while out - reference < -180:
            out += 360
        return out

    @classmethod
    def _shortest_angular_diff(cls, a: float, b: float) -> float:
        diff = cls._normalize_deg(a) - cls._normalize_deg(b)
        while diff > 180:
            diff -= 360
        while diff < -180:
            diff += 360
        return diff

    @staticmethod
    def _interpolate_by_target(start_ms: float, end_ms: float, v1: float, v2: float, target: float) -> float:
        if v1 == v2:
            return float("nan")
        frac = (target - v1) / (v2 - v1)
        return start_ms + frac * (end_ms - start_ms)

    @classmethod
    def _compute_sign_transition_times(
        cls,
        prev_lon: float,
        next_lon: float,
        boundary_deg: float,
        prev_ms: float,
        next_ms: float,
    ) -> Optional[Dict[str, float]]:
        p1 = prev_lon
        p2 = cls._unwrap_near(next_lon, prev_lon)
        boundary = cls._unwrap_near(boundary_deg, prev_lon)
        if (boundary - p1) * (boundary - p2) > 0:
            return None

        exact = cls._interpolate_by_target(prev_ms, next_ms, p1, p2, boundary)
        slope = p2 - p1
        direction = 1 if slope == 0 else (1 if slope > 0 else -1)
        before = cls._interpolate_by_target(prev_ms, next_ms, p1, p2, boundary - direction)
        after = cls._interpolate_by_target(prev_ms, next_ms, p1, p2, boundary + direction)
        return {"before": before, "exact": exact, "after": after}

    @classmethod
    def _compute_house_transition_times(
        cls,
        prev_planet_lon: float,
        next_planet_lon: float,
        prev_cusp_lon: float,
        next_cusp_lon: float,
        prev_ms: float,
        next_ms: float,
    ) -> Optional[Dict[str, float]]:
        values = [prev_planet_lon, next_planet_lon, prev_cusp_lon, next_cusp_lon, prev_ms, next_ms]
        if not all(isinstance(v, (int, float)) and v == v for v in values):
            return None

        f1 = cls._shortest_angular_diff(prev_planet_lon, prev_cusp_lon)
        f2 = cls._shortest_angular_diff(next_planet_lon, next_cusp_lon)
        if f1 == f2:
            return None
        if f1 == 0 and f2 == 0:
            return None
        if f1 != 0 and f2 != 0 and ((f1 > 0) == (f2 > 0)):
            return None

        exact = cls._interpolate_by_target(prev_ms, next_ms, f1, f2, 0)
        slope = f2 - f1
        direction = 1 if slope == 0 else (1 if slope > 0 else -1)
        before = cls._interpolate_by_target(prev_ms, next_ms, f1, f2, -direction)
        after = cls._interpolate_by_target(prev_ms, next_ms, f1, f2, direction)
        return {"before": before, "exact": exact, "after": after}

    def _build_hover_item(
        self,
        ingress_type: str,
        from_value,
        to_value,
        times: Optional[Dict[str, float]],
        timezone: str,
    ) -> Dict:
        before = self._ms_to_iso(times.get("before") if times else None, timezone)
        exact = self._ms_to_iso(times.get("exact") if times else None, timezone)
        after = self._ms_to_iso(times.get("after") if times else None, timezone)

        if ingress_type == "house":
            text = f"House: H{from_value} -> H{to_value} | -1° {before} | 0° {exact} | +1° {after}"
        else:
            text = f"Sign: {from_value} -> {to_value} | -1° {before} | 0° {exact} | +1° {after}"

        sort_ts = None
        if times and isinstance(times.get("exact"), (int, float)) and times.get("exact") == times.get("exact"):
            sort_ts = int(times["exact"])

        return {
            "ingress_type": ingress_type,
            "from": from_value,
            "to": to_value,
            "times": {
                "before": before,
                "exact": exact,
                "after": after,
            },
            "text": text,
            "sort_ts": sort_ts,
        }

    @staticmethod
    def _ms_to_iso(value: Optional[float], timezone: str) -> str:
        if value is None or not isinstance(value, (int, float)) or value != value:
            return "—"

        try:
            import pytz

            tz = pytz.timezone(timezone)
            utc_dt = datetime.utcfromtimestamp(value / 1000.0).replace(tzinfo=pytz.UTC)
            local_dt = utc_dt.astimezone(tz)
            return local_dt.date().isoformat()
        except Exception:
            return datetime.utcfromtimestamp(value / 1000.0).date().isoformat()

    @staticmethod
    def _method_sort_priority(method: Optional[str]) -> int:
        if method == "progressions":
            return 0
        if method == "directions":
            return 1
        return 9

    @staticmethod
    def _object_sort_priority(object_key: Optional[str]) -> int:
        if not object_key:
            return 9999
        if object_key.startswith("Cusp"):
            try:
                return 2000 + int(object_key.replace("Cusp", ""))
            except Exception:
                return 2099

        if object_key in PLANET_SUMMARY_ORDER:
            return PLANET_SUMMARY_ORDER.index(object_key)
        if object_key in SPECIAL_POINTS_ORDER:
            return 1000 + SPECIAL_POINTS_ORDER.index(object_key)
        return 1500
