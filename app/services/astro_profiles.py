"""
Versioned body/target profiles for broad forecast surveys (chat-v2 slice 1).

Why a new registry instead of reusing ``TRANSIT_FOCUSED_*`` from utils.constants:
those drive the alerts/timeline feature and changing them would silently change
alerting. These are the assistant's product defaults, versioned so a survey stays
reproducible after the defaults move — a survey persists its profile id, and
``broad_default_v2`` can land later without rewriting what past answers meant.

Product decisions encoded here (owner-approved):
- ``outer_planets`` includes Chiron. Schools differ; this profile does not.
- ``broad_default_v1`` targets the ten planets, the four angles, both nodes and
  Lilith. Part of Fortune is excluded. Non-angle house cusps stay available for
  house computation and hand-built profiles but are NOT default aspect targets.
"""
from __future__ import annotations

from typing import Dict, Tuple

# --- transiting bodies -------------------------------------------------------
TRANSIT_BODY_PROFILES: Dict[str, Tuple[str, ...]] = {
    "outer_planets": ("Uranus", "Neptune", "Pluto", "Chiron"),
    "slow_planets": ("Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron"),
    "social_planets": ("Jupiter", "Saturn"),
    "personal_planets": ("Sun", "Moon", "Mercury", "Venus", "Mars"),
    "all_planets": (
        "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
        "Uranus", "Neptune", "Pluto",
    ),
}

# --- natal targets -----------------------------------------------------------
NATAL_TARGET_PROFILES: Dict[str, Tuple[str, ...]] = {
    "broad_default_v1": (
        # ten planets
        "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
        "Uranus", "Neptune", "Pluto",
        # the four angles only — other cusps are not default aspect targets
        "ASC", "DSC", "MC", "IC",
        # nodes + Lilith
        "TrueNorthNode", "TrueSouthNode", "BlackMoon",
    ),
    "angles_only": ("ASC", "DSC", "MC", "IC"),
    "luminaries_and_angles": ("Sun", "Moon", "ASC", "DSC", "MC", "IC"),
}

DEFAULT_TRANSIT_PROFILE = "outer_planets"
DEFAULT_TARGET_PROFILE = "broad_default_v1"

# The five Ptolemaic aspects. A broad survey across 18 aspect types would bury
# the astrologer; minor aspects stay opt-in via explicit aspect_types.
DEFAULT_ASPECT_TYPES: Tuple[str, ...] = (
    "Conjunction", "Sextile", "Square", "Trine", "Opposition",
)

# Angles come in pairs: a contact to one is geometrically a contact to the other.
# Both are real records; the group lets a survey say "one axis activation" without
# double-counting or collapsing them.
_AXIS_GROUPS = {
    "ASC": "ASC-DSC", "DSC": "ASC-DSC",
    "MC": "MC-IC", "IC": "MC-IC",
}


def axis_group_for(natal_body: str):
    """The axis a natal target belongs to, or None for non-angles."""
    return _AXIS_GROUPS.get(natal_body)


def resolve_transit_bodies(profile: str = None, explicit=None) -> Tuple[str, ...]:
    """Explicit list wins; otherwise the named profile. Unknown name raises.

    Raising (rather than silently defaulting) matters: a model typo like
    "outer_planet" must surface as an error, not quietly survey the wrong set and
    hand back a confident answer about the wrong bodies.
    """
    if explicit:
        return tuple(explicit)
    name = profile or DEFAULT_TRANSIT_PROFILE
    if name not in TRANSIT_BODY_PROFILES:
        raise ValueError(f"unknown_transit_profile:{name}")
    return TRANSIT_BODY_PROFILES[name]


def resolve_natal_targets(profile: str = None, explicit=None) -> Tuple[str, ...]:
    """Explicit list wins; otherwise the named profile. Unknown name raises."""
    if explicit:
        return tuple(explicit)
    name = profile or DEFAULT_TARGET_PROFILE
    if name not in NATAL_TARGET_PROFILES:
        raise ValueError(f"unknown_target_profile:{name}")
    return NATAL_TARGET_PROFILES[name]
