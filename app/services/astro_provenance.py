"""
Methodology provenance + computed/effective override schema (chat-v2 slice 1).

Two jobs, both about reproducibility:

1. ``build_methodology_provenance`` resolves WHICH methodology produced a turn's
   numbers — the stable content hash plus the handful of settings that actually
   change a calculation. Attached to every server-executed tool result and
   persisted on the turn, so an answer stays reconcilable after the astrologer
   edits their orbs. Without it, a past answer is unreproducible the moment
   settings change (the hash already existed; it was just never captured here).

2. ``overridable`` is the ONE shape for a value an astrologer may override for
   their working method. The computed value is never destroyed: checks read
   ``computed_value``, user-facing formulas read ``effective_value``. Landing the
   schema before any producer exists keeps a second, incompatible shape from
   appearing later.

Resolved settings report what the system ACTUALLY stores (orb profile + source,
stationary threshold, dignity/rulership customization, house system). Full
versioned methodology history is a later stage; this is the minimum that makes a
number auditable today.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional
from uuid import UUID

from loguru import logger

# The rulership table lives in methodology.dignities.signs; a per-sign entry that
# differs from the account default means the astrologer customized rulers.
_DIGNITY_KEYS = ("ruler", "co_ruler", "exaltation")


def overridable(
    field: str,
    computed: Any,
    effective: Any = None,
    *,
    source: Optional[str] = None,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """One value that an astrologer's working method may override.

    ``effective=None`` means no override: effective mirrors computed and
    ``override_applied`` is False. Passing an explicit effective value marks the
    override and records who set it and why. The computed value always survives.
    """
    applied = effective is not None and effective != computed
    return {
        "field": field,
        "computed_value": computed,
        "effective_value": effective if effective is not None else computed,
        "override_applied": applied,
        "override_type": "manual" if applied else None,
        "override_source": (source or "astrologer") if applied else None,
        "override_reason": reason if applied else None,
    }


def _rulership_summary(runtime, astrologer_id: Optional[UUID], house_system: str) -> Dict[str, Any]:
    """How far the astrologer's rulership table drifts from the account default.

    Reported as a count rather than the whole table: the hash already pins the
    exact content, and a 12-sign table would bloat every tool result.
    """
    if astrologer_id is None:
        return {"source": "default", "customized_signs": 0}
    try:
        resolved = runtime.get_dignity_settings_for_astrologer(
            astrologer_id, default_house_system=house_system) or {}
        defaults = (runtime.build_default_methodology() or {}).get("dignities") or {}
        resolved_signs = resolved.get("signs") or {}
        default_signs = defaults.get("signs") or {}
        customized = sum(
            1
            for sign, entry in resolved_signs.items()
            if any((entry or {}).get(k) != ((default_signs.get(sign) or {}).get(k))
                   for k in _DIGNITY_KEYS)
        )
        return {
            "source": "astrologer_settings" if customized else "default",
            "customized_signs": customized,
        }
    except Exception:
        logger.exception("rulership summary failed")
        return {"source": "unknown", "customized_signs": None}


def build_methodology_provenance(
    runtime,
    user_id: UUID,
    *,
    orb_profile: str = "prognostic",
    house_system: str = "P",
) -> Dict[str, Any]:
    """Resolve the methodology fingerprint for one chart, for one turn.

    ``runtime`` is a PreferencesRuntimeResolver. Never raises: provenance is
    audit metadata, and losing it must not fail a chat turn that otherwise has
    correct numbers. A failure degrades to a null hash the caller can spot.
    """
    try:
        astrologer_id = runtime.get_astrologer_id_for_user(user_id)
        methodology_hash = runtime.get_methodology_hash_for_user(
            user_id, default_house_system=house_system)
        threshold = runtime.get_stationary_threshold_for_user(
            user_id, default_house_system=house_system)
        return {
            "methodology_hash": methodology_hash,
            "resolved_settings": {
                # Short form for display. Given only the full sha256, a reply
                # quotes all 64 characters into the astrologer's scope line.
                "methodology_version": (methodology_hash or "")[:12] or None,
                "orb_profile": orb_profile,
                "orb_source": "astrologer_settings" if astrologer_id else "default",
                "stationary_threshold_percent": threshold,
                "house_system": house_system,
                "rulership": _rulership_summary(runtime, astrologer_id, house_system),
            },
        }
    except Exception:
        logger.exception("methodology provenance resolution failed")
        return {"methodology_hash": None, "resolved_settings": None}


# Digit lookarounds, not \b: engine values are full timestamps like
# 2027-06-30T08:00:00+02:00, and a trailing \b fails against the "T" — which
# would make every engine date look ungrounded and flag every reply.
_ISO_DATE_RE = re.compile(r"(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)")


def unsupported_dates(reply: str, tool_results: Any) -> list:
    """ISO dates asserted in the reply that appear nowhere in the tool results.

    A cheap deterministic grounding check for the one case where a fabricated
    number is both likely and unambiguous: the model writing an ISO date it did
    not receive. Restricted to ISO on purpose — if the model writes 2027-03-20 it
    is almost certainly copying an engine value, so a mismatch is meaningful,
    whereas "март 2027" could be a fair rendering of a real date and flagging it
    would be noise.

    Reports only. Blocking on this before knowing its false-positive rate would
    trade a rare fabrication for a common wrongly-refused answer, and the beta has
    already been bitten once by a guardrail that fired on valid replies.
    """
    claimed = set(_ISO_DATE_RE.findall(reply or ""))
    if not claimed:
        return []
    grounded = set(_ISO_DATE_RE.findall(
        json.dumps(tool_results or [], ensure_ascii=False, default=str)))
    return sorted(claimed - grounded)


def attach_provenance(result: Any, provenance: Optional[Dict[str, Any]]) -> Any:
    """Merge methodology provenance into a tool result's ``provenance`` block.

    Non-dict results and empty provenance pass through untouched. Existing keys
    (e.g. the dataset hash from Layer-1 facets) are preserved — this adds to
    them rather than replacing, so a facet keeps its own fingerprint.
    """
    if not isinstance(result, dict) or not provenance:
        return result
    existing = result.get("provenance")
    merged = dict(existing) if isinstance(existing, dict) else {}
    for key, value in provenance.items():
        merged.setdefault(key, value)
    result["provenance"] = merged
    return result
