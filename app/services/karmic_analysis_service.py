"""
Aggregation service for backend-ready karmic analysis read-model.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.dignity_service import DignityService


MAJOR_ASPECT_TYPES = {"Conjunction", "Sextile", "Square", "Trine", "Opposition"}
HELPER_ASPECT_TYPES = {"Trine", "Sextile"}
BLOCKER_ASPECT_TYPES = {"Square", "Opposition"}
CHALLENGING_ASPECT_TYPES = {"Square", "Opposition"}
ROLE_CANDIDATE_PLANETS = {
    "Moon", "Mercury", "Venus", "Mars",
    "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"
}


class KarmicAnalysisService:
    """Build deterministic karmic analysis block from existing chart data."""

    def __init__(self) -> None:
        # Uses fallback sign properties without DB session.
        self._dignity_service = DignityService(db_session=None)

    def build(
        self,
        chart_data: Dict[str, Any],
        dignity_service: Optional[DignityService] = None,
    ) -> Dict[str, Any]:
        if dignity_service is not None:
            self._dignity_service = dignity_service
        planets = chart_data.get("planets") or []
        aspects = chart_data.get("aspects") or []
        special_points = chart_data.get("special_points") or {}
        stelliums = chart_data.get("stelliums") or []
        cosmogram_pattern = chart_data.get("cosmogram_pattern") or {}

        planet_names = {planet.get("name") for planet in planets if planet.get("name")}

        north_node_data = self._build_node_analysis(
            point_name="TrueNorthNode",
            special_points=special_points,
            aspects=aspects,
            planet_names=planet_names,
        )
        south_node_data = self._build_node_analysis(
            point_name="TrueSouthNode",
            special_points=special_points,
            aspects=aspects,
            planet_names=planet_names,
        )

        saturn_data = self._build_saturn_analysis(
            planets=planets,
            aspects=aspects,
            planet_names=planet_names,
        )

        black_moon_data = self._build_lunar_point_analysis(
            point_name="BlackMoon",
            special_points=special_points,
            aspects=aspects,
            planet_names=planet_names,
        )
        white_moon_data = self._build_lunar_point_analysis(
            point_name="WhiteMoon",
            special_points=special_points,
            aspects=aspects,
            planet_names=planet_names,
        )

        support_planets_plus_3 = sorted(
            [
                planet.get("name")
                for planet in planets
                if planet.get("name") and self._safe_int(planet.get("karmic_plus_score"), 0) >= 3
            ]
        )
        development_planets_minus_3 = sorted(
            [
                planet.get("name")
                for planet in planets
                if planet.get("name") and self._safe_int(planet.get("karmic_minus_score"), 0) >= 3
            ]
        )
        top_karmic_planets = self._build_top_karmic_planets(planets)

        first_house_planets = sorted(
            [planet.get("name") for planet in planets if planet.get("name") and planet.get("house") == 1]
        )
        domicile_or_exaltation_planets = sorted(
            [
                planet.get("name")
                for planet in planets
                if planet.get("name") and planet.get("dignity") in {"domicile", "exaltation"}
            ]
        )
        south_node_sign_dispositor = self._get_point_dispositor("TrueSouthNode", special_points)
        north_node_sign_dispositor = self._get_point_dispositor("TrueNorthNode", special_points)
        black_moon_dispositor = self._get_point_dispositor("BlackMoon", special_points)

        charioteer_planet = self._find_special_role_planet(planets, "charioteer")
        doryphoros_planet = self._find_special_role_planet(planets, "doryphoros")

        # Fallback for legacy charts where special_roles may be stale/empty:
        # compute nearest planets by longitude around Sun.
        if not charioteer_planet:
            charioteer_planet = self._find_role_by_longitude(planets, role_name="charioteer")
        if not doryphoros_planet:
            doryphoros_planet = self._find_role_by_longitude(planets, role_name="doryphoros")

        harmonic_trines = self._collect_planet_aspects(aspects, planet_names, {"Trine"})
        challenging_aspects = self._collect_planet_aspects(
            aspects, planet_names, CHALLENGING_ASPECT_TYPES
        )

        pattern_type = cosmogram_pattern.get("pattern_type")
        handle_planet = None
        if pattern_type in {"Bucket", "Bowl"}:
            handle_planet = cosmogram_pattern.get("handle_planet")
            if not handle_planet:
                handle_planets = cosmogram_pattern.get("handle_planets") or []
                handle_planet = sorted([p for p in handle_planets if p])[0] if handle_planets else None

        return {
            "nodes": {
                "north_node": north_node_data,
                "south_node": south_node_data,
            },
            "saturn_analysis": saturn_data,
            "lunar_points_analysis": {
                "black_moon": black_moon_data,
                "white_moon": white_moon_data,
            },
            "karmic_status": {
                "support_planets_plus_3": support_planets_plus_3,
                "development_planets_minus_3": development_planets_minus_3,
                "top_karmic_planets": top_karmic_planets,
            },
            "karmic_support": {
                "first_house_planets": first_house_planets,
                "domicile_or_exaltation_planets": domicile_or_exaltation_planets,
                "south_node_sign_dispositor": south_node_sign_dispositor,
                "charioteer_planet": charioteer_planet,
                "harmonic_trines": harmonic_trines,
                "stelliums": stelliums if isinstance(stelliums, list) else [],
            },
            "karmic_development": {
                "north_node_sign_dispositor": north_node_sign_dispositor,
                "doryphoros_planet": doryphoros_planet,
                "black_moon_dispositor": black_moon_dispositor,
                "challenging_aspects": challenging_aspects,
            },
            "jones_pattern": {
                "type": pattern_type,
                "leading_planet": cosmogram_pattern.get("leading_planet"),
                "handle_planet": handle_planet,
            },
        }

    def _build_node_analysis(
        self,
        point_name: str,
        special_points: Dict[str, Dict[str, Any]],
        aspects: List[Dict[str, Any]],
        planet_names: Set[str],
    ) -> Dict[str, Any]:
        point_data = special_points.get(point_name) or {}
        sign = point_data.get("sign")
        house = point_data.get("house")
        dispositor = self._get_sign_dispositor(sign)

        conjunctions = self._collect_point_planets(
            aspects=aspects,
            point_name=point_name,
            planet_names=planet_names,
            aspect_types={"Conjunction"},
            max_orb=3.0,
            major_only=False,
        )
        helpers = self._collect_point_planets(
            aspects=aspects,
            point_name=point_name,
            planet_names=planet_names,
            aspect_types=HELPER_ASPECT_TYPES,
            max_orb=None,
            major_only=False,
        )
        blockers = self._collect_point_planets(
            aspects=aspects,
            point_name=point_name,
            planet_names=planet_names,
            aspect_types=BLOCKER_ASPECT_TYPES,
            max_orb=None,
            major_only=False,
        )

        return {
            "sign": sign,
            "house": house,
            "dispositor_planet": dispositor,
            "conjunctions_orb3": conjunctions,
            "helper_planets": helpers,
            "blocker_planets": blockers,
        }

    def _build_saturn_analysis(
        self,
        planets: List[Dict[str, Any]],
        aspects: List[Dict[str, Any]],
        planet_names: Set[str],
    ) -> Dict[str, Any]:
        saturn = next((planet for planet in planets if planet.get("name") == "Saturn"), None)
        sign = saturn.get("sign") if saturn else None
        house = saturn.get("house") if saturn else None

        helpers = self._collect_point_planets(
            aspects=aspects,
            point_name="Saturn",
            planet_names=planet_names,
            aspect_types=HELPER_ASPECT_TYPES,
            max_orb=None,
            major_only=False,
        )
        blockers = self._collect_point_planets(
            aspects=aspects,
            point_name="Saturn",
            planet_names=planet_names,
            aspect_types=BLOCKER_ASPECT_TYPES,
            max_orb=None,
            major_only=False,
        )

        return {
            "sign": sign,
            "house": house,
            "dispositor_planet": self._get_sign_dispositor(sign),
            "helper_planets": helpers,
            "blocker_planets": blockers,
        }

    def _build_lunar_point_analysis(
        self,
        point_name: str,
        special_points: Dict[str, Dict[str, Any]],
        aspects: List[Dict[str, Any]],
        planet_names: Set[str],
    ) -> Dict[str, Any]:
        point_data = special_points.get(point_name) or {}
        sign = point_data.get("sign")
        house = point_data.get("house")

        aspected_planets = self._collect_point_planets(
            aspects=aspects,
            point_name=point_name,
            planet_names=planet_names,
            aspect_types=MAJOR_ASPECT_TYPES,
            max_orb=None,
            major_only=True,
        )

        return {
            "sign": sign,
            "house": house,
            "dispositor_planet": self._get_sign_dispositor(sign),
            "aspected_planets": aspected_planets,
        }

    def _collect_point_planets(
        self,
        aspects: List[Dict[str, Any]],
        point_name: str,
        planet_names: Set[str],
        aspect_types: Set[str],
        max_orb: Optional[float],
        major_only: bool,
    ) -> List[str]:
        planets: Set[str] = set()

        for aspect in aspects:
            planet_1 = aspect.get("planet_1")
            planet_2 = aspect.get("planet_2")
            aspect_type = aspect.get("aspect_type")

            if aspect_type not in aspect_types:
                continue
            if major_only and not self._is_major_aspect(aspect):
                continue

            orb = self._safe_float(aspect.get("orb"))
            if max_orb is not None and (orb is None or orb > max_orb):
                continue

            if planet_1 == point_name and planet_2 in planet_names:
                planets.add(planet_2)
            elif planet_2 == point_name and planet_1 in planet_names:
                planets.add(planet_1)

        return sorted(planets)

    def _collect_planet_aspects(
        self,
        aspects: List[Dict[str, Any]],
        planet_names: Set[str],
        aspect_types: Set[str],
    ) -> List[Dict[str, Any]]:
        collected: List[Tuple[str, str, str, Optional[float]]] = []
        seen: Set[Tuple[str, str, str, Optional[float]]] = set()

        for aspect in aspects:
            aspect_type = aspect.get("aspect_type")
            if aspect_type not in aspect_types:
                continue

            planet_1 = aspect.get("planet_1")
            planet_2 = aspect.get("planet_2")
            if planet_1 not in planet_names or planet_2 not in planet_names:
                continue

            p1, p2 = sorted([planet_1, planet_2])
            orb = self._safe_float(aspect.get("orb"))
            key = (p1, p2, aspect_type, orb)
            if key in seen:
                continue
            seen.add(key)
            collected.append(key)

        collected.sort(key=lambda item: (item[0], item[1], item[2], item[3] if item[3] is not None else 9999.0))
        return [
            {"planet_1": p1, "planet_2": p2, "aspect_type": aspect_type, "orb": orb}
            for p1, p2, aspect_type, orb in collected
        ]

    def _build_top_karmic_planets(self, planets: List[Dict[str, Any]]) -> List[str]:
        scores: List[Tuple[float, str]] = []
        for planet in planets:
            name = planet.get("name")
            score = self._safe_float(planet.get("karmic_score"))
            if not name or score is None:
                continue
            scores.append((abs(score), name))

        if not scores:
            return []

        scores.sort(key=lambda item: (-item[0], item[1]))
        return [name for _, name in scores[:3]]

    def _find_special_role_planet(self, planets: List[Dict[str, Any]], role_name: str) -> Optional[str]:
        matched = []
        for planet in planets:
            name = planet.get("name")
            roles = planet.get("special_roles") or []
            if not name or not isinstance(roles, list):
                continue
            if role_name in roles:
                matched.append(name)
        return sorted(matched)[0] if matched else None

    def _find_role_by_longitude(self, planets: List[Dict[str, Any]], role_name: str) -> Optional[str]:
        sun = next((planet for planet in planets if planet.get("name") == "Sun"), None)
        if not sun:
            return None

        sun_lon = self._safe_float(sun.get("longitude"))
        if sun_lon is None:
            return None

        candidates: List[Tuple[float, str]] = []
        for planet in planets:
            name = planet.get("name")
            if not name or name not in ROLE_CANDIDATE_PLANETS:
                continue

            planet_lon = self._safe_float(planet.get("longitude"))
            if planet_lon is None:
                continue

            if role_name == "doryphoros":
                diff = (sun_lon - planet_lon) % 360.0
            elif role_name == "charioteer":
                diff = (planet_lon - sun_lon) % 360.0
            else:
                return None

            # Exact conjunction (0°) does not qualify for either role.
            if diff > 0:
                candidates.append((diff, name))

        if not candidates:
            return None

        # Deterministic tie-break by name.
        candidates.sort(key=lambda item: (item[0], item[1]))
        return candidates[0][1]

    def _get_point_dispositor(
        self,
        point_name: str,
        special_points: Dict[str, Dict[str, Any]],
    ) -> Optional[str]:
        sign = (special_points.get(point_name) or {}).get("sign")
        return self._get_sign_dispositor(sign)

    def _get_sign_dispositor(self, sign: Optional[str]) -> Optional[str]:
        if not sign:
            return None
        ruler = self._dignity_service.get_house_ruler(sign)
        return ruler or None

    @staticmethod
    def _is_major_aspect(aspect: Dict[str, Any]) -> bool:
        is_major = aspect.get("is_major")
        if isinstance(is_major, bool):
            return is_major
        return aspect.get("aspect_type") in MAJOR_ASPECT_TYPES

    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _safe_int(value: Any, default: int) -> int:
        if value is None:
            return default
        try:
            return int(value)
        except (TypeError, ValueError):
            return default
