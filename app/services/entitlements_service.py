"""Account plan entitlements and limits."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models import Astrologer, User


PLAN_TRIAL = "trial"
PLAN_SOLO = "solo"
PLAN_STANDARD = "standard"
PLAN_PRO = "pro"
DEFAULT_PLAN_CODE = PLAN_PRO

FEATURE_CLIENTS = "clients"
FEATURE_CONSULTATIONS = "consultations"
FEATURE_CALLS = "calls"
FEATURE_RECORDING = "recording"
FEATURE_TRANSCRIPTION = "transcription"
FEATURE_MEETING_STATS = "meeting_stats"


@dataclass(frozen=True)
class PlanDefinition:
    plan_code: str
    max_saved_charts: Optional[int]
    clients_enabled: bool
    consultations_enabled: bool
    calls_enabled: bool
    recording_enabled: bool
    transcription_enabled: bool
    meeting_stats_enabled: bool

    def as_entitlements(self) -> Dict[str, Any]:
        return {
            "max_saved_charts": self.max_saved_charts,
            "clients_enabled": self.clients_enabled,
            "consultations_enabled": self.consultations_enabled,
            "calls_enabled": self.calls_enabled,
            "recording_enabled": self.recording_enabled,
            "transcription_enabled": self.transcription_enabled,
            "meeting_stats_enabled": self.meeting_stats_enabled,
        }


PLAN_DEFINITIONS: Dict[str, PlanDefinition] = {
    PLAN_TRIAL: PlanDefinition(
        plan_code=PLAN_TRIAL,
        max_saved_charts=5,
        clients_enabled=True,
        consultations_enabled=True,
        calls_enabled=False,
        recording_enabled=False,
        transcription_enabled=False,
        meeting_stats_enabled=True,
    ),
    PLAN_SOLO: PlanDefinition(
        plan_code=PLAN_SOLO,
        max_saved_charts=None,
        clients_enabled=True,
        consultations_enabled=False,
        calls_enabled=False,
        recording_enabled=False,
        transcription_enabled=False,
        meeting_stats_enabled=False,
    ),
    PLAN_STANDARD: PlanDefinition(
        plan_code=PLAN_STANDARD,
        max_saved_charts=None,
        clients_enabled=True,
        consultations_enabled=True,
        calls_enabled=False,
        recording_enabled=False,
        transcription_enabled=False,
        meeting_stats_enabled=True,
    ),
    PLAN_PRO: PlanDefinition(
        plan_code=PLAN_PRO,
        max_saved_charts=None,
        clients_enabled=True,
        consultations_enabled=True,
        calls_enabled=True,
        recording_enabled=True,
        transcription_enabled=True,
        meeting_stats_enabled=True,
    ),
}

FEATURE_TO_FLAG = {
    FEATURE_CLIENTS: "clients_enabled",
    FEATURE_CONSULTATIONS: "consultations_enabled",
    FEATURE_CALLS: "calls_enabled",
    FEATURE_RECORDING: "recording_enabled",
    FEATURE_TRANSCRIPTION: "transcription_enabled",
    FEATURE_MEETING_STATS: "meeting_stats_enabled",
}


def normalize_plan_code(plan_code: Optional[str]) -> str:
    normalized = str(plan_code or "").strip().lower()
    if normalized in PLAN_DEFINITIONS:
        return normalized
    return DEFAULT_PLAN_CODE


def get_plan_definition(astrologer: Astrologer) -> PlanDefinition:
    return PLAN_DEFINITIONS[normalize_plan_code(getattr(astrologer, "plan_code", None))]


def get_entitlements(astrologer: Astrologer) -> Dict[str, Any]:
    return get_plan_definition(astrologer).as_entitlements()


def count_saved_charts(db: Session, astrologer_id) -> int:
    return (
        db.query(User)
        .filter(User.astrologer_id == astrologer_id)
        .count()
    )


def get_usage(db: Session, astrologer: Astrologer) -> Dict[str, Any]:
    plan = get_plan_definition(astrologer)
    return {
        "saved_charts_count": count_saved_charts(db, astrologer.id),
        "max_saved_charts": plan.max_saved_charts,
    }


def _forbidden_detail(error_code: str, message: str, *, feature: Optional[str] = None) -> Dict[str, Any]:
    detail: Dict[str, Any] = {"error_code": error_code, "message": message}
    if feature:
        detail["detail"] = {"feature": feature}
    return detail


def assert_feature_enabled(astrologer: Astrologer, feature: str) -> None:
    flag_name = FEATURE_TO_FLAG.get(feature)
    if not flag_name:
        raise ValueError(f"Unknown entitlement feature: {feature}")
    entitlements = get_entitlements(astrologer)
    if entitlements.get(flag_name) is True:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=_forbidden_detail(
            "PLAN_FEATURE_LOCKED",
            "This feature is not available on your current plan.",
            feature=feature,
        ),
    )


def assert_can_create_saved_chart(db: Session, astrologer: Astrologer) -> None:
    plan = get_plan_definition(astrologer)
    if plan.max_saved_charts is None:
        return

    current_count = count_saved_charts(db, astrologer.id)
    if current_count < plan.max_saved_charts:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "error_code": "PLAN_LIMIT_REACHED",
            "message": "Your current plan limit for saved charts has been reached.",
            "detail": {
                "limit": plan.max_saved_charts,
                "current": current_count,
                "resource": "saved_charts",
            },
        },
    )
