"""
Owner-only operational read view.

Why this exists: answering "did anyone sign up, and did the beta complain" meant
opening the production database by hand. That is a heavyweight, credential-bearing
operation for a question asked weekly, and it puts a connection string into the
loop every time. This endpoint answers the same questions over an ordinary
authenticated request, with no credential handling at all.

Three properties make that safe enough to expose:

1. **Fail closed.** The gate is an explicit email allowlist in OPS_OWNER_EMAILS.
   Unset — which is the default, including for anyone who deploys this without
   reading the docs — makes the route return 404 for everybody. Shipping this
   file exposes nothing until someone deliberately turns it on.
2. **No query surface.** Every statement here is fixed. There is deliberately no
   parameter that reaches SQL as text: this is an ops *view*, not a remote SQL
   console, and the difference is the whole security argument.
3. **Read-only.** Nothing in this module writes, and the session is never
   committed.

The response crosses tenant boundaries (other astrologers' emails and feedback),
which is the point — the owner is asking about their own product's users — but it
is also why the gate is an allowlist rather than a role flag anyone could acquire.
Access is logged.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, require_auth
from app.database.connection import get_db
from app.database.models import (
    Astrologer,
    AssistantMessage,
    AssistantTurnMetric,
)
from app.services.assistant_quality_metrics import compute_quality_metrics

router = APIRouter(prefix="/ops")


def _owner_emails() -> frozenset:
    """The allowlist. Empty means the feature is off, not that everyone passes."""
    raw = os.getenv("OPS_OWNER_EMAILS", "")
    return frozenset(
        part.strip().lower() for part in raw.split(",") if part.strip())


def _require_owner(auth: AuthContext) -> str:
    """404 rather than 403 for a non-owner: a 403 would confirm the route exists
    and that there is an allowlist to get onto. Returns the caller's email."""
    allowed = _owner_emails()
    email = (getattr(auth.astrologer, "email", "") or "").strip().lower()
    if not allowed or email not in allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    logger.warning("ops overview accessed by {}", email)
    return email


def _iso(value) -> Optional[str]:
    return value.isoformat() if value else None


@router.get(
    "/overview",
    summary="Owner-only: signups, assistant health and beta feedback",
    description=(
        "Fixed read-only rollup for the account owner. Requires the caller's "
        "email to be listed in OPS_OWNER_EMAILS; returns 404 otherwise."
    ),
)
def ops_overview(
    days: int = Query(30, ge=1, le=365, description="Recency window in days."),
    limit: int = Query(25, ge=1, le=200, description="Rows per list."),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
) -> Dict:
    _require_owner(auth)
    since = datetime.utcnow() - timedelta(days=days)

    signups_recent: List[Dict] = [
        {
            "email": a.email,
            "created_at": _iso(a.created_at),
            "plan_code": a.plan_code,
            "auth_provider": a.auth_provider,
            "is_active": a.is_active,
            "email_verified": a.email_verified_at is not None,
        }
        for a in db.query(Astrologer)
        .order_by(Astrologer.created_at.desc())
        .limit(limit)
        .all()
    ]

    # Feedback is the question that actually gets asked, so it carries who said
    # it — a dislike with no way back to the account is not actionable.
    feedback: List[Dict] = [
        {
            "turn_id": m.id,
            "created_at": _iso(m.created_at),
            "feedback": m.feedback,
            "correction_flag": m.correction_flag,
            "correction_note": m.correction_note,
            "astrologer_email": email,
            "guardrail": m.guardrail,
            "tools_used": m.tools_used,
        }
        for m, email in db.query(AssistantTurnMetric, Astrologer.email)
        .join(Astrologer, Astrologer.id == AssistantTurnMetric.astrologer_id)
        .filter(
            (AssistantTurnMetric.feedback.isnot(None))
            | (AssistantTurnMetric.correction_flag.is_(True))
        )
        .order_by(AssistantTurnMetric.id.desc())
        .limit(limit)
        .all()
    ]

    # Recent turns carry narrative_diag, which is how "the narrator is off in
    # production" becomes visible without a database session (migration 058).
    recent_turns: List[Dict] = [
        {
            "id": m.id,
            "created_at": _iso(m.created_at),
            "latency_ms": m.latency_ms,
            "model_calls": m.model_calls,
            "guardrail": m.guardrail,
            "narrated": m.narrated,
            "narrative_diag": m.narrative_diag,
            "tools_used": m.tools_used,
            "unsupported_dates": m.unsupported_dates,
            "max_iterations_reached": m.max_iterations_reached,
        }
        for m in db.query(AssistantTurnMetric)
        .order_by(AssistantTurnMetric.id.desc())
        .limit(limit)
        .all()
    ]

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "window_days": days,
        "signups": {
            "total": db.query(func.count(Astrologer.id)).scalar() or 0,
            "in_window": db.query(func.count(Astrologer.id))
            .filter(Astrologer.created_at >= since)
            .scalar() or 0,
            "recent": signups_recent,
        },
        "assistant": {
            "turns_total": db.query(func.count(AssistantTurnMetric.id)).scalar() or 0,
            "turns_in_window": db.query(func.count(AssistantTurnMetric.id))
            .filter(AssistantTurnMetric.created_at >= since)
            .scalar() or 0,
            "messages_total": db.query(func.count(AssistantMessage.id)).scalar() or 0,
            # astrologer_id=None => the cross-tenant rollup, including the
            # narrative_status breakdown.
            "quality": compute_quality_metrics(db, limit=500),
            "feedback": feedback,
            "recent_turns": recent_turns,
        },
    }
