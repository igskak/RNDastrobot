"""Counts landings from campaign links (promo codes, ?ref= sources) without tracking anyone.

Analytics only sees visitors who accept the consent banner, and a conference QR scanned on
a phone is mostly not accepted. So after a flyer drop nobody could say how many people had
scanned it, only how many registered. This closes that gap on the server: one row per page
load that arrives with a known campaign code, and nothing about who loaded it.

What is stored: the code, whether it came as `promo` or `ref`, and the path. What is not:
IP, user agent, cookies, session id, referrer. There is no identifier to consent to, so no
banner is needed, and the rows are counts rather than people. Reload twice and it counts
twice; read it as page loads, not as visitors.

Only codes we issued are recorded (every signup promo, plus TRACKED_REFS), so a stranger
cannot grow the table by inventing codes.

Read the counts with docs/marketing/queries/campaign-signups-2026-10.sql.
"""
from __future__ import annotations

import logging
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.database.models import AuditEvent
from app.services.signup_promos import SIGNUP_PROMOS, normalize_promo_code

logger = logging.getLogger(__name__)

CAMPAIGN_VISIT_ACTION = "campaign.visit"

# ?ref= sources we run on purpose. Add one here before sharing a link that uses it.
TRACKED_REFS = frozenset({"producthunt"})

# Crawlers and link previewers load a landing page without anyone having scanned or clicked
# anything. The user agent is read to skip them and never stored.
_BOT_MARKERS = (
    "bot", "crawler", "spider", "slurp", "preview", "facebookexternalhit", "whatsapp",
    "telegram", "curl", "wget", "python-requests", "httpx", "headless", "lighthouse",
)


def is_probably_bot(user_agent: Optional[str]) -> bool:
    ua = (user_agent or "").lower()
    return not ua or any(marker in ua for marker in _BOT_MARKERS)


def campaign_from_query(query_params) -> Optional[Tuple[str, str]]:
    """(kind, code) for a landing URL that carries a campaign we issued, else None."""
    promo = normalize_promo_code(query_params.get("promo"))
    if promo and promo in SIGNUP_PROMOS:
        return "promo", promo
    ref = normalize_promo_code(query_params.get("ref"))
    if ref and ref in TRACKED_REFS:
        return "ref", ref
    return None


def record_campaign_visit(db: Session, kind: str, code: str, path: str) -> None:
    """Writes one count row. Never raises: counting must not break serving the page."""
    try:
        db.add(
            AuditEvent(
                actor_id=None,
                action=CAMPAIGN_VISIT_ACTION,
                resource_type="campaign",
                resource_id=code,
                result="ok",
                properties={"kind": kind, "path": path[:120]},
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.warning("Could not record campaign visit for %s", code, exc_info=True)
