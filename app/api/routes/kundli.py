"""Public kundli tools: free calculators, guest checkout and the subscriber's report.

HTTP contract only. Calculations live in ``vedic_service``, text in ``vedic_report_service``
and money in ``kundli_billing_service``. Nothing here needs an account.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, NoReturn

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.api.rate_limit import rate_limited
from app.database.connection import get_db
from app.models.kundli import (
    CheckoutRequest,
    KundliBirth,
    MatchingRequest,
    SingleToolRequest,
    TokenRequest,
)
from app.services import b2c_safety_policy as safety
from app.services import kundli_billing_service as billing
from app.services import vedic_report_service as reports
from app.services import vedic_service as vedic

router = APIRouter(prefix="/kundli", tags=["Kundli"])

_calc_limit = rate_limited("kundli-calc", 40, 60)
_checkout_limit = rate_limited("kundli-checkout", 8, 3600)
_token_limit = rate_limited("kundli-token", 30, 60)


def _fail(status_code: int, error_code: str, reason: str) -> NoReturn:
    raise HTTPException(status_code=status_code, detail={"error_code": error_code, "detail": {"reason": reason}})


def _moon(birth: KundliBirth):
    try:
        return vedic.moon_for_local_birth(birth.date, birth.time_tuple(), birth.timezone)
    except vedic.VedicInputError as exc:
        _fail(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc))


def _birth_info(utc: datetime, time_known: bool, uncertainty: Dict[str, bool]) -> Dict[str, Any]:
    return {"utc": utc.isoformat(), "time_known": time_known, "uncertainty": uncertainty}


def _safe_report(build) -> Dict[str, Any]:
    try:
        return build()
    except safety.UnsafeTextError as exc:
        # A block failed the safety law: show nothing rather than something unreviewed.
        logger.error("Kundli report blocked by the safety filter: {}", exc)
        _fail(status.HTTP_500_INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "report_blocked")


@router.get("/config", summary="Which paid features are switched on")
def kundli_config() -> Dict[str, Any]:
    return billing.public_config()


@router.post("/dasha", summary="Vimshottari dasha (free)", dependencies=[Depends(_calc_limit)])
def kundli_dasha(payload: SingleToolRequest) -> Dict[str, Any]:
    moon, utc, known, uncertainty = _moon(payload.birth)
    now = datetime.now(timezone.utc)
    calc = vedic.vimshottari(moon.longitude, utc, as_of=now)
    name = safety.sanitize_display_name(payload.birth.name)
    return {
        "report": _safe_report(lambda: reports.build_dasha(calc, payload.locale, name, full=False, as_of=now)),
        "birth": _birth_info(utc, known, uncertainty),
    }


@router.post("/sade-sati", summary="Sade Sati (free)", dependencies=[Depends(_calc_limit)])
def kundli_sade_sati(payload: SingleToolRequest) -> Dict[str, Any]:
    moon, utc, known, uncertainty = _moon(payload.birth)
    calc = vedic.sade_sati(moon.rashi, utc, as_of=datetime.now(timezone.utc))
    name = safety.sanitize_display_name(payload.birth.name)
    return {
        "report": _safe_report(lambda: reports.build_sade_sati(calc, payload.locale, name, full=False)),
        "moon": reports.moon_labels(moon.as_dict(), reports.normalize_locale(payload.locale)),
        "birth": _birth_info(utc, known, uncertainty),
    }


@router.post("/matching", summary="Ashtakoota matching (free)", dependencies=[Depends(_calc_limit)])
def kundli_matching(payload: MatchingRequest) -> Dict[str, Any]:
    g_moon, g_utc, g_known, g_unc = _moon(payload.groom)
    b_moon, b_utc, b_known, b_unc = _moon(payload.bride)
    calc = vedic.ashtakoota(vedic.MatchPerson.from_longitude(g_moon.longitude),
                            vedic.MatchPerson.from_longitude(b_moon.longitude))
    names = (safety.sanitize_display_name(payload.groom.name), safety.sanitize_display_name(payload.bride.name))
    return {
        "report": _safe_report(lambda: reports.build_matching(calc, payload.locale, names, full=False)),
        "groom": _birth_info(g_utc, g_known, g_unc),
        "bride": _birth_info(b_utc, b_known, b_unc),
    }


@router.post("/checkout", summary="Start a forecast subscription", dependencies=[Depends(_checkout_limit)])
def kundli_checkout(payload: CheckoutRequest, request: Request, db: Session = Depends(get_db)) -> Dict[str, str]:
    try:
        url = billing.create_checkout(db, payload, fallback_base_url=str(request.base_url))
    except vedic.VedicInputError as exc:
        _fail(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc))
    return {"checkout_url": url}


def _subscriber(db: Session, token: str):
    sub = billing.find_by_token(db, token)
    if sub is None:
        _fail(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "invalid_token")
    return sub


@router.post("/report", summary="The subscriber's report", dependencies=[Depends(_token_limit)])
def kundli_report(payload: TokenRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    sub = _subscriber(db, payload.token)
    if not billing.has_access(sub):
        _fail(status.HTTP_403_FORBIDDEN, "FORBIDDEN", "no_active_subscription")
    return _safe_report(lambda: billing.build_bundle(sub))


@router.post("/portal", summary="Manage or cancel the subscription", dependencies=[Depends(_token_limit)])
def kundli_portal(payload: TokenRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    return {"url": billing.create_portal_url(_subscriber(db, payload.token))}


@router.post("/internal/send-digests", include_in_schema=False)
def kundli_send_digests(request: Request, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Called by the scheduler (.github/workflows/kundli-digests.yml). Secret header, else 404."""
    if not billing.cron_secret_matches(request.headers.get("x-kundli-cron", "")):
        _fail(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "not_found")
    return billing.run_digest_job(db)


@router.post("/erase", summary="Delete my data", dependencies=[Depends(_token_limit)])
def kundli_erase(payload: TokenRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    billing.erase(db, _subscriber(db, payload.token))
    return {"status": "erased"}
