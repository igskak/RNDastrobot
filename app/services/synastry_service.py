"""Synastry workspace assembly on top of existing natal-chart infrastructure."""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.services.aspect_service import AspectService
from app.services.natal_chart_service import NatalChartService
from app.services.preferences_service import PreferencesService
from app.utils.ephemeris import get_ephemeris_path


class SynastryService:
    """Build cross-chart data while reusing persisted natal charts."""

    def __init__(self, db_session: Session, ephe_path: Optional[str] = None):
        self.db = db_session
        self.natal_service = NatalChartService(ephe_path=ephe_path or get_ephemeris_path())
        self.aspect_service = AspectService(db_session)
        self.preferences_service = PreferencesService(db_session)
        self.swisseph_engine = self.natal_service.swisseph_engine

    def build_synastry_payload_from_charts(
        self,
        *,
        astrologer,
        primary_chart: Dict,
        partner_chart: Dict,
    ) -> Dict:
        """Ядро синастрии для произвольных источников карт (сохранённых или inline-ephemeral).

        Работает на dict-картах (форма get_natal_chart_from_db / calculate_natal_chart):
        интер-аспекты (орбисы synastry-профиля по astrologer_id) + house overlays.
        Per-chart resolved_preferences НЕ резолвит (нужны chart_id сохранённых карт) —
        это делает обёртка build_synastry_payload.
        """
        return {
            'primary_chart': primary_chart,
            'partner_chart': partner_chart,
            'inter_aspects': self._build_inter_aspects(
                primary_chart,
                partner_chart,
                astrologer_id=astrologer.id,
            ),
            'house_overlays': self._build_house_overlays(primary_chart, partner_chart),
        }

    def build_synastry_payload(
        self,
        *,
        astrologer,
        user_id: UUID,
        partner_id: UUID,
    ) -> Dict:
        primary_chart = self.natal_service.get_natal_chart_from_db(user_id, self.db)
        partner_chart = self.natal_service.get_natal_chart_from_db(partner_id, self.db)

        if primary_chart is None:
            raise ValueError("Primary natal chart not found")
        if partner_chart is None:
            raise ValueError("Partner natal chart not found")

        return {
            **self.build_synastry_payload_from_charts(
                astrologer=astrologer,
                primary_chart=primary_chart,
                partner_chart=partner_chart,
            ),
            'resolved_preferences': {
                'primary_natal': self.preferences_service.resolve_preferences(
                    astrologer,
                    chart_kind='natal',
                    chart_id=user_id,
                    view_type='natal',
                ),
                'partner_natal': self.preferences_service.resolve_preferences(
                    astrologer,
                    chart_kind='natal',
                    chart_id=partner_id,
                    view_type='natal',
                ),
                # Reuse the existing biwheel preference bucket for the central compare area.
                'synastry': self.preferences_service.resolve_preferences(
                    astrologer,
                    chart_kind='natal',
                    chart_id=user_id,
                    view_type='biwheel',
                ),
            },
        }

    def _build_inter_aspects(
        self,
        primary_chart: Dict,
        partner_chart: Dict,
        *,
        astrologer_id: UUID,
    ) -> List[Dict]:
        primary_objects = self._collect_chart_objects(primary_chart, include_angles=True)
        partner_objects = self._collect_chart_objects(partner_chart, include_angles=True)
        aspect_types = self.aspect_service._get_aspect_types()

        inter_aspects: List[Dict] = []
        for primary_object in primary_objects:
            for partner_object in partner_objects:
                aspect = self.aspect_service._calculate_aspect_between(
                    primary_object,
                    partner_object,
                    aspect_types,
                    astrologer_id=astrologer_id,
                    orb_profile='synastry',
                )
                if not aspect:
                    continue

                applying = self._infer_cross_aspect_phase(
                    primary_object,
                    partner_object,
                    aspect_type=aspect['aspect_type'],
                )
                enriched = NatalChartService._enrich_aspect_for_display({
                    'planet_1': primary_object['name'],
                    'planet_2': partner_object['name'],
                    'aspect_type': aspect['aspect_type'],
                    'orb': aspect['orb'],
                    'is_major': aspect['is_major'],
                    'applying': applying,
                    'harmonic_type': aspect.get('harmonic_type'),
                    'is_partile': aspect.get('is_partile', False),
                    'chart_1': 'primary',
                    'chart_2': 'partner',
                    'object_1_type': primary_object['type'],
                    'object_2_type': partner_object['type'],
                    'object_1_sign': primary_object.get('sign'),
                    'object_2_sign': partner_object.get('sign'),
                    'object_1_house': primary_object.get('house'),
                    'object_2_house': partner_object.get('house'),
                })
                inter_aspects.append(enriched)

        return sorted(
            inter_aspects,
            key=lambda item: (
                NatalChartService._get_aspect_rank(item['planet_1']),
                NatalChartService._get_aspect_rank(item['planet_2']),
                float(item.get('orb') or 0.0),
                item.get('aspect_type') or '',
            ),
        )

    def _build_house_overlays(self, primary_chart: Dict, partner_chart: Dict) -> Dict:
        return {
            'primary_in_partner_houses': self._build_house_overlay_direction(
                source_chart=primary_chart,
                target_chart=partner_chart,
            ),
            'partner_in_primary_houses': self._build_house_overlay_direction(
                source_chart=partner_chart,
                target_chart=primary_chart,
            ),
        }

    def _build_house_overlay_direction(self, *, source_chart: Dict, target_chart: Dict) -> List[Dict]:
        source_objects = self._collect_chart_objects(source_chart, include_angles=False)
        target_houses = list(target_chart.get('houses') or [])

        overlay_items: List[Dict] = []
        for source_object in source_objects:
            overlay_items.append({
                'body_name': source_object['name'],
                'body_type': source_object['type'],
                'sign': source_object.get('sign'),
                'degree_in_sign': source_object.get('degree_in_sign'),
                'degree_in_sign_formatted': source_object.get('degree_in_sign_formatted'),
                'natal_house': source_object.get('house'),
                'overlay_house': self.swisseph_engine.get_planet_house(
                    source_object['longitude'],
                    target_houses,
                ),
            })

        return sorted(
            overlay_items,
            key=lambda item: (
                int(item.get('overlay_house') or 0),
                NatalChartService._get_aspect_rank(item.get('body_name')),
                item.get('body_name') or '',
            ),
        )

    def _collect_chart_objects(self, chart_data: Dict, *, include_angles: bool) -> List[Dict]:
        objects: List[Dict] = []

        for planet in chart_data.get('planets') or []:
            objects.append({
                'name': planet['name'],
                'longitude': float(planet['longitude']),
                'type': 'planet',
                'speed': float(planet.get('speed') or 0.0),
                'sign': planet.get('sign'),
                'house': planet.get('house'),
                'degree_in_sign': planet.get('degree_in_sign'),
                'degree_in_sign_formatted': planet.get('degree_in_sign_formatted'),
            })

        for point in (chart_data.get('special_points') or {}).values():
            objects.append({
                'name': point['name'],
                'longitude': float(point['longitude']),
                'type': 'special_point',
                'speed': 0.0,
                'sign': point.get('sign'),
                'house': point.get('house'),
                'degree_in_sign': point.get('degree_in_sign'),
                'degree_in_sign_formatted': point.get('degree_in_sign_formatted'),
            })

        if include_angles:
            for angle in (chart_data.get('angles') or {}).values():
                if angle.get('longitude') is None:
                    continue
                objects.append({
                    'name': angle['name'],
                    'longitude': float(angle['longitude']),
                    'type': 'angle',
                    'speed': 0.0,
                    'sign': angle.get('sign'),
                    'house': None,
                    'degree_in_sign': angle.get('degree_in_sign'),
                    'degree_in_sign_formatted': angle.get('degree_in_sign_formatted'),
                })

        return objects

    def _infer_cross_aspect_phase(
        self,
        object_a: Dict,
        object_b: Dict,
        *,
        aspect_type: str,
    ) -> Optional[bool]:
        exact_angle = self.aspect_service._get_aspect_angles().get(aspect_type)
        if exact_angle is None:
            return None

        current_distance = AspectService._angular_distance(object_a['longitude'], object_b['longitude'])
        current_deviation = abs(current_distance - exact_angle)

        step_days = 1.0 / 24.0
        future_distance = AspectService._angular_distance(
            object_a['longitude'] + (float(object_a.get('speed') or 0.0) * step_days),
            object_b['longitude'] + (float(object_b.get('speed') or 0.0) * step_days),
        )
        future_deviation = abs(future_distance - exact_angle)

        if abs(future_deviation - current_deviation) < 1e-9:
            return None
        return future_deviation < current_deviation
