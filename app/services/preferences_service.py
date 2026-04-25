"""Preference resolution for account defaults and chart-level overrides."""
from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models import Astrologer, AstrologerPreference, ChartViewOverride, SolarReturn, User
from app.models.schemas import normalize_house_system_code
from app.services.preferences_runtime import PreferencesRuntimeResolver, normalize_methodology_settings


PREFERENCE_VERSION = 1
VIEW_TYPES = ('natal', 'biwheel', 'forecast_new', 'solar')
CHART_KINDS = ('natal', 'solar')
DEFAULT_ENABLED_ASPECT_TYPES = [
    'Conjunction',
    'Opposition',
    'Trine',
    'Square',
    'Sextile',
    'Vigintile',
    'Semi_Nonagon',
    'Semisextile',
    'Decile',
    'Nonagon',
    'Semisquare',
    'Quintile',
    'Binonagon',
    'Sentagon',
    'Tridecile',
    'Sesquiquadrate',
    'Biquintile',
    'Quincunx',
]
DEFAULT_MATRIX_BODIES = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
    'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    'Chiron', 'Proserpina',
    'TrueNode', 'SouthNode',
    'BlackMoon', 'WhiteMoon', 'PartOfFortune',
    'ASC', 'DSC', 'MC', 'IC', 'Vertex', 'AntiVertex',
]


def _build_default_matrix() -> Dict[str, Any]:
    return {
        'rows': {
            body: {'display': True, 'aspecting': True}
            for body in DEFAULT_MATRIX_BODIES
        }
    }


def build_default_preferences(default_house_system: str = 'P') -> Dict[str, Any]:
    biwheel_scope = 'major'
    return {
        'version': PREFERENCE_VERSION,
        'chart_defaults': {
            'natal': {
                'matrix': _build_default_matrix(),
                'aspects': {
                    'scope': 'all',
                    'enabled_types': list(DEFAULT_ENABLED_ASPECT_TYPES),
                    'show_applying_separating': False,
                },
                'table_options': {
                    'show_speed': True,
                    'show_stationary': True,
                },
                'view_options': {
                    'orientation': 'aries',
                },
            },
            'biwheel': {
                'matrix': _build_default_matrix(),
                'aspects': {
                    'scope': biwheel_scope,
                    'enabled_types': list(DEFAULT_ENABLED_ASPECT_TYPES),
                    'show_applying_separating': False,
                },
                'table_options': {
                    'show_speed': True,
                    'show_stationary': True,
                },
                'view_options': {
                    'orientation': 'aries',
                },
            },
            'forecast_new': {
                'matrix': _build_default_matrix(),
                'aspects': {
                    'scope': 'all',
                    'enabled_types': list(DEFAULT_ENABLED_ASPECT_TYPES),
                    'show_applying_separating': False,
                },
                'table_options': {
                    'show_speed': True,
                    'show_stationary': True,
                },
                'view_options': {
                    'orientation': 'aries',
                },
            },
            'solar': {
                'matrix': _build_default_matrix(),
                'aspects': {
                    'scope': 'all',
                    'enabled_types': list(DEFAULT_ENABLED_ASPECT_TYPES),
                    'show_applying_separating': False,
                },
                'table_options': {
                    'show_speed': True,
                    'show_stationary': True,
                },
                'view_options': {
                    'orientation': 'aries',
                },
            },
        },
        'methodology': {
            'orbs': {},
            'balances': {},
        },
        'visual': {
            'aspect_colors': {},
            'planet_colors': {},
        },
        'chart_creation_defaults': {
            'house_system': normalize_house_system_code(default_house_system),
        },
    }


def deep_merge_dicts(base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
    result = deepcopy(base)
    for key, value in (overlay or {}).items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge_dicts(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result


class PreferencesService:
    """Encapsulates account defaults, sparse overrides, and chart metadata resolution."""

    def __init__(self, db: Session):
        self.db = db
        self.runtime = PreferencesRuntimeResolver(db)

    def get_or_create_account_record(self, astrologer: Astrologer) -> AstrologerPreference:
        record = (
            self.db.query(AstrologerPreference)
            .filter(AstrologerPreference.astrologer_id == astrologer.id)
            .first()
        )
        if record:
            return record

        defaults = build_default_preferences(astrologer.default_house_system)
        defaults['methodology'] = self.runtime.build_default_methodology()
        defaults['visual'] = self.runtime.build_default_visual()
        record = AstrologerPreference(
            astrologer_id=astrologer.id,
            version=PREFERENCE_VERSION,
            chart_defaults=defaults['chart_defaults'],
            methodology=defaults['methodology'],
            visual=defaults['visual'],
            chart_creation_defaults=defaults['chart_creation_defaults'],
        )
        self.db.add(record)
        self.db.flush()
        return record

    def get_account_preferences(self, astrologer: Astrologer) -> Dict[str, Any]:
        record = self.get_or_create_account_record(astrologer)
        default_house_system = normalize_house_system_code(astrologer.default_house_system)
        defaults = build_default_preferences(default_house_system)
        runtime_payload = self.runtime.get_account_payload(
            astrologer.id,
            default_house_system=default_house_system,
        )
        payload = {
            'version': record.version,
            'chart_defaults': deep_merge_dicts(defaults['chart_defaults'], record.chart_defaults or {}),
            'methodology': runtime_payload.get('methodology', {}) or {},
            'visual': runtime_payload.get('visual', {}) or {},
            'chart_creation_defaults': {
                **(runtime_payload.get('chart_creation_defaults', {}) or {}),
                'house_system': normalize_house_system_code(
                    (runtime_payload.get('chart_creation_defaults', {}) or {}).get('house_system')
                    or default_house_system
                ),
            },
        }
        payload['chart_creation_defaults']['house_system'] = normalize_house_system_code(
            payload['chart_creation_defaults'].get('house_system') or astrologer.default_house_system
        )
        payload['default_house_system'] = payload['chart_creation_defaults']['house_system']
        return payload

    def patch_account_preferences(self, astrologer: Astrologer, patch: Dict[str, Any]) -> Dict[str, Any]:
        record = self.get_or_create_account_record(astrologer)
        current = self.get_account_preferences(astrologer)
        merged = deep_merge_dicts(current, patch or {})
        house_system = normalize_house_system_code(
            merged.get('chart_creation_defaults', {}).get('house_system') or astrologer.default_house_system
        )

        astrologer.default_house_system = house_system
        record.version = PREFERENCE_VERSION
        record.chart_defaults = merged.get('chart_defaults', {})
        record.methodology = normalize_methodology_settings(
            merged.get('methodology', {}) or {},
            default_methodology=self.runtime.build_default_methodology(),
        )
        record.visual = merged.get('visual', {})
        record.chart_creation_defaults = {
            **(merged.get('chart_creation_defaults', {}) or {}),
            'house_system': house_system,
        }
        self.runtime.invalidate(astrologer.id)
        self.db.flush()
        return self.get_account_preferences(astrologer)

    def get_preferences_metadata(self) -> Dict[str, Any]:
        return self.runtime.get_metadata()

    def get_chart_view_override(
        self,
        *,
        chart_kind: str,
        chart_id: UUID,
        view_type: str,
    ) -> Optional[ChartViewOverride]:
        return (
            self.db.query(ChartViewOverride)
            .filter(
                ChartViewOverride.chart_kind == chart_kind,
                ChartViewOverride.chart_id == chart_id,
                ChartViewOverride.view_type == view_type,
            )
            .first()
        )

    def upsert_chart_view_override(
        self,
        *,
        chart_kind: str,
        chart_id: UUID,
        view_type: str,
        overrides: Dict[str, Any],
    ) -> Dict[str, Any]:
        record = self.get_chart_view_override(chart_kind=chart_kind, chart_id=chart_id, view_type=view_type)
        if record is None:
            record = ChartViewOverride(
                chart_kind=chart_kind,
                chart_id=chart_id,
                view_type=view_type,
                overrides=overrides or {},
            )
            self.db.add(record)
        else:
            record.overrides = overrides or {}
        self.db.flush()
        return record.overrides or {}

    def delete_chart_view_override(
        self,
        *,
        chart_kind: str,
        chart_id: UUID,
        view_type: str,
    ) -> bool:
        record = self.get_chart_view_override(chart_kind=chart_kind, chart_id=chart_id, view_type=view_type)
        if record is None:
            return False
        self.db.delete(record)
        self.db.flush()
        return True

    def resolve_chart_meta(
        self,
        astrologer: Astrologer,
        *,
        chart_kind: str,
        chart_id: UUID,
        view_type: str,
    ) -> Dict[str, Any]:
        if chart_kind not in CHART_KINDS:
            raise ValueError(f'Unsupported chart_kind: {chart_kind}')
        if view_type not in VIEW_TYPES:
            raise ValueError(f'Unsupported view_type: {view_type}')

        if chart_kind == 'natal':
            user = (
                self.db.query(User)
                .filter(User.user_id == chart_id, User.astrologer_id == astrologer.id)
                .first()
            )
            if user is None:
                raise ValueError('Chart not found')
            return {
                'chart_kind': chart_kind,
                'chart_id': user.user_id,
                'view_type': view_type,
                'house_system': normalize_house_system_code(user.house_system or astrologer.default_house_system),
                'user_id': str(user.user_id),
            }

        solar = (
            self.db.query(SolarReturn)
            .join(User, User.user_id == SolarReturn.user_id)
            .filter(SolarReturn.solar_id == chart_id, User.astrologer_id == astrologer.id)
            .first()
        )
        if solar is None:
            raise ValueError('Chart not found')
        return {
            'chart_kind': chart_kind,
            'chart_id': solar.solar_id,
            'view_type': view_type,
            'house_system': normalize_house_system_code(solar.house_system or astrologer.default_house_system),
            'user_id': str(solar.user_id),
            'solar_id': str(solar.solar_id),
            'solar_year': solar.year,
        }

    def resolve_preferences(
        self,
        astrologer: Astrologer,
        *,
        chart_kind: str,
        chart_id: UUID,
        view_type: str,
    ) -> Dict[str, Any]:
        account = self.get_account_preferences(astrologer)
        account_defaults = deepcopy(account.get('chart_defaults', {}).get(view_type, {}))
        override_record = self.get_chart_view_override(chart_kind=chart_kind, chart_id=chart_id, view_type=view_type)
        overrides = deepcopy(override_record.overrides if override_record else {})
        resolved = deep_merge_dicts(account_defaults, overrides)
        return {
            'chart_kind': chart_kind,
            'chart_id': chart_id,
            'view_type': view_type,
            'account_defaults': account_defaults,
            'overrides': overrides,
            'resolved': resolved,
            'chart_meta': self.resolve_chart_meta(astrologer, chart_kind=chart_kind, chart_id=chart_id, view_type=view_type),
        }
