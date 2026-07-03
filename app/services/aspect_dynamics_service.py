from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
import pytz
import swisseph as swe

from app.models.schemas import BirthDataInput
from app.services.aspect_service import AspectService
from app.services.direction_service import (
    DEFAULT_DIRECTION_TYPE,
    TROPICAL_YEAR_DAYS,
    DirectionService,
)
from app.services.natal_chart_service import NatalChartService
from app.services.natal_context import NatalContext
from app.services.preferences_runtime import PreferencesRuntimeResolver
from app.services.reference_data_cache import get_aspect_types
from app.services.solar_return_service import SolarReturnService
from app.services.special_points_service import SpecialPointsService
from app.services.swisseph_engine import SwissEphemerisEngine
from app.services.time_service import TimeService
from app.utils.constants import PROGNOSTIC_DEFAULT_ORB, normalize_longitude


@dataclass
class AspectDynamicsWindow:
    jd_start: float
    jd_end: float
    requested: Dict[str, Any]


class AspectDynamicsService:
    """Graph-ready signed-orb dynamics for forecast-new layers.

    The service intentionally calculates only bodies needed for the graph
    and never writes results to the database. Short-lived memory cache handles
    repeated opens, zooms and pans without adding Supabase load.
    """

    CALC_VERSION = "aspect_dynamics_v2"
    DEFAULT_POINTS = 360
    MAX_POINTS = 720
    MAX_SCAN_SAMPLES = 1600
    CACHE_TTL_SECONDS = 10 * 60
    CACHE_MAX_ITEMS = 256
    _CACHE: "OrderedDict[str, Tuple[datetime, Dict]]" = OrderedDict()

    METHOD_DEFAULT_SPAN_DAYS = {
        "natal": 365.0,
        "transit": 730.0,
        "progression": 3650.0,
        "direction": 3650.0,
        "synastry_partner": 365.0,
    }

    FAST_BODIES = {
        "Moon",
        "Sun",
        "Mercury",
        "Venus",
        "Mars",
        "ASC",
        "MC",
        "IC",
        "DSC",
        "Vertex",
    }
    SPECIAL_ALIASES = {
        "TrueNode": "TrueNorthNode",
        "NorthNode": "TrueNorthNode",
        "Rahu": "TrueNorthNode",
        "SouthNode": "TrueSouthNode",
        "Ketu": "TrueSouthNode",
        "PartOfFortune": "Fortune",
    }

    def __init__(self, db_session: Session, ephe_path: Optional[str] = None):
        self.db = db_session
        self.ephe_path = ephe_path
        self.swisseph_engine = SwissEphemerisEngine(ephe_path)
        self.preferences_runtime = PreferencesRuntimeResolver(db_session)
        self.aspect_service = AspectService(db_session)
        self._direction_service = DirectionService(
            db_session, ephe_path=ephe_path
        )
        self._solar_service = SolarReturnService(
            db_session, ephe_path=ephe_path
        )
        self._natal_chart_service = NatalChartService(ephe_path=ephe_path)
        self._aspect_types = None
        self._position_cache: Dict[Tuple, Optional[float]] = {}

    @classmethod
    def _cache_get(cls, key: Optional[str]) -> Optional[Dict]:
        if not key:
            return None
        now = datetime.utcnow()
        item = cls._CACHE.get(key)
        if not item:
            return None
        expires_at, payload = item
        if expires_at < now:
            cls._CACHE.pop(key, None)
            return None
        cls._CACHE.move_to_end(key)
        cached = deepcopy(payload)
        cached["cache_hit"] = True
        return cached

    @classmethod
    def _cache_set(cls, key: Optional[str], payload: Dict) -> None:
        if not key:
            return
        cls._CACHE[key] = (
            datetime.utcnow() + timedelta(seconds=cls.CACHE_TTL_SECONDS),
            deepcopy(payload),
        )
        cls._CACHE.move_to_end(key)
        while len(cls._CACHE) > cls.CACHE_MAX_ITEMS:
            cls._CACHE.popitem(last=False)

    @staticmethod
    def request_cache_key(
        payload: Dict[str, Any], *, astrologer_id: Optional[UUID]
    ) -> str:
        raw = json.dumps(
            {"astrologer_id": str(astrologer_id or ""), "payload": payload},
            sort_keys=True,
            default=str,
            ensure_ascii=True,
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def context_from_user_id(
        self, user_id: UUID, *, apply_exclusions: bool = False
    ) -> NatalContext:
        chart = self._natal_chart_service.get_natal_chart_from_db(
            user_id, self.db
        )
        if chart is None:
            raise ValueError(f"Natal chart not found for user_id={user_id}")
        astrologer_id = self.preferences_runtime.get_astrologer_id_for_user(
            user_id
        )
        context = NatalContext.from_inline(
            chart,
            astrologer_id=astrologer_id,
            apply_exclusions=apply_exclusions,
        )
        context.user_id = user_id
        return context

    def context_from_birth_data(
        self,
        natal: BirthDataInput,
        *,
        astrologer_id: Optional[UUID],
        apply_exclusions: bool = False,
    ) -> NatalContext:
        chart = self._natal_chart_service.calculate_natal_chart(
            birth_date=natal.date,
            birth_time=natal.time,
            timezone=natal.timezone,
            astrologer_id=astrologer_id,
            place=natal.place,
            latitude=natal.latitude,
            longitude=natal.longitude,
            house_system=natal.house_system,
            save_to_db=False,
            db_session=self.db,
        )
        return NatalContext.from_inline(
            chart,
            astrologer_id=astrologer_id,
            apply_exclusions=apply_exclusions,
        )

    def calculate(
        self,
        *,
        method: str,
        primary_context: NatalContext,
        source_body: str,
        target_body: str,
        aspect_type: str,
        selected_date: date,
        selected_time: time,
        timezone: str,
        contact_start: Optional[date] = None,
        contact_end: Optional[date] = None,
        max_points: int = DEFAULT_POINTS,
        direction_type: str = DEFAULT_DIRECTION_TYPE,
        partner_context: Optional[NatalContext] = None,
        solar_year: Optional[int] = None,
        solar_location: Optional[Dict[str, Any]] = None,
        cache_key: Optional[str] = None,
    ) -> Dict:
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        method = self._normalize_method(method)
        source_body = self._normalize_body_name(source_body)
        target_body = self._normalize_body_name(target_body)
        aspect_type_obj = self._aspect_type(aspect_type)
        base = {
            "method": method,
            "transit_body": source_body,
            "natal_body": target_body,
            "source_body": source_body,
            "target_body": target_body,
            "aspect_type": aspect_type,
            "timezone": timezone,
            "calc_version": self.CALC_VERSION,
            "cache_hit": False,
        }
        if aspect_type_obj is None:
            return {
                **base,
                "status": "unknown_aspect_type",
                "contacts": [],
                "series": [],
            }

        target_context = primary_context
        source_context = (
            partner_context
            if method == "synastry_partner"
            else primary_context
        )
        if method == "synastry_partner" and source_context is None:
            return {
                **base,
                "status": "missing_partner",
                "contacts": [],
                "series": [],
            }

        _, selected_jd = TimeService.process_birth_time(
            selected_date, selected_time, timezone
        )
        exact_angle = float(aspect_type_obj.exact_angle)
        orb_profile = (
            "synastry"
            if method == "synastry_partner"
            else ("natal" if method == "natal" else "prognostic")
        )
        max_orb = self._allowed_orb(
            primary_context.astrologer_id,
            source_body,
            target_body,
            aspect_type,
            orb_profile=orb_profile,
        )

        if method == "solar_return":
            result = self._calculate_solar_dynamics(
                base=base,
                primary_context=primary_context,
                source_body=source_body,
                target_body=target_body,
                exact_angle=exact_angle,
                max_orb=max_orb,
                selected_date=selected_date,
                selected_time=selected_time,
                timezone=timezone,
                contact_start=contact_start,
                contact_end=contact_end,
                max_points=max_points,
                solar_year=solar_year,
                solar_location=solar_location,
            )
            self._cache_set(cache_key, result)
            return result

        provider = lambda jd: self._longitudes_for_method(  # noqa: E731
            method,
            jd,
            source_context=source_context,
            target_context=target_context,
            source_body=source_body,
            target_body=target_body,
            direction_type=direction_type,
        )
        selected_longs = provider(selected_jd)
        if selected_longs is None:
            result = {
                **base,
                "status": "unsupported_body",
                "contacts": [],
                "series": [],
            }
            self._cache_set(cache_key, result)
            return result

        target_angle = self._select_target_for_longitudes(
            selected_longs, exact_angle
        )
        selected_point = self._format_point(
            selected_jd,
            timezone,
            provider,
            exact_angle,
            max_orb,
            target_angle,
        )
        window = self._resolve_window(
            method,
            source_body,
            selected_jd,
            selected_date,
            timezone,
            contact_start,
            contact_end,
        )
        step_jd = self._scan_step_days(
            method, source_body, window.jd_end - window.jd_start
        )
        contacts_raw = self._scan_contacts(
            provider,
            exact_angle,
            max_orb,
            window.jd_start,
            window.jd_end,
            step_jd,
        )
        contact_for_selected = next(
            (
                contact
                for contact in contacts_raw
                if contact["jd_enter"] - 1e-7
                <= selected_jd
                <= contact["jd_leave"] + 1e-7
            ),
            None,
        )
        if (
            contact_start is None
            and contact_end is None
            and contact_for_selected is not None
        ):
            duration = max(
                contact_for_selected["jd_leave"]
                - contact_for_selected["jd_enter"],
                1.0,
            )
            padding = min(
                max(duration * 0.12, 3.0),
                self.METHOD_DEFAULT_SPAN_DAYS.get(method, 365.0) * 0.15,
            )
            graph_start = max(
                window.jd_start, contact_for_selected["jd_enter"] - padding
            )
            graph_end = min(
                window.jd_end, contact_for_selected["jd_leave"] + padding
            )
        else:
            graph_start = window.jd_start
            graph_end = window.jd_end

        contacts = [
            self._format_contact(contact, timezone)
            for contact in contacts_raw
            if contact["jd_leave"] >= graph_start
            and contact["jd_enter"] <= graph_end
        ]
        status = (
            "ok"
            if selected_point and selected_point["in_orb"]
            else "selected_not_in_orb"
        )
        series = self._build_series(
            graph_start,
            graph_end,
            timezone,
            provider,
            exact_angle,
            max_orb,
            target_angle,
            max_points,
        )
        result = {
            **base,
            "status": status,
            "exact_angle": exact_angle,
            "orb_used": round(max_orb, 4),
            "orb_source": "astrologer_settings"
            if primary_context.astrologer_id
            else "default",
            "target_angle": target_angle,
            "selected_point": selected_point,
            "requested_window": window.requested,
            "effective_window": {
                "start": self._jd_to_iso(graph_start, timezone),
                "end": self._jd_to_iso(graph_end, timezone),
            },
            "boundary_complete": all(
                c["enter_complete"] and c["leave_complete"]
                for c in contacts_raw
            )
            if contacts_raw
            else True,
            "contacts": contacts,
            "series": series,
        }
        self._cache_set(cache_key, result)
        return result

    def _calculate_solar_dynamics(
        self,
        *,
        base: Dict,
        primary_context: NatalContext,
        source_body: str,
        target_body: str,
        exact_angle: float,
        max_orb: float,
        selected_date: date,
        selected_time: time,
        timezone: str,
        contact_start: Optional[date],
        contact_end: Optional[date],
        max_points: int,
        solar_year: Optional[int],
        solar_location: Optional[Dict[str, Any]],
    ) -> Dict:
        target_obj = self._context_object(primary_context, target_body)
        if target_obj is None:
            return {
                **base,
                "status": "unknown_natal_body",
                "contacts": [],
                "series": [],
            }
        selected_year = int(solar_year or selected_date.year)
        if contact_start and contact_end:
            start_year = contact_start.year
            end_year = contact_end.year
            requested = {
                "start": contact_start.isoformat(),
                "end": contact_end.isoformat(),
            }
        else:
            start_year = selected_year - 6
            end_year = selected_year + 6
            requested = {
                "selected_year": selected_year,
                "cap_years_each_side": 6,
            }
        max_years = max(1, min((end_year - start_year) + 1, self.MAX_POINTS))
        if max_years < (end_year - start_year) + 1:
            end_year = start_year + max_years - 1

        provider_for_year = (
            lambda year: self._solar_longitudes_for_year(  # noqa: E731
                primary_context,
                year,
                source_body,
                target_body,
                solar_location or {},
            )
        )
        selected_longs = provider_for_year(selected_year)
        if selected_longs is None:
            return {
                **base,
                "status": "unsupported_body",
                "contacts": [],
                "series": [],
            }
        target_angle = self._select_target_for_longitudes(
            selected_longs[:2], exact_angle
        )
        selected_jd = selected_longs[2]
        selected_point = self._format_point_from_longs(
            selected_jd,
            timezone,
            selected_longs[:2],
            exact_angle,
            max_orb,
            target_angle,
        )
        series = []
        for year in range(start_year, end_year + 1):
            longs = provider_for_year(year)
            if longs is None:
                continue
            series.append(
                self._format_point_from_longs(
                    longs[2],
                    timezone,
                    longs[:2],
                    exact_angle,
                    max_orb,
                    target_angle,
                )
            )
        contacts = self._contacts_from_discrete_series(
            series, max_orb, timezone
        )
        return {
            **base,
            "status": "ok"
            if selected_point["in_orb"]
            else "selected_not_in_orb",
            "exact_angle": exact_angle,
            "orb_used": round(max_orb, 4),
            "orb_source": "astrologer_settings"
            if primary_context.astrologer_id
            else "default",
            "target_angle": target_angle,
            "selected_point": selected_point,
            "requested_window": requested,
            "effective_window": {
                "start": series[0]["datetime"] if series else None,
                "end": series[-1]["datetime"] if series else None,
            },
            "boundary_complete": True,
            "contacts": contacts,
            "series": series,
        }

    def _solar_longitudes_for_year(
        self,
        context: NatalContext,
        year: int,
        source_body: str,
        target_body: str,
        solar_location: Dict[str, Any],
    ) -> Optional[Tuple[float, float, float]]:
        target_obj = self._context_object(context, target_body)
        if target_obj is None:
            return None
        natal_sun = self._context_object(context, "Sun")
        if natal_sun is None:
            return None
        lat = solar_location.get("latitude")
        lon = solar_location.get("longitude")
        location_timezone = solar_location.get("timezone")
        jd_solar = self._solar_service.find_solar_return_moment(
            float(natal_sun["longitude"]),
            int(year),
            zodiac=context.zodiac or "tropical",
            ayanamsha=context.ayanamsha or "lahiri",
            birth_month=context.birth_date.month
            if context.birth_date
            else None,
            birth_day=context.birth_date.day if context.birth_date else None,
        )
        source_lon = self._dynamic_body_longitude(
            context,
            jd_solar,
            source_body,
            latitude=float(lat) if lat is not None else context.birth_lat,
            longitude=float(lon) if lon is not None else context.birth_lon,
            timezone=location_timezone or context.birth_timezone,
        )
        if source_lon is None:
            return None
        return source_lon, float(target_obj["longitude"]), jd_solar

    def _longitudes_for_method(
        self,
        method: str,
        jd: float,
        *,
        source_context: NatalContext,
        target_context: NatalContext,
        source_body: str,
        target_body: str,
        direction_type: str,
    ) -> Optional[Tuple[float, float]]:
        if method == "natal":
            source = self._dynamic_body_longitude(
                source_context, jd, source_body
            )
            target = self._dynamic_body_longitude(
                target_context, jd, target_body
            )
            return (
                (source, target)
                if source is not None and target is not None
                else None
            )

        target_obj = self._context_object(target_context, target_body)
        if target_obj is None:
            return None
        target = float(target_obj["longitude"])

        if method == "transit":
            source = self._dynamic_body_longitude(
                source_context, jd, source_body
            )
        elif method == "progression":
            source = self._progressed_body_longitude(
                source_context, jd, source_body
            )
        elif method == "direction":
            source = self._directed_body_longitude(
                source_context, jd, source_body, direction_type
            )
        elif method == "synastry_partner":
            source = self._dynamic_body_longitude(
                source_context, jd, source_body
            )
        else:
            source = None
        return (source, target) if source is not None else None

    def _progressed_body_longitude(
        self, context: NatalContext, target_jd: float, body: str
    ) -> Optional[float]:
        if context.birth_jd is None:
            return None
        age_years = (target_jd - float(context.birth_jd)) / TROPICAL_YEAR_DAYS
        progressed_jd = float(context.birth_jd) + age_years
        return self._dynamic_body_longitude(context, progressed_jd, body)

    def _directed_body_longitude(
        self,
        context: NatalContext,
        target_jd: float,
        body: str,
        direction_type: str,
    ) -> Optional[float]:
        if context.birth_jd is None:
            return None
        obj = self._context_object(context, body)
        if obj is None:
            return None
        normalized_direction = DirectionService.normalize_direction_type(
            direction_type
        )
        age_years = (target_jd - float(context.birth_jd)) / TROPICAL_YEAR_DAYS
        arc = self._direction_service._calculate_arc(
            normalized_direction,
            float(context.birth_jd),
            age_years,
        )
        return normalize_longitude(float(obj["longitude"]) + arc)

    def _dynamic_body_longitude(
        self,
        context: NatalContext,
        jd: float,
        body: str,
        *,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        timezone: Optional[str] = None,
    ) -> Optional[float]:
        normalized = self._normalize_body_name(body)
        lat = latitude if latitude is not None else context.birth_lat
        lon = longitude if longitude is not None else context.birth_lon
        cache_key = (
            "dyn",
            normalized,
            round(float(jd), 6),
            context.zodiac or "tropical",
            context.ayanamsha or "lahiri",
            round(float(lat), 6) if lat is not None else None,
            round(float(lon), 6) if lon is not None else None,
            context.house_system or "P",
        )
        if cache_key in self._position_cache:
            return self._position_cache[cache_key]

        planet_lon = self.swisseph_engine.calculate_planet_longitude(
            jd,
            normalized,
            zodiac=context.zodiac or "tropical",
            ayanamsha=context.ayanamsha or "lahiri",
        )
        if planet_lon is not None:
            self._position_cache[cache_key] = planet_lon
            return planet_lon

        value = self._special_or_angle_longitude(
            context,
            jd,
            normalized,
            latitude=lat,
            longitude=lon,
            timezone=timezone,
        )
        self._position_cache[cache_key] = value
        return value

    def _special_or_angle_longitude(
        self,
        context: NatalContext,
        jd: float,
        body: str,
        *,
        latitude: Optional[float],
        longitude: Optional[float],
        timezone: Optional[str],
    ) -> Optional[float]:
        if body == "TrueNorthNode":
            north, _ = SpecialPointsService.calculate_true_nodes(jd)
            return float(north)
        if body == "TrueSouthNode":
            _, south = SpecialPointsService.calculate_true_nodes(jd)
            return float(south)
        if body == "BlackMoon":
            return float(SpecialPointsService.calculate_black_moon(jd))
        if body == "WhiteMoon":
            return float(SpecialPointsService.calculate_white_moon(jd))
        if body in {"ASC", "MC", "IC", "DSC", "Vertex", "Fortune"}:
            if latitude is None or longitude is None:
                return self._static_context_longitude(context, body)
            houses, angles = self.swisseph_engine.calculate_houses(
                jd,
                float(latitude),
                float(longitude),
                context.house_system or "P",
                zodiac=context.zodiac or "tropical",
                ayanamsha=context.ayanamsha or "lahiri",
            )
            if body in angles:
                angle = angles.get(body) or {}
                if angle.get("longitude") is not None:
                    return float(angle["longitude"])
            if body == "Fortune":
                sun = self.swisseph_engine.calculate_planet_longitude(
                    jd,
                    "Sun",
                    zodiac=context.zodiac or "tropical",
                    ayanamsha=context.ayanamsha or "lahiri",
                )
                moon = self.swisseph_engine.calculate_planet_longitude(
                    jd,
                    "Moon",
                    zodiac=context.zodiac or "tropical",
                    ayanamsha=context.ayanamsha or "lahiri",
                )
                asc = (angles.get("ASC") or {}).get("longitude")
                if sun is None or moon is None or asc is None:
                    return None
                sun_house = self.swisseph_engine.get_planet_house(
                    float(sun), houses
                )
                return float(
                    SpecialPointsService.calculate_part_of_fortune(
                        float(asc),
                        float(sun),
                        float(moon),
                        sun_house,
                        jd=jd,
                        latitude=float(latitude),
                        longitude=float(longitude),
                    )
                )
        return self._static_context_longitude(context, body)

    def _static_context_longitude(
        self, context: NatalContext, body: str
    ) -> Optional[float]:
        obj = self._context_object(context, body)
        return (
            float(obj["longitude"])
            if obj and obj.get("longitude") is not None
            else None
        )

    def _context_object(
        self, context: NatalContext, body: str
    ) -> Optional[Dict]:
        normalized = self._normalize_body_name(body)
        for obj in context.natal_data.get("all_objects") or []:
            if self._normalize_body_name(obj.get("name")) == normalized:
                return obj
        return None

    def _build_series(
        self,
        jd_start: float,
        jd_end: float,
        timezone: str,
        provider,
        exact_angle: float,
        max_orb: float,
        target_angle: float,
        max_points: int,
    ) -> List[Dict]:
        point_count = max(
            2, min(int(max_points or self.DEFAULT_POINTS), self.MAX_POINTS)
        )
        if jd_end < jd_start:
            jd_start, jd_end = jd_end, jd_start
        if abs(jd_end - jd_start) < 1e-9:
            return [
                self._format_point(
                    jd_start,
                    timezone,
                    provider,
                    exact_angle,
                    max_orb,
                    target_angle,
                )
            ]
        step = (jd_end - jd_start) / float(point_count - 1)
        return [
            self._format_point(
                jd_start + idx * step,
                timezone,
                provider,
                exact_angle,
                max_orb,
                target_angle,
            )
            for idx in range(point_count)
        ]

    def _format_point(
        self,
        jd: float,
        timezone: str,
        provider,
        exact_angle: float,
        max_orb: float,
        target_angle: float,
    ) -> Dict:
        longs = provider(jd)
        if longs is None:
            return {
                "datetime": self._jd_to_iso(jd, timezone),
                "julian_day": round(jd, 6),
                "signed_orb": None,
                "abs_orb": None,
                "strength": 0.0,
                "in_orb": False,
            }
        return self._format_point_from_longs(
            jd, timezone, longs, exact_angle, max_orb, target_angle
        )

    def _format_point_from_longs(
        self,
        jd: float,
        timezone: str,
        longs: Tuple[float, float],
        exact_angle: float,
        max_orb: float,
        target_angle: float,
    ) -> Dict:
        signed = self._signed_residual(longs, target_angle)
        abs_orb = self._deviation(longs, exact_angle)
        strength = 0.0 if max_orb <= 0 else max(0.0, 1.0 - (abs_orb / max_orb))
        return {
            "datetime": self._jd_to_iso(jd, timezone),
            "julian_day": round(jd, 6),
            "signed_orb": round(signed, 4),
            "abs_orb": round(abs_orb, 4),
            "strength": round(strength, 4),
            "in_orb": abs_orb <= max_orb,
        }

    def _scan_contacts(
        self,
        provider,
        exact_angle: float,
        max_orb: float,
        jd_start: float,
        jd_end: float,
        step_jd: float,
    ) -> List[Dict]:
        targets = self._aspect_targets(exact_angle)
        contacts: List[Dict] = []
        cur: Optional[Dict] = None
        prev_jd: Optional[float] = None
        prev_longs: Optional[Tuple[float, float]] = None
        prev_res: Dict[float, Optional[float]] = {t: None for t in targets}
        prev_speed: Optional[float] = None
        jd = jd_start
        samples = 0
        while jd <= jd_end + 1e-9:
            samples += 1
            if samples > self.MAX_SCAN_SAMPLES:
                break
            longs = provider(jd)
            if longs is None:
                jd += step_jd
                continue
            dev = self._deviation(longs, exact_angle)
            in_orb = dev <= max_orb
            speed = self._residual_speed(
                provider,
                jd,
                self._select_target_for_longitudes(longs, exact_angle),
                step_jd,
            )
            res = {
                target: self._signed_residual(longs, target)
                for target in targets
            }

            if in_orb and cur is None:
                if prev_jd is not None and prev_longs is not None:
                    enter_jd = self._bisect_boundary(
                        provider, prev_jd, jd, exact_angle, max_orb
                    )
                    enter_complete = True
                else:
                    enter_jd = jd
                    enter_complete = False
                cur = {
                    "jd_enter": enter_jd,
                    "enter_complete": enter_complete,
                    "passes": [],
                    "stations": [],
                    "min_orb": dev,
                    "min_orb_jd": jd,
                }

            if cur is not None and in_orb:
                if dev < cur["min_orb"]:
                    cur["min_orb"] = dev
                    cur["min_orb_jd"] = jd
                for target in targets:
                    r0 = prev_res[target]
                    r1 = res[target]
                    if r1 == 0.0:
                        root_jd = jd
                    elif (
                        r0 is not None
                        and r0 != 0.0
                        and (r0 < 0) != (r1 < 0)
                        and prev_jd is not None
                    ):
                        root_jd = self._bisect_root(
                            provider, prev_jd, jd, target
                        )
                    else:
                        continue
                    root_longs = provider(root_jd)
                    if root_longs is None:
                        continue
                    spd = self._residual_speed(
                        provider, root_jd, target, step_jd
                    )
                    cur["passes"].append(
                        {
                            "jd": root_jd,
                            "motion": "retrograde" if spd < 0 else "direct",
                            "orb": self._deviation(root_longs, exact_angle),
                        }
                    )
                if (
                    prev_speed is not None
                    and prev_speed != 0.0
                    and (prev_speed < 0) != (speed < 0)
                ):
                    cur["stations"].append(
                        {
                            "jd": self._bisect_speed_zero(
                                provider, prev_jd, jd, exact_angle, step_jd
                            ),
                            "type": "R"
                            if prev_speed > 0 and speed < 0
                            else "D",
                        }
                    )

            if cur is not None and not in_orb:
                cur["jd_leave"] = self._bisect_boundary(
                    provider, prev_jd, jd, exact_angle, max_orb
                )
                cur["leave_complete"] = True
                contacts.append(cur)
                cur = None

            prev_jd = jd
            prev_longs = longs
            prev_res = res
            prev_speed = speed
            jd += step_jd

        if cur is not None:
            cur["jd_leave"] = jd_end
            cur["leave_complete"] = False
            contacts.append(cur)
        return contacts

    def _contacts_from_discrete_series(
        self, series: List[Dict], max_orb: float, timezone: str
    ) -> List[Dict]:
        contacts: List[Dict] = []
        cur: Optional[Dict] = None
        for point in series:
            in_orb = bool(point.get("in_orb"))
            jd = float(point["julian_day"])
            orb = float(point.get("abs_orb") or 0.0)
            if in_orb and cur is None:
                cur = {
                    "jd_enter": jd,
                    "enter_complete": True,
                    "passes": [],
                    "stations": [],
                    "min_orb": orb,
                    "min_orb_jd": jd,
                }
            if cur is not None and in_orb and orb < cur["min_orb"]:
                cur["min_orb"] = orb
                cur["min_orb_jd"] = jd
            if cur is not None and not in_orb:
                cur["jd_leave"] = jd
                cur["leave_complete"] = True
                contacts.append(cur)
                cur = None
        if cur is not None:
            cur["jd_leave"] = float(series[-1]["julian_day"])
            cur["leave_complete"] = True
            contacts.append(cur)
        return [
            self._format_contact(contact, timezone) for contact in contacts
        ]

    def _format_contact(self, contact: Dict, timezone: str) -> Dict:
        passes = sorted(
            self._dedupe_jd_items(contact.get("passes") or []),
            key=lambda p: p["jd"],
        )
        stations = sorted(
            self._dedupe_jd_items(contact.get("stations") or []),
            key=lambda s: s["jd"],
        )
        return {
            "enter": self._jd_to_iso(contact["jd_enter"], timezone),
            "enter_complete": bool(contact["enter_complete"]),
            "leave": self._jd_to_iso(contact["jd_leave"], timezone),
            "leave_complete": bool(contact["leave_complete"]),
            "exact_pass_count": len(passes),
            "passes": [
                {
                    "date": self._jd_to_iso(p["jd"], timezone),
                    "motion": p.get("motion") or "direct",
                    "orb": round(float(p.get("orb") or 0.0), 4),
                }
                for p in passes
            ],
            "stations": [
                {
                    "date": self._jd_to_iso(s["jd"], timezone),
                    "type": s.get("type") or "",
                }
                for s in stations
            ],
            "closest_approach": {
                "orb": round(float(contact["min_orb"]), 4),
                "date": self._jd_to_iso(contact["min_orb_jd"], timezone),
            },
        }

    @staticmethod
    def _dedupe_jd_items(
        items: List[Dict], tolerance: float = 1.0 / 1440.0
    ) -> List[Dict]:
        out: List[Dict] = []
        for item in sorted(items, key=lambda value: value["jd"]):
            if (
                out
                and abs(float(out[-1]["jd"]) - float(item["jd"])) <= tolerance
            ):
                continue
            out.append(item)
        return out

    def _bisect_root(
        self, provider, jd_lo: float, jd_hi: float, target: float
    ) -> float:
        r_lo = self._signed_residual(provider(jd_lo), target)
        for _ in range(38):
            jd_mid = 0.5 * (jd_lo + jd_hi)
            longs_mid = provider(jd_mid)
            if longs_mid is None:
                return jd_mid
            r_mid = self._signed_residual(longs_mid, target)
            if (r_lo <= 0) == (r_mid <= 0):
                jd_lo, r_lo = jd_mid, r_mid
            else:
                jd_hi = jd_mid
        return 0.5 * (jd_lo + jd_hi)

    def _bisect_boundary(
        self,
        provider,
        jd_a: float,
        jd_b: float,
        exact_angle: float,
        max_orb: float,
    ) -> float:
        longs_a = provider(jd_a)
        if longs_a is None:
            return 0.5 * (jd_a + jd_b)
        f_a = self._deviation(longs_a, exact_angle) - max_orb
        for _ in range(30):
            jd_m = 0.5 * (jd_a + jd_b)
            longs_m = provider(jd_m)
            if longs_m is None:
                return jd_m
            f_m = self._deviation(longs_m, exact_angle) - max_orb
            if (f_a <= 0) == (f_m <= 0):
                jd_a, f_a = jd_m, f_m
            else:
                jd_b = jd_m
        return 0.5 * (jd_a + jd_b)

    def _bisect_speed_zero(
        self,
        provider,
        jd_a: float,
        jd_b: float,
        exact_angle: float,
        step_jd: float,
    ) -> float:
        target = self._select_target_for_longitudes(
            provider(jd_a), exact_angle
        )
        s_a = self._residual_speed(provider, jd_a, target, step_jd)
        for _ in range(28):
            jd_m = 0.5 * (jd_a + jd_b)
            s_m = self._residual_speed(provider, jd_m, target, step_jd)
            if (s_a < 0) == (s_m < 0):
                jd_a, s_a = jd_m, s_m
            else:
                jd_b = jd_m
        return 0.5 * (jd_a + jd_b)

    def _residual_speed(
        self, provider, jd: float, target: float, step_jd: float
    ) -> float:
        h = min(max(step_jd * 0.35, 1.0 / 24.0), 0.5)
        before = provider(jd - h)
        after = provider(jd + h)
        if before is None or after is None:
            return 0.0
        delta = self._wrap_pm180(
            self._signed_residual(after, target)
            - self._signed_residual(before, target)
        )
        return delta / (2.0 * h)

    def _resolve_window(
        self,
        method: str,
        source_body: str,
        selected_jd: float,
        selected_date: date,
        timezone: str,
        contact_start: Optional[date],
        contact_end: Optional[date],
    ) -> AspectDynamicsWindow:
        if contact_start is not None and contact_end is not None:
            _, jd_start = TimeService.process_birth_time(
                contact_start, time(0, 0), timezone
            )
            _, jd_end = TimeService.process_birth_time(
                contact_end, time(23, 59, 59), timezone
            )
            return AspectDynamicsWindow(
                jd_start=jd_start,
                jd_end=jd_end,
                requested={
                    "start": contact_start.isoformat(),
                    "end": contact_end.isoformat(),
                },
            )
        span = self.METHOD_DEFAULT_SPAN_DAYS.get(method, 365.0)
        if method == "transit" and source_body in self.FAST_BODIES:
            span = 180.0
        return AspectDynamicsWindow(
            jd_start=selected_jd - span,
            jd_end=selected_jd + span,
            requested={
                "selected": self._jd_to_iso(selected_jd, timezone),
                "cap_days_each_side": span,
            },
        )

    def _scan_step_days(
        self, method: str, source_body: str, span_days: float
    ) -> float:
        span_days = max(float(span_days or 1.0), 1.0)
        if method in {"natal", "synastry_partner"}:
            base = 0.25 if source_body in self.FAST_BODIES else 1.0
        elif method == "transit":
            base = 0.25 if source_body in self.FAST_BODIES else 2.0
        elif method == "progression":
            base = 7.0
        elif method == "direction":
            base = 14.0
        else:
            base = 1.0
        return max(base, span_days / self.MAX_SCAN_SAMPLES)

    def _allowed_orb(
        self,
        astrologer_id: Optional[UUID],
        body_a: str,
        body_b: str,
        aspect_type: str,
        *,
        orb_profile: str,
    ) -> float:
        if astrologer_id:
            return self.preferences_runtime.resolve_orb_for_astrologer(
                astrologer_id,
                body_a,
                body_b,
                aspect_type,
                orb_profile=orb_profile,
            )
        if orb_profile == "prognostic":
            return PROGNOSTIC_DEFAULT_ORB
        return self.aspect_service._calculate_allowed_orb(
            body_a,
            body_b,
            aspect_type,
            astrologer_id=astrologer_id,
            orb_profile=orb_profile,
        )

    def _aspect_type(self, aspect_type: str):
        if self._aspect_types is None:
            self._aspect_types = get_aspect_types(self.db)
        return next(
            (
                aspect
                for aspect in self._aspect_types
                if aspect.aspect_type == aspect_type
            ),
            None,
        )

    @classmethod
    def _normalize_body_name(cls, body: str) -> str:
        value = str(body or "").strip()
        return cls.SPECIAL_ALIASES.get(value, value)

    @staticmethod
    def _normalize_method(method: str) -> str:
        aliases = {
            "transits": "transit",
            "progressions": "progression",
            "directions": "direction",
            "solar": "solar_return",
            "synastry": "synastry_partner",
            "partner": "synastry_partner",
        }
        value = str(method or "transit").strip()
        return aliases.get(value, value)

    @classmethod
    def _aspect_targets(cls, exact_angle: float) -> List[float]:
        exact = float(exact_angle)
        if exact in (0.0, 180.0):
            return [exact]
        return [exact, -exact]

    @staticmethod
    def _wrap_pm180(value: float) -> float:
        return ((float(value) + 180.0) % 360.0) - 180.0

    def _signed_residual(
        self, longs: Tuple[float, float], target: float
    ) -> float:
        return self._wrap_pm180(
            (float(longs[0]) - float(longs[1])) - float(target)
        )

    def _deviation(
        self, longs: Tuple[float, float], exact_angle: float
    ) -> float:
        diff = self._wrap_pm180(float(longs[0]) - float(longs[1]))
        return min(
            abs(self._wrap_pm180(diff - target))
            for target in self._aspect_targets(exact_angle)
        )

    def _select_target_for_longitudes(
        self, longs: Tuple[float, float], exact_angle: float
    ) -> float:
        diff = self._wrap_pm180(float(longs[0]) - float(longs[1]))
        targets = self._aspect_targets(exact_angle)
        return min(
            targets, key=lambda target: abs(self._wrap_pm180(diff - target))
        )

    @staticmethod
    def _jd_to_datetime_utc(jd: float) -> datetime:
        year, month, day, hour_decimal = swe.revjul(float(jd))
        hours = int(hour_decimal)
        minute_decimal = (hour_decimal - hours) * 60.0
        minutes = int(minute_decimal)
        second_decimal = (minute_decimal - minutes) * 60.0
        seconds = int(second_decimal)
        microseconds = int(round((second_decimal - seconds) * 1_000_000))
        if microseconds >= 1_000_000:
            seconds += 1
            microseconds -= 1_000_000
        naive = datetime(year, month, day) + timedelta(
            hours=hours,
            minutes=minutes,
            seconds=seconds,
            microseconds=microseconds,
        )
        return pytz.UTC.localize(naive)

    def _jd_to_iso(self, jd: float, timezone: str) -> str:
        try:
            tz = pytz.timezone(timezone)
        except pytz.exceptions.UnknownTimeZoneError:
            tz = pytz.UTC
        return self._jd_to_datetime_utc(jd).astimezone(tz).isoformat()


def compact_birth_source_for_cache(value: Any) -> Dict[str, Any]:
    if value is None:
        return {}
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return value
    return {"value": str(value)}
