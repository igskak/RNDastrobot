"""Shared runtime helpers for methodology and visual account preferences."""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
import math
from typing import Any, Dict, Iterable, List, Literal, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models import AstrologerPreference, RefAspectType, RefPlanetOrb, RefSignProperties, User
from app.utils.constants import PROGNOSTIC_DEFAULT_ORB, PROGNOSTIC_MOON_ORB


CANONICAL_BODIES = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
    'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    'Chiron', 'Proserpina',
    'TrueNode', 'SouthNode',
    'BlackMoon', 'WhiteMoon', 'PartOfFortune',
    'ASC', 'DSC', 'MC', 'IC', 'Vertex', 'AntiVertex',
]

CANONICAL_SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer',
    'Leo', 'Virgo', 'Libra', 'Scorpio',
    'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]

OPPOSITE_SIGN_BY_SIGN: Dict[str, str] = {
    'Aries': 'Libra',
    'Taurus': 'Scorpio',
    'Gemini': 'Sagittarius',
    'Cancer': 'Capricorn',
    'Leo': 'Aquarius',
    'Virgo': 'Pisces',
    'Libra': 'Aries',
    'Scorpio': 'Taurus',
    'Sagittarius': 'Gemini',
    'Capricorn': 'Cancer',
    'Aquarius': 'Leo',
    'Pisces': 'Virgo',
}

DIGNITY_BODY_IDS = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
    'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    'Chiron', 'Proserpina',
]

BODY_ALIAS_CANDIDATES: Dict[str, List[str]] = {
    'TrueNode': ['TrueNode', 'TrueNorthNode'],
    'SouthNode': ['SouthNode', 'TrueSouthNode'],
    'PartOfFortune': ['PartOfFortune', 'Fortune'],
}

DEFAULT_BALANCE_PLANET_WEIGHTS: Dict[str, float] = {
    'Sun': 2.0,
    'Moon': 2.0,
    'Mercury': 1.5,
    'Venus': 1.5,
    'Mars': 1.5,
    'Jupiter': 1.0,
    'Saturn': 1.0,
    'Uranus': 1.0,
    'Neptune': 1.0,
    'Pluto': 1.0,
    'Chiron': 0.8,
    'Proserpina': 1.0,
}

DEFAULT_BALANCE_SPECIAL_POINT_WEIGHTS: Dict[str, float] = {
    'TrueNorthNode': 0.5,
    'TrueSouthNode': 0.5,
    'BlackMoon': 0.5,
}

DEFAULT_ELEMENT_PALETTE: Dict[str, str] = {
    'Fire': '#ef4444',
    'Earth': '#84cc16',
    'Air': '#f59e0b',
    'Water': '#3b82f6',
}

DEFAULT_BODY_COLOR_OVERRIDES: Dict[str, str] = {}
DEFAULT_TIMEZONE_LABEL_FORMAT = 'UTC'

DEFAULT_ASPECT_COLOR_BY_TYPE: Dict[str, str] = {
    'Conjunction': '#f59e0b',
    'Opposition': '#ef4444',
    'Square': '#ef4444',
    'Trine': '#3b82f6',
    'Sextile': '#22c55e',
    'Quincunx': '#8b5cf6',
    'Semisextile': '#14b8a6',
    'Quintile': '#ec4899',
    'Biquintile': '#ec4899',
    'Semisquare': '#f97316',
    'Sesquiquadrate': '#f97316',
}

DEFAULT_STATIONARY_THRESHOLD_PERCENT = 10.0
ORB_PROFILE_IDS = ('natal', 'prognostic')
DEFAULT_ORB_PAIR_STRATEGY = 'larger'
ORB_PAIR_STRATEGY_ALIASES: Dict[str, str] = {
    'larger': 'larger',
    'greater': 'larger',
    'max': 'larger',
    'maximum': 'larger',
    'smaller': 'smaller',
    'lesser': 'smaller',
    'min': 'smaller',
    'minimum': 'smaller',
    'average': 'average',
    'avg': 'average',
    'mean': 'average',
}

BODY_REVERSE_LOOKUP: Dict[str, str] = {}
for canonical_body in CANONICAL_BODIES:
    BODY_REVERSE_LOOKUP[canonical_body] = canonical_body
    for candidate in BODY_ALIAS_CANDIDATES.get(canonical_body, []):
        BODY_REVERSE_LOOKUP[candidate] = canonical_body


def deep_merge_dicts(base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
    result = deepcopy(base)
    for key, value in (overlay or {}).items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge_dicts(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result


def normalize_body_name(name: Optional[str]) -> Optional[str]:
    if not name:
        return name
    return BODY_REVERSE_LOOKUP.get(str(name), str(name))


def get_body_alias_candidates(name: Optional[str]) -> List[str]:
    canonical = normalize_body_name(name)
    if not canonical:
        return []
    aliases = BODY_ALIAS_CANDIDATES.get(canonical, [])
    ordered: List[str] = []
    for candidate in [canonical, *aliases]:
        if candidate not in ordered:
            ordered.append(candidate)
    return ordered


def stable_hash(value: Any) -> str:
    serialized = json.dumps(value or {}, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
    return hashlib.sha256(serialized.encode('utf-8')).hexdigest()


def build_default_balance_settings() -> Dict[str, Any]:
    return {
        'version': 1,
        'planet_weights': deepcopy(DEFAULT_BALANCE_PLANET_WEIGHTS),
        'special_point_weights': deepcopy(DEFAULT_BALANCE_SPECIAL_POINT_WEIGHTS),
    }


def build_default_dignity_settings(sign_properties: Iterable[RefSignProperties]) -> Dict[str, Any]:
    signs: Dict[str, Dict[str, Optional[str]]] = {}
    for sign in sign_properties:
        signs[str(sign.sign)] = {
            'ruler': str(sign.ruler) if sign.ruler else None,
            'co_ruler': str(sign.co_ruler) if sign.co_ruler else None,
            'exaltation': str(sign.exaltation) if sign.exaltation else None,
        }

    for sign_name in CANONICAL_SIGNS:
        signs.setdefault(sign_name, {
            'ruler': None,
            'co_ruler': None,
            'exaltation': None,
        })

    return {
        'version': 1,
        'signs': signs,
    }


def normalize_stationary_threshold_percent(value: Any, *, default: float = DEFAULT_STATIONARY_THRESHOLD_PERCENT) -> float:
    try:
        normalized = float(value)
    except (TypeError, ValueError):
        return float(default)
    if not math.isfinite(normalized):
        return float(default)
    return max(0.0, min(100.0, normalized))


def build_default_stationary_settings() -> Dict[str, Any]:
    return {
        'threshold_percent': DEFAULT_STATIONARY_THRESHOLD_PERCENT,
    }


def build_default_visual_settings(aspect_types: Iterable[RefAspectType]) -> Dict[str, Any]:
    aspect_colors: Dict[str, str] = {}
    for aspect_type in aspect_types:
        fallback_color = DEFAULT_ASPECT_COLOR_BY_TYPE.get(aspect_type.aspect_type)
        if fallback_color is None:
            fallback_color = '#9ca3af'
        aspect_colors[aspect_type.aspect_type] = fallback_color

    return {
        'aspect_colors': aspect_colors,
        'planet_colors': {
            'element_palette': deepcopy(DEFAULT_ELEMENT_PALETTE),
            'body_overrides': deepcopy(DEFAULT_BODY_COLOR_OVERRIDES),
        },
        'timezone_label_format': DEFAULT_TIMEZONE_LABEL_FORMAT,
    }


def build_default_orb_settings(
    aspect_types: Iterable[RefAspectType],
    planet_orbs: Iterable[RefPlanetOrb],
) -> Dict[str, Any]:
    orb_lookup = {
        (orb.planet, orb.aspect_type): float(orb.orb)
        for orb in planet_orbs
    }
    natal_matrix: Dict[str, Dict[str, float]] = {}
    prognostic_matrix: Dict[str, Dict[str, float]] = {}
    for aspect_type in aspect_types:
        aspect_name = aspect_type.aspect_type
        base_orb = float(aspect_type.base_orb)
        natal_matrix[aspect_name] = {}
        prognostic_matrix[aspect_name] = {}
        for body in CANONICAL_BODIES:
            value = None
            for candidate in get_body_alias_candidates(body):
                if (candidate, aspect_name) in orb_lookup:
                    value = orb_lookup[(candidate, aspect_name)]
                    break
            natal_matrix[aspect_name][body] = float(value if value is not None else base_orb)
            prognostic_matrix[aspect_name][body] = (
                float(PROGNOSTIC_MOON_ORB) if body == 'Moon' else float(PROGNOSTIC_DEFAULT_ORB)
            )

    return {
        'version': 2,
        'pair_strategy': DEFAULT_ORB_PAIR_STRATEGY,
        'profiles': {
            'natal': {
                'matrix': deepcopy(natal_matrix),
            },
            'prognostic': {
                'matrix': deepcopy(prognostic_matrix),
            },
        },
    }


def normalize_orb_pair_strategy(value: Optional[str]) -> str:
    normalized = str(value or '').strip().lower()
    return ORB_PAIR_STRATEGY_ALIASES.get(normalized, DEFAULT_ORB_PAIR_STRATEGY)


def resolve_orb_pair_value(values: Iterable[float], pair_strategy: Optional[str]) -> Optional[float]:
    resolved_values = [float(value) for value in values if value is not None]
    if not resolved_values:
        return None
    if len(resolved_values) == 1:
        return resolved_values[0]

    strategy = normalize_orb_pair_strategy(pair_strategy)
    if strategy == 'smaller':
        return min(resolved_values)
    if strategy == 'average':
        return sum(resolved_values) / len(resolved_values)
    return max(resolved_values)


def normalize_orb_settings(
    orbs: Optional[Dict[str, Any]] = None,
    *,
    default_orbs: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    default_profiles = ((default_orbs or {}).get('profiles') or {}) if isinstance(default_orbs, dict) else {}
    pair_strategy = normalize_orb_pair_strategy(
        (orbs or {}).get('pair_strategy')
        or ((default_orbs or {}).get('pair_strategy') if isinstance(default_orbs, dict) else None)
    )
    legacy_matrix = deepcopy((orbs or {}).get('matrix') or {})
    source_profiles = (orbs or {}).get('profiles') or {}
    normalized_profiles: Dict[str, Dict[str, Dict[str, float]]] = {}

    for profile_id in ORB_PROFILE_IDS:
        default_matrix = deepcopy((default_profiles.get(profile_id) or {}).get('matrix') or {})
        source_matrix = deepcopy((source_profiles.get(profile_id) or {}).get('matrix') or {})
        if not source_matrix and legacy_matrix:
            source_matrix = deepcopy(legacy_matrix)
        normalized_profiles[profile_id] = {
            'matrix': deep_merge_dicts(default_matrix, source_matrix),
        }

    return {
        'version': 2,
        'pair_strategy': pair_strategy,
        'profiles': normalized_profiles,
    }


def normalize_dignity_settings(
    dignities: Optional[Dict[str, Any]] = None,
    *,
    default_dignities: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    default_signs = ((default_dignities or {}).get('signs') or {}) if isinstance(default_dignities, dict) else {}
    source_signs = (dignities or {}).get('signs') or {}
    normalized_signs: Dict[str, Dict[str, Optional[str]]] = {}

    for sign_name in CANONICAL_SIGNS:
        default_entry = deepcopy(default_signs.get(sign_name) or {})
        source_entry = deepcopy(source_signs.get(sign_name) or {})
        merged_entry = deep_merge_dicts(default_entry, source_entry)

        ruler = normalize_body_name(merged_entry.get('ruler'))
        co_ruler = normalize_body_name(merged_entry.get('co_ruler'))
        exaltation = normalize_body_name(merged_entry.get('exaltation'))

        if ruler == co_ruler:
            co_ruler = None

        normalized_signs[sign_name] = {
            'ruler': ruler,
            'co_ruler': co_ruler,
            'exaltation': exaltation,
        }

    return {
        'version': 1,
        'signs': normalized_signs,
    }


def normalize_methodology_settings(
    methodology: Optional[Dict[str, Any]] = None,
    *,
    default_methodology: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    default_methodology = deepcopy(default_methodology or {})
    default_orbs = deepcopy(default_methodology.get('orbs') or {})
    default_balances = deepcopy(default_methodology.get('balances') or {})
    default_stationary = deepcopy(default_methodology.get('stationary') or {})
    default_dignities = deepcopy(default_methodology.get('dignities') or {})
    balances = deep_merge_dicts(default_balances, (methodology or {}).get('balances') or {})
    stationary = deep_merge_dicts(default_stationary, (methodology or {}).get('stationary') or {})

    return {
        'orbs': normalize_orb_settings((methodology or {}).get('orbs') or {}, default_orbs=default_orbs),
        'balances': {
            'version': int(balances.get('version') or 1),
            'planet_weights': deepcopy(balances.get('planet_weights') or {}),
            'special_point_weights': deepcopy(balances.get('special_point_weights') or {}),
        },
        'stationary': {
            'threshold_percent': normalize_stationary_threshold_percent(
                stationary.get('threshold_percent'),
                default=default_stationary.get('threshold_percent', DEFAULT_STATIONARY_THRESHOLD_PERCENT),
            ),
        },
        'dignities': normalize_dignity_settings(
            (methodology or {}).get('dignities') or {},
            default_dignities=default_dignities,
        ),
    }


def apply_fixed_prognostic_defaults(
    methodology: Optional[Dict[str, Any]] = None,
    *,
    default_methodology: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    default_methodology = deepcopy(default_methodology or {})
    normalized = normalize_methodology_settings(
        methodology or {},
        default_methodology=default_methodology,
    )
    default_prognostic = deepcopy(
        (
            (default_methodology.get('orbs') or {})
            .get('profiles', {})
            .get('prognostic', {})
        )
        or {'matrix': {}}
    )

    normalized_orbs = deepcopy(normalized.get('orbs') or {})
    normalized_profiles = deepcopy(normalized_orbs.get('profiles') or {})
    normalized_profiles['prognostic'] = default_prognostic
    normalized_orbs['profiles'] = normalized_profiles
    normalized['orbs'] = normalized_orbs

    return normalize_methodology_settings(
        normalized,
        default_methodology=default_methodology,
    )


class PreferencesRuntimeResolver:
    """Resolve methodology + visual defaults and runtime lookups for an astrologer."""

    def __init__(self, db: Session):
        self.db = db
        self._aspect_types_cache: Optional[List[RefAspectType]] = None
        self._planet_orbs_cache: Optional[List[RefPlanetOrb]] = None
        self._record_cache: Dict[UUID, Optional[AstrologerPreference]] = {}
        self._payload_cache: Dict[UUID, Dict[str, Any]] = {}
        self._user_astrologer_cache: Dict[UUID, Optional[UUID]] = {}
        self._default_methodology_cache: Optional[Dict[str, Any]] = None
        self._default_visual_cache: Optional[Dict[str, Any]] = None
        self._normalized_orb_settings_cache: Dict[Tuple[UUID, str], Dict[str, Any]] = {}

    def _get_aspect_types(self) -> List[RefAspectType]:
        if self._aspect_types_cache is None:
            self._aspect_types_cache = self.db.query(RefAspectType).order_by(RefAspectType.exact_angle.asc()).all()
        return self._aspect_types_cache

    def _get_planet_orbs(self) -> List[RefPlanetOrb]:
        if self._planet_orbs_cache is None:
            self._planet_orbs_cache = self.db.query(RefPlanetOrb).all()
        return self._planet_orbs_cache

    def _get_default_methodology_cached(self) -> Dict[str, Any]:
        if self._default_methodology_cache is None:
            self._default_methodology_cache = {
                'orbs': build_default_orb_settings(self._get_aspect_types(), self._get_planet_orbs()),
                'balances': build_default_balance_settings(),
                'stationary': build_default_stationary_settings(),
                'dignities': build_default_dignity_settings(
                    self.db.query(RefSignProperties).order_by(RefSignProperties.sign.asc()).all()
                ),
            }
        return self._default_methodology_cache

    def build_default_methodology(self) -> Dict[str, Any]:
        return deepcopy(self._get_default_methodology_cached())

    def _get_default_visual_cached(self) -> Dict[str, Any]:
        if self._default_visual_cache is None:
            self._default_visual_cache = build_default_visual_settings(self._get_aspect_types())
        return self._default_visual_cache

    def build_default_visual(self) -> Dict[str, Any]:
        return deepcopy(self._get_default_visual_cached())

    def get_metadata(self) -> Dict[str, Any]:
        aspect_types = self._get_aspect_types()
        methodology = self.build_default_methodology()
        visual = self.build_default_visual()
        return {
            'aspect_types': [
                {
                    'aspect_type': aspect.aspect_type,
                    'exact_angle': float(aspect.exact_angle),
                    'base_orb': float(aspect.base_orb),
                    'class': aspect.class_,
                    'character': aspect.character,
                    'default_color': visual['aspect_colors'].get(aspect.aspect_type, '#9ca3af'),
                }
                for aspect in aspect_types
            ],
            'bodies': [
                {
                    'name': body,
                    'aliases': get_body_alias_candidates(body),
                }
                for body in CANONICAL_BODIES
            ],
            'signs': [
                {
                    'name': sign_name,
                    'opposite': OPPOSITE_SIGN_BY_SIGN[sign_name],
                }
                for sign_name in CANONICAL_SIGNS
            ],
            'default_balance_targets': deepcopy(methodology['balances']),
            'default_visual_palettes': deepcopy(visual),
            'default_dignities': deepcopy(methodology['dignities']),
        }

    def _get_record(self, astrologer_id: UUID) -> Optional[AstrologerPreference]:
        if astrologer_id not in self._record_cache:
            self._record_cache[astrologer_id] = (
                self.db.query(AstrologerPreference)
                .filter(AstrologerPreference.astrologer_id == astrologer_id)
                .first()
            )
        return self._record_cache[astrologer_id]

    def _get_cached_account_payload(
        self,
        astrologer_id: UUID,
        *,
        default_house_system: str = 'P',
    ) -> Dict[str, Any]:
        if astrologer_id in self._payload_cache:
            return self._payload_cache[astrologer_id]

        defaults = {
            'version': 1,
            'chart_defaults': {},
            'methodology': deepcopy(self._get_default_methodology_cached()),
            'visual': deepcopy(self._get_default_visual_cached()),
            'chart_creation_defaults': {
                'house_system': default_house_system,
            },
        }
        record = self._get_record(astrologer_id)
        overlay = {
            'version': getattr(record, 'version', 1),
            'chart_defaults': getattr(record, 'chart_defaults', {}) or {},
            'methodology': getattr(record, 'methodology', {}) or {},
            'visual': getattr(record, 'visual', {}) or {},
            'chart_creation_defaults': getattr(record, 'chart_creation_defaults', {}) or {},
        }
        payload = deep_merge_dicts(defaults, overlay)
        payload['methodology'] = normalize_methodology_settings(
            payload.get('methodology') or {},
            default_methodology=defaults['methodology'],
        )
        self._payload_cache[astrologer_id] = deepcopy(payload)
        return self._payload_cache[astrologer_id]

    def get_account_payload(
        self,
        astrologer_id: UUID,
        *,
        default_house_system: str = 'P',
    ) -> Dict[str, Any]:
        return deepcopy(
            self._get_cached_account_payload(
                astrologer_id,
                default_house_system=default_house_system,
            )
        )

    def invalidate(self, astrologer_id: UUID) -> None:
        self._record_cache.pop(astrologer_id, None)
        self._payload_cache.pop(astrologer_id, None)
        for cache_key in list(self._normalized_orb_settings_cache.keys()):
            if cache_key[0] == astrologer_id:
                self._normalized_orb_settings_cache.pop(cache_key, None)

    def get_astrologer_id_for_user(self, user_id: UUID) -> Optional[UUID]:
        if user_id not in self._user_astrologer_cache:
            value = (
                self.db.query(User.astrologer_id)
                .filter(User.user_id == user_id)
                .scalar()
            )
            self._user_astrologer_cache[user_id] = value
        return self._user_astrologer_cache[user_id]

    def get_methodology_hash_for_astrologer(self, astrologer_id: UUID, *, default_house_system: str = 'P') -> str:
        payload = self._get_cached_account_payload(astrologer_id, default_house_system=default_house_system)
        return stable_hash(payload.get('methodology') or {})

    def get_dignity_settings_for_astrologer(
        self,
        astrologer_id: UUID,
        *,
        default_house_system: str = 'P',
    ) -> Dict[str, Any]:
        payload = self._get_cached_account_payload(astrologer_id, default_house_system=default_house_system)
        return deepcopy(
            normalize_dignity_settings(
                payload.get('methodology', {}).get('dignities') or {},
                default_dignities=self._get_default_methodology_cached().get('dignities') or {},
            )
        )

    def get_methodology_hash_for_user(self, user_id: UUID, *, default_house_system: str = 'P') -> str:
        astrologer_id = self.get_astrologer_id_for_user(user_id)
        if not astrologer_id:
            return stable_hash({})
        return self.get_methodology_hash_for_astrologer(astrologer_id, default_house_system=default_house_system)

    def get_balance_weights_for_astrologer(
        self,
        astrologer_id: UUID,
        *,
        default_house_system: str = 'P',
    ) -> Tuple[Dict[str, float], Dict[str, float]]:
        payload = self._get_cached_account_payload(astrologer_id, default_house_system=default_house_system)
        balances = payload.get('methodology', {}).get('balances', {}) or {}
        return (
            {
                key: float(value)
                for key, value in (balances.get('planet_weights') or {}).items()
            },
            {
                key: float(value)
                for key, value in (balances.get('special_point_weights') or {}).items()
            },
        )

    def get_stationary_threshold_for_astrologer(
        self,
        astrologer_id: UUID,
        *,
        default_house_system: str = 'P',
    ) -> float:
        payload = self._get_cached_account_payload(astrologer_id, default_house_system=default_house_system)
        stationary = payload.get('methodology', {}).get('stationary', {}) or {}
        return normalize_stationary_threshold_percent(stationary.get('threshold_percent'))

    def _get_normalized_orb_settings_for_astrologer(
        self,
        astrologer_id: UUID,
        *,
        default_house_system: str = 'P',
    ) -> Dict[str, Any]:
        cache_key = (astrologer_id, default_house_system)
        if cache_key not in self._normalized_orb_settings_cache:
            payload = self._get_cached_account_payload(
                astrologer_id,
                default_house_system=default_house_system,
            )
            self._normalized_orb_settings_cache[cache_key] = normalize_orb_settings(
                payload.get('methodology', {}).get('orbs', {}) or {},
                default_orbs=self._get_default_methodology_cached()['orbs'],
            )
        return self._normalized_orb_settings_cache[cache_key]

    def get_stationary_threshold_for_user(self, user_id: UUID, *, default_house_system: str = 'P') -> float:
        astrologer_id = self.get_astrologer_id_for_user(user_id)
        if not astrologer_id:
            return DEFAULT_STATIONARY_THRESHOLD_PERCENT
        return self.get_stationary_threshold_for_astrologer(astrologer_id, default_house_system=default_house_system)

    def resolve_orb_for_astrologer(
        self,
        astrologer_id: UUID,
        body_a: str,
        body_b: str,
        aspect_type: str,
        *,
        orb_profile: Literal['natal', 'prognostic'] = 'natal',
        default_house_system: str = 'P',
    ) -> float:
        normalized_orbs = self._get_normalized_orb_settings_for_astrologer(
            astrologer_id,
            default_house_system=default_house_system,
        )
        pair_strategy = normalized_orbs.get('pair_strategy')
        matrix = normalized_orbs.get('profiles', {}).get(orb_profile, {}).get('matrix', {}) or {}
        aspect_matrix = matrix.get(aspect_type, {}) or {}

        resolved_values: List[float] = []
        for body in (body_a, body_b):
            canonical = normalize_body_name(body) or str(body)
            value = aspect_matrix.get(canonical)
            if value is None:
                for candidate in get_body_alias_candidates(body):
                    value = aspect_matrix.get(candidate)
                    if value is not None:
                        break
            if value is not None:
                resolved_values.append(float(value))

        resolved_orb = resolve_orb_pair_value(resolved_values, pair_strategy)
        if resolved_orb is not None:
            return resolved_orb

        default_matrix = self._get_default_methodology_cached()['orbs']['profiles'][orb_profile]['matrix']
        fallback_values = []
        for body in (body_a, body_b):
            canonical = normalize_body_name(body) or str(body)
            fallback = default_matrix.get(aspect_type, {}).get(canonical)
            if fallback is not None:
                fallback_values.append(float(fallback))

        fallback_orb = resolve_orb_pair_value(fallback_values, pair_strategy)
        if fallback_orb is not None:
            return fallback_orb

        return 5.0
