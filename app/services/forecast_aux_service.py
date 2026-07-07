"""Aggregate service for lightweight forecast workspace auxiliary blocks."""
from __future__ import annotations

from copy import deepcopy
from datetime import date
from hashlib import sha256
from json import dumps
from threading import RLock
from time import monotonic
from typing import Any, Dict, Iterable, Optional

from sqlalchemy.orm import Session

from app.database.models import User
from app.services.antiscia_service import AntisciaService, DEFAULT_ANTISCIA_ORB
from app.services.dominants_service import DominantsService
from app.services.fixed_stars_service import FixedStarsService, DEFAULT_STAR_ORB
from app.services.natal_context_read_service import NatalContextReadService
from app.services.profections_service import ProfectionsService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.utils.ephemeris import get_ephemeris_path


ALLOWED_AUX_BLOCKS = frozenset({"profections", "antiscia", "asteroids", "dominants", "fixed_stars"})
RESULT_TTL_SECONDS = 10 * 60
RESULT_MAX_ENTRIES = 512


class ForecastAuxBlockError(ValueError):
    """Block-level error that should not fail the aggregate request."""


class ForecastAuxService:
    _result_cache: Dict[str, tuple[Dict[str, Any], float]] = {}
    _lock = RLock()

    def __init__(self, db: Session, ephe_path: Optional[str] = None):
        self.db = db
        self.ephe_path = ephe_path or get_ephemeris_path()
        self.context_reader = NatalContextReadService(db)
        self.engine = SwissEphemerisEngine(self.ephe_path)
        self.stars_service = FixedStarsService(ephe_path=self.ephe_path)

    @classmethod
    def clear_result_cache(cls) -> None:
        with cls._lock:
            cls._result_cache.clear()

    def get_saved_block(
        self,
        user: User,
        block: str,
        *,
        target_date: Optional[date] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        result = self.get_saved_blocks(user, [block], target_date=target_date, options=options)
        if block in result["errors"]:
            raise ForecastAuxBlockError(result["errors"][block])
        return result["blocks"][block]

    def get_saved_blocks(
        self,
        user: User,
        blocks: Iterable[str],
        *,
        target_date: Optional[date] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        chart = self.context_reader.get_aux_chart_for_user(user)
        source_fingerprint = self.context_reader.fingerprint(chart)
        return self.get_blocks_for_chart(
            chart,
            blocks,
            target_date=target_date,
            options=options,
            source_fingerprint=source_fingerprint,
            cacheable=True,
        )

    def get_blocks_for_chart(
        self,
        chart: Dict[str, Any],
        blocks: Iterable[str],
        *,
        target_date: Optional[date] = None,
        options: Optional[Dict[str, Any]] = None,
        source_fingerprint: Optional[str] = None,
        cacheable: bool = False,
    ) -> Dict[str, Any]:
        normalized_blocks = self._normalize_blocks(blocks)
        options = options or {}
        if source_fingerprint is None:
            source_fingerprint = self._fingerprint_chart(chart)
        cache_key = self._result_cache_key(source_fingerprint, normalized_blocks, target_date, options)

        if cacheable:
            cached = self._get_cached_result(cache_key)
            if cached is not None:
                return cached

        payload = {
            "source_fingerprint": source_fingerprint,
            "blocks": {},
            "errors": {},
        }
        for block in normalized_blocks:
            try:
                payload["blocks"][block] = self._compute_block(chart, block, target_date=target_date, options=options)
            except Exception as exc:
                payload["errors"][block] = str(exc)

        if cacheable:
            self._set_cached_result(cache_key, payload)
        return deepcopy(payload)

    def _normalize_blocks(self, blocks: Iterable[str]) -> list[str]:
        ordered: list[str] = []
        for block in blocks:
            value = str(block or "").strip()
            if value == "fixstars":
                value = "fixed_stars"
            if value not in ALLOWED_AUX_BLOCKS:
                raise ForecastAuxBlockError(f"Unsupported aux block: {value}")
            if value not in ordered:
                ordered.append(value)
        if not ordered:
            ordered = ["profections", "antiscia", "asteroids", "dominants", "fixed_stars"]
        return ordered

    def _compute_block(
        self,
        chart: Dict[str, Any],
        block: str,
        *,
        target_date: Optional[date],
        options: Dict[str, Any],
    ) -> Dict[str, Any]:
        if block == "profections":
            return self._compute_profections(chart, target_date=target_date)
        if block == "antiscia":
            return self._compute_antiscia(chart, orb=float(options.get("antiscia_orb") or DEFAULT_ANTISCIA_ORB))
        if block == "asteroids":
            return self._compute_asteroids(chart)
        if block == "dominants":
            return DominantsService.compute(chart, top_n=int(options.get("dominants_top_n") or 5))
        if block == "fixed_stars":
            return self._compute_fixed_stars(
                chart,
                orb=float(options.get("fixed_star_orb") or DEFAULT_STAR_ORB),
                filter_mode=str(options.get("fixed_star_filter") or "highlighted"),
                max_magnitude=self._optional_float(options.get("fixed_star_max_magnitude")),
            )
        raise ForecastAuxBlockError(f"Unsupported aux block: {block}")

    def _optional_float(self, value: Any) -> Optional[float]:
        if value is None or value == "":
            return None
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return None
        return numeric if numeric == numeric else None

    def _compute_profections(self, chart: Dict[str, Any], *, target_date: Optional[date]) -> Dict[str, Any]:
        asc = (chart.get("angles") or {}).get("ASC") or {}
        asc_sign = asc.get("sign")
        birth_iso = (chart.get("birth_data") or {}).get("date")
        if not asc_sign or not birth_iso:
            raise ForecastAuxBlockError("Chart lacks ascendant sign or birth date")
        return ProfectionsService.profections(
            ascendant_sign=asc_sign,
            birth_date=date.fromisoformat(str(birth_iso)[:10]),
            target_date=target_date,
        )

    def _compute_antiscia(self, chart: Dict[str, Any], *, orb: float) -> Dict[str, Any]:
        objects = self._collect_objects(chart, include_special_points=True, angle_names=("ASC", "MC"))
        return {
            "orb": orb,
            "points": AntisciaService.compute_for_objects(objects),
            "contacts": AntisciaService.find_contacts(objects, orb=orb),
        }

    def _compute_asteroids(self, chart: Dict[str, Any]) -> Dict[str, Any]:
        birth = chart.get("birth_data") or {}
        jd = birth.get("julian_day")
        if jd is None:
            raise ForecastAuxBlockError("Chart lacks julian_day")
        zodiac = birth.get("zodiac") or "tropical"
        ayanamsha = birth.get("ayanamsha") or "lahiri"
        asteroids = self.engine.calculate_asteroids(float(jd), zodiac=zodiac, ayanamsha=ayanamsha)
        houses = chart.get("houses") or []
        if houses:
            for asteroid in asteroids:
                asteroid["house"] = self.engine.get_planet_house(asteroid["longitude"], houses)
        return {"zodiac": zodiac, "asteroids": asteroids}

    def _compute_fixed_stars(
        self,
        chart: Dict[str, Any],
        *,
        orb: float,
        filter_mode: str,
        max_magnitude: Optional[float],
    ) -> Dict[str, Any]:
        jd = (chart.get("birth_data") or {}).get("julian_day")
        if jd is None:
            raise ForecastAuxBlockError("Chart lacks julian_day")
        objects = self._collect_objects(chart, include_special_points=False, angle_names=("ASC", "MC", "DSC", "IC"))
        stars = self.stars_service.star_positions(
            float(jd),
            filter_mode=filter_mode,
            max_magnitude=max_magnitude,
        )
        return {
            "orb": orb,
            "filter": filter_mode,
            "max_magnitude": max_magnitude,
            "stars": stars,
            "conjunctions": self.stars_service.conjunctions(float(jd), objects, orb=orb, stars=stars),
        }

    def _collect_objects(
        self,
        chart: Dict[str, Any],
        *,
        include_special_points: bool,
        angle_names: tuple[str, ...],
    ) -> list[Dict[str, Any]]:
        objects: list[Dict[str, Any]] = []
        for planet in chart.get("planets") or []:
            if planet.get("longitude") is not None:
                objects.append({"name": planet["name"], "longitude": float(planet["longitude"])})
        if include_special_points:
            for point in (chart.get("special_points") or {}).values():
                if point and point.get("longitude") is not None:
                    objects.append({"name": point["name"], "longitude": float(point["longitude"])})
        for key in angle_names:
            angle = (chart.get("angles") or {}).get(key)
            if angle and angle.get("longitude") is not None:
                objects.append({"name": key, "longitude": float(angle["longitude"])})
        return objects

    def _fingerprint_chart(self, chart: Dict[str, Any]) -> str:
        raw = dumps(chart, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str)
        return sha256(raw.encode("utf-8")).hexdigest()

    def _result_cache_key(
        self,
        source_fingerprint: str,
        blocks: list[str],
        target_date: Optional[date],
        options: Dict[str, Any],
    ) -> str:
        raw = dumps(
            {
                "source": source_fingerprint,
                "blocks": blocks,
                "target_date": target_date.isoformat() if target_date else None,
                "options": options,
            },
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
            default=str,
        )
        return sha256(raw.encode("utf-8")).hexdigest()

    def _get_cached_result(self, key: str) -> Optional[Dict[str, Any]]:
        now = monotonic()
        with self._lock:
            cached = self._result_cache.get(key)
            if cached and cached[1] > now:
                return deepcopy(cached[0])
            if cached:
                self._result_cache.pop(key, None)
        return None

    def _set_cached_result(self, key: str, value: Dict[str, Any]) -> None:
        now = monotonic()
        with self._lock:
            if len(self._result_cache) >= RESULT_MAX_ENTRIES:
                oldest_key = min(self._result_cache.items(), key=lambda item: item[1][1])[0]
                self._result_cache.pop(oldest_key, None)
            self._result_cache[key] = (deepcopy(value), now + RESULT_TTL_SECONDS)
