"""Public moon pages: the free lunation calculator and the moon letters (double opt-in).

HTTP contract only. Calculations, text and email live in ``moon_journal_service``.
Nothing here needs an account; the letter page is reached through a signed link.
"""
from __future__ import annotations

from typing import Any, Dict, NoReturn

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from app.api.rate_limit import rate_limited
from app.database.connection import get_db
from app.models.moon_journal import (
    JournalEntryRequest,
    MoonChartRequest,
    MoonLinkRequest,
    MoonSubscribeRequest,
    TokenRequest,
)
from app.services import b2c_safety_policy as safety
from app.services import moon_journal_service as moon
from app.services import vedic_service as vedic

router = APIRouter(prefix="/moon", tags=["Moon"])

_calc_limit = rate_limited("moon-calc", 40, 60)
_subscribe_limit = rate_limited("moon-subscribe", 6, 3600)
_token_limit = rate_limited("moon-token", 30, 60)
_save_limit = rate_limited("moon-save", 120, 60)  # autosave while typing


class LetterRequest(TokenRequest):
    confirm: bool = False


def _fail(status_code: int, error_code: str, reason: str) -> NoReturn:
    raise HTTPException(status_code=status_code, detail={"error_code": error_code, "detail": {"reason": reason}})


def _guarded(build):
    try:
        return build()
    except vedic.VedicInputError as exc:
        _fail(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", str(exc))
    except safety.UnsafeTextError as exc:
        # A block failed the safety law: show nothing rather than something unreviewed.
        logger.error("Moon letter blocked by the safety filter: {}", exc)
        _fail(status.HTTP_500_INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "letter_blocked")


def _subscriber(db: Session, token: str):
    sub = moon.find_by_token(db, token)
    if sub is None:
        _fail(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "invalid_token")
    return sub


@router.post("/chart", summary="Next new and full moon in your houses (free)", dependencies=[Depends(_calc_limit)])
def moon_chart(payload: MoonChartRequest) -> Dict[str, Any]:
    return _guarded(lambda: moon.chart(payload.birth, payload.locale))


@router.post("/subscribe", summary="Ask for the moon letters", dependencies=[Depends(_subscribe_limit)])
def moon_subscribe(payload: MoonSubscribeRequest, request: Request, db: Session = Depends(get_db)) -> Dict[str, str]:
    _guarded(lambda: moon.subscribe(db, payload, fallback_base_url=str(request.base_url)))
    return {"status": "check_inbox"}


@router.post("/link", summary="Email me the link to my journal", dependencies=[Depends(_subscribe_limit)])
def moon_link(payload: MoonLinkRequest, request: Request, db: Session = Depends(get_db)) -> Dict[str, str]:
    moon.send_link(db, payload.email, fallback_base_url=str(request.base_url))
    return {"status": "check_inbox"}


@router.post("/journal/save", summary="Save one journal answer", dependencies=[Depends(_save_limit)])
def moon_journal_save(payload: JournalEntryRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    moon.save_entry(db, _subscriber(db, payload.token), payload)
    return {"status": "saved"}


@router.post("/letter", summary="The subscriber's current letter", dependencies=[Depends(_token_limit)])
def moon_letter(payload: LetterRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    sub = _subscriber(db, payload.token)
    return _guarded(lambda: moon.letter_page(db, sub, confirm=payload.confirm))


@router.post("/interest", summary="Tell us you want the paid journal", dependencies=[Depends(_token_limit)])
def moon_interest(payload: TokenRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    moon.record_interest(db, _subscriber(db, payload.token))
    return {"status": "recorded"}


@router.post("/unsubscribe", summary="Stop the moon letters", dependencies=[Depends(_token_limit)])
def moon_unsubscribe(payload: TokenRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    moon.unsubscribe(db, _subscriber(db, payload.token))
    return {"status": "unsubscribed"}


@router.post("/erase", summary="Delete my data", dependencies=[Depends(_token_limit)])
def moon_erase(payload: TokenRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    moon.erase(db, _subscriber(db, payload.token))
    return {"status": "erased"}


def _require_cron(request: Request) -> None:
    if not moon.cron_secret_matches(request.headers.get("x-moon-cron", "")):
        _fail(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "not_found")


@router.post("/internal/send-letters", include_in_schema=False)
def moon_send_letters(request: Request, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Called by the scheduler (.github/workflows/moon-letters.yml). Secret header, else 404."""
    _require_cron(request)
    return moon.run_letter_job(db)


@router.get("/internal/stats", include_in_schema=False)
def moon_stats(request: Request, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """The validation funnel per language, behind the same secret as the scheduler."""
    _require_cron(request)
    return moon.stats(db)
