"""
In-memory derivations for chart-like payloads.

This keeps solar returns on the same enrichment path as natal charts without
requiring every derived artifact to be persisted in natal DB tables first.
"""
from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.services.aspect_service import AspectService
from app.services.balance_service import BalanceService
from app.services.configuration_service import ConfigurationService
from app.services.cosmogram_service import CosmogramService
from app.services.dignity_service import DignityService
from app.services.natal_chart_service import NatalChartService


class ChartDerivationService:
    """Build natal-compatible derived blocks for transient chart payloads."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def enrich_solar_payload(
        self,
        payload: Dict,
        *,
        user_id: UUID,
        astrologer_id: Optional[UUID] = None,
    ) -> Dict:
        """Return a solar payload with natal-compatible derived fields."""
        if not payload:
            return payload

        result = deepcopy(payload)
        planets = list(result.get("planets") or [])
        houses = list(result.get("houses") or [])
        angles = dict(result.get("angles") or {})
        aspects = self._annotate_and_enrich_aspects(result.get("aspects") or [], planets, angles)

        natal_service = NatalChartService()
        houses = natal_service._enrich_houses_with_properties(
            houses,
            self.db,
            astrologer_id=astrologer_id,
        )
        planets = natal_service._enrich_planets_with_properties(
            planets,
            houses,
            aspects,
            self.db,
            astrologer_id=astrologer_id,
            angles=angles,
            special_points={},
        )
        planets, houses = natal_service._enrich_house_planet_relations(planets, houses)
        houses = natal_service._attach_house_ruler_groups(
            houses,
            planets,
            DignityService(db_session=self.db, astrologer_id=astrologer_id),
        )

        result["planets"] = planets
        result["houses"] = houses
        result["aspects"] = aspects
        result["aspect_configurations"] = self._build_aspect_configurations(aspects)
        result["stelliums"] = self._build_stelliums(planets)
        result["planet_distribution"] = self._build_planet_distribution(planets)
        result["cosmogram_pattern"] = self._build_cosmogram_pattern(planets)
        result["balances"] = BalanceService(self.db).build_dual_balances(
            planets,
            [],
            user_id=user_id,
            astrologer_id=astrologer_id,
        )
        return result

    def has_extended_blocks(self, payload: Dict) -> bool:
        """Whether a saved payload already has the expanded solar read model."""
        return all(
            key in (payload or {})
            for key in ("aspect_configurations", "stelliums", "cosmogram_pattern", "balances")
        )

    def _annotate_and_enrich_aspects(
        self,
        aspects: List[Dict],
        planets: List[Dict],
        angles: Dict,
    ) -> List[Dict]:
        objects = [
            {
                "name": planet.get("name"),
                "longitude": planet.get("longitude"),
                "speed": planet.get("speed") or 0.0,
                "type": "planet",
            }
            for planet in planets
            if planet.get("name") and planet.get("longitude") is not None
        ]
        objects.extend(
            {
                "name": angle.get("name") or angle_name,
                "longitude": angle.get("longitude"),
                "speed": 0.0,
                "type": "angle",
            }
            for angle_name, angle in (angles or {}).items()
            if angle.get("longitude") is not None
        )

        annotated = AspectService(self.db).annotate_aspects_with_phase(aspects, objects) if aspects else []
        return [
            NatalChartService._enrich_aspect_for_display(aspect)
            if aspect.get("planet_1") and aspect.get("planet_2")
            else aspect
            for aspect in annotated
        ]

    @staticmethod
    def _fake_aspect(aspect: Dict) -> SimpleNamespace:
        return SimpleNamespace(
            planet_1=aspect.get("planet_1"),
            planet_2=aspect.get("planet_2"),
            aspect_type=aspect.get("aspect_type"),
            orb=aspect.get("orb") or 0.0,
            is_major=aspect.get("is_major"),
            harmonic_type=aspect.get("harmonic_type"),
        )

    @staticmethod
    def _fake_planet(planet: Dict) -> SimpleNamespace:
        return SimpleNamespace(
            planet=planet.get("name"),
            sign=planet.get("sign"),
            house_number=planet.get("house") or planet.get("house_number"),
            degree=planet.get("longitude") or 0.0,
            strength_score=planet.get("strength_score") or 0.0,
        )

    def _build_aspect_configurations(self, aspects: List[Dict]) -> List[Dict]:
        service = ConfigurationService(self.db)
        fake_aspects = [self._fake_aspect(aspect) for aspect in aspects]
        filtered = service._filter_aspects_for_configurations(fake_aspects)
        configurations = []
        configurations.extend(service._find_grand_trines(filtered))
        configurations.extend(service._find_t_squares(filtered))
        configurations.extend(service._find_grand_crosses(filtered))
        configurations.extend(service._find_yods(filtered))
        configurations.extend(service._find_bisextiles(filtered))
        configurations.extend(service._find_trapezoids(filtered))
        configurations.extend(service._find_skewed_sails(filtered))
        configurations.extend(service._find_chariots(filtered))
        configurations.extend(service._find_sails(filtered))
        configurations.extend(service._find_open_envelopes(filtered))
        configurations.extend(service._find_stars_of_david(filtered))

        result = []
        for config in configurations:
            config_aspects = service._find_aspects_for_configuration(config, filtered)
            result.append({
                "type": config.get("type"),
                "planets_involved": config.get("planets_involved", []),
                "apex_planet": config.get("apex_planet"),
                "element": config.get("element"),
                "mode": config.get("mode"),
                "strength_score": float(config.get("strength_score") or 0.0),
                "aspects": [
                    {
                        "planet_1": aspect.planet_1,
                        "planet_2": aspect.planet_2,
                        "aspect_type": aspect.aspect_type,
                        "orb": float(aspect.orb or 0.0),
                        "orb_planet_1": float(aspect.orb or 0.0),
                        "orb_planet_2": float(aspect.orb or 0.0),
                        "min_orb": float(aspect.orb or 0.0),
                        "max_orb": float(aspect.orb or 0.0),
                        "score": 0,
                    }
                    for aspect in config_aspects
                ],
            })
        return result

    def _build_stelliums(self, planets: List[Dict]) -> List[Dict]:
        service = ConfigurationService(self.db)
        fake_planets = [
            self._fake_planet(planet)
            for planet in planets
            if planet.get("name") in service.STELLIUM_PLANETS
        ]
        return [
            *service._find_stelliums_by_sign(fake_planets),
            *service._find_stelliums_by_house(fake_planets),
        ]

    def _build_planet_distribution(self, planets: List[Dict]) -> Optional[Dict]:
        service = CosmogramService(self.db)
        analysis_planets = [
            self._fake_planet(planet)
            for planet in planets
            if planet.get("name") in service.ANALYSIS_PLANETS
        ]
        if len(analysis_planets) < 10:
            return None
        longitudes = sorted(float(planet.degree) for planet in analysis_planets)
        empty_arcs = service._calculate_empty_arcs(longitudes)
        clusters = service._identify_clusters(longitudes, empty_arcs)
        return {
            "min_empty_arc": min(empty_arcs) if empty_arcs else 0.0,
            "max_empty_arc": max(empty_arcs) if empty_arcs else 0.0,
            "cluster_count": len(clusters),
            "spread_map": service._create_spread_map(analysis_planets, clusters),
        }

    def _build_cosmogram_pattern(self, planets: List[Dict]) -> Optional[Dict]:
        service = CosmogramService(self.db)
        analysis_planets = [
            self._fake_planet(planet)
            for planet in planets
            if planet.get("name") in service.ANALYSIS_PLANETS
        ]
        if len(analysis_planets) < 10:
            return None
        longitudes = sorted(float(planet.degree) for planet in analysis_planets)
        empty_arcs = service._calculate_empty_arcs(longitudes)
        max_empty_arc = max(empty_arcs) if empty_arcs else 0.0
        pattern_type = service._identify_pattern(
            longitudes,
            empty_arcs,
            max_empty_arc,
            360 - max_empty_arc,
        )
        key_planets = service._find_key_planets(
            analysis_planets,
            pattern_type,
            longitudes,
            empty_arcs,
            max_empty_arc,
        )
        return {
            "pattern_type": pattern_type,
            "empty_arc_degree": max_empty_arc,
            "special_roles": [],
            **key_planets,
        }
