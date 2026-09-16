"""Signup promo codes — campaign links that grant a longer free trial.

A promo is an *entitlement*, not analytics: it changes how long the new account's
trial lasts. The code travels in the landing URL (`?promo=astro-de-2026`), is
persisted client-side in its own `steliara_promo` cookie by analytics.js (90
days, last-touch, written even when PostHog is blocked), and is read back here at
signup. It deliberately does NOT ride the first-touch `steliara_attribution`
cookie: that one is never overwritten, so a visitor who had already seen an ad
would silently lose the conference offer.

Promos are printed on public material (conference booklets), so every one of them
carries a hard expiry and a redemption cap — otherwise the link outlives the
event and the free quarter leaks into chat groups.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.auth.security import utcnow
from app.database.models import Astrologer
from app.services.entitlements_service import PLAN_TRIAL, normalize_plan_code

logger = logging.getLogger(__name__)

PROMO_COOKIE = "steliara_promo"

# Mirrors the client-side guard in analytics.js; keeps the value safe to log,
# index and compare.
_CODE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,63}$")


@dataclass(frozen=True)
class SignupPromo:
    code: str
    trial_days: int
    # Inclusive UTC deadline: after this moment the code stops granting anything
    # and new signups fall back to the standard trial.
    valid_until: datetime
    # None = unlimited. Counted against astrologers.signup_promo_code.
    max_redemptions: Optional[int]
    # i18n key for the welcome banner shown on the signup form.
    message_key: str


def _utc(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, 23, 59, 59, tzinfo=timezone.utc)


SIGNUP_PROMOS: Dict[str, SignupPromo] = {
    # DAV-Kongress (Deutscher Astrologenverband), 2026. Printed as a QR code on
    # the booklet. Adjust valid_until once the event dates are fixed — it should
    # outlive the congress by a couple of weeks (people scan, then sign up at
    # home) but not by a quarter.
    "astro-de-2026": SignupPromo(
        code="astro-de-2026",
        trial_days=90,
        valid_until=_utc(2026, 12, 31),
        max_redemptions=1000,
        message_key="page.login.promo.astroDe2026",
    ),
}


def normalize_promo_code(value: Optional[str]) -> Optional[str]:
    code = str(value or "").strip().lower()
    if not code or not _CODE_RE.match(code):
        return None
    return code


def get_promo(code: Optional[str]) -> Optional[SignupPromo]:
    normalized = normalize_promo_code(code)
    if not normalized:
        return None
    return SIGNUP_PROMOS.get(normalized)


def read_promo_code(request: Request) -> Optional[str]:
    """Promo code carried by the signup request's cookie, if any."""
    return normalize_promo_code(request.cookies.get(PROMO_COOKIE))


def count_redemptions(db: Session, code: str) -> int:
    return (
        db.query(Astrologer.id)
        .filter(Astrologer.signup_promo_code == code)
        .count()
    )


def is_redeemable(db: Session, promo: SignupPromo) -> bool:
    """True while the promo still grants its extended trial."""
    if promo.valid_until <= utcnow():
        return False
    if promo.max_redemptions is None:
        return True
    return count_redemptions(db, promo.code) < promo.max_redemptions


def resolve_signup_promo(
    db: Session,
    request: Request,
    *,
    plan_code: str,
) -> Optional[SignupPromo]:
    """The promo to apply to an account being created right now, or None.

    Best-effort: a promo lookup must never break registration. Only trial
    signups can carry one — solo/paid registrations have no trial window to
    extend.
    """
    try:
        if normalize_plan_code(plan_code) != PLAN_TRIAL:
            return None
        promo = get_promo(read_promo_code(request))
        if promo is None:
            return None
        if not is_redeemable(db, promo):
            logger.info("Signup promo %s is no longer redeemable", promo.code)
            return None
        return promo
    except Exception:  # pragma: no cover - defensive
        logger.exception("Failed to resolve signup promo")
        return None
