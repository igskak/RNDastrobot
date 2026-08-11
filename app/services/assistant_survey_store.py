"""
Persisted forecast surveys (spec §22.2).

Why this exists: a survey is a discovery scan plus per-pair root finding, and it
used to vanish with the turn. So `intersect_forecast_windows` and
`discover_patterns` re-ran the whole thing instead of pointing at one, and an
astrologer returning to a conversation could not reopen the same dataset.

Every read is tenant-scoped by astrologer_id. A survey_id is derived from its
parameters, so it is guessable by construction — the scope check is what stops a
guessed id from returning another astrologer's chart, and it is not optional.

Writes never raise into a chat turn: an answer that is already correct must not
be lost because persistence hiccuped.
"""
from __future__ import annotations

from typing import Dict, List, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy.orm import Session

from app.database.models import AssistantSurvey


def save_survey(
    db: Session,
    *,
    survey_id: str,
    astrologer_id: UUID,
    chart_user_id: UUID,
    conversation_id: Optional[UUID],
    parameters: Dict,
    events: List[Dict],
    summary: Optional[Dict] = None,
    methodology_hash: Optional[str] = None,
    truncated: bool = False,
    kind: str = "transit_survey",
) -> bool:
    """Store (or refresh) one survey. False on failure, never raises.

    Upsert by survey_id: the id is a hash of the parameters, so recomputing the
    same survey should refresh the row rather than collide with it.
    """
    try:
        row = db.get(AssistantSurvey, survey_id)
        if row is None:
            row = AssistantSurvey(survey_id=survey_id)
            db.add(row)
        row.astrologer_id = astrologer_id
        row.chart_user_id = chart_user_id
        row.conversation_id = conversation_id
        row.kind = kind
        row.parameters = parameters or {}
        row.events = events or []
        row.summary = summary
        row.methodology_hash = methodology_hash
        row.event_count = len(events or [])
        row.truncated = bool(truncated)
        db.commit()
        return True
    except Exception:
        logger.exception("survey persistence failed")
        try:
            db.rollback()
        except Exception:
            pass
        return False


def load_survey(
    db: Session,
    *,
    survey_id: str,
    astrologer_id: UUID,
    chart_user_id: Optional[UUID] = None,
) -> Optional[Dict]:
    """Fetch a survey the caller owns. None when missing or out of scope.

    chart_user_id narrows further: a survey belongs to one chart, and a request
    made while a different chart is active should not silently answer from it.
    """
    try:
        query = db.query(AssistantSurvey).filter(
            AssistantSurvey.survey_id == survey_id,
            AssistantSurvey.astrologer_id == astrologer_id,
        )
        if chart_user_id is not None:
            query = query.filter(AssistantSurvey.chart_user_id == chart_user_id)
        row = query.first()
        if row is None:
            return None
        return {
            "survey_id": row.survey_id,
            "kind": row.kind,
            "parameters": row.parameters or {},
            "events": row.events or [],
            "summary": row.summary,
            "methodology_hash": row.methodology_hash,
            "event_count": row.event_count,
            "truncated": row.truncated,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
    except Exception:
        logger.exception("survey load failed")
        return None


def latest_survey(
    db: Session,
    *,
    astrologer_id: UUID,
    chart_user_id: UUID,
    conversation_id: Optional[UUID] = None,
) -> Optional[Dict]:
    """The most recent survey in this conversation, events included.

    Follow-ups need this because the model cannot know a survey_id: conversation
    history carries only {role, content}, so tool results from the previous turn
    are not replayed. Left to guess, the model invents one — observed live,
    calling a tool with survey_id "survey_1", eating an iteration on the error
    before recomputing the whole survey.

    Scoped to the conversation when one is known, so a follow-up in thread A
    cannot silently answer from a survey run in thread B.
    """
    try:
        query = db.query(AssistantSurvey).filter(
            AssistantSurvey.astrologer_id == astrologer_id,
            AssistantSurvey.chart_user_id == chart_user_id,
        )
        if conversation_id is not None:
            query = query.filter(AssistantSurvey.conversation_id == conversation_id)
        row = query.order_by(AssistantSurvey.created_at.desc()).first()
        if row is None:
            return None
        return load_survey(
            db, survey_id=row.survey_id, astrologer_id=astrologer_id,
            chart_user_id=chart_user_id)
    except Exception:
        logger.exception("latest survey lookup failed")
        return None


def list_surveys(
    db: Session,
    *,
    astrologer_id: UUID,
    chart_user_id: Optional[UUID] = None,
    limit: int = 10,
) -> List[Dict]:
    """Recent surveys for reopening, newest first. Events are NOT included —
    a list of 400-event payloads would be useless to page through."""
    try:
        query = db.query(AssistantSurvey).filter(
            AssistantSurvey.astrologer_id == astrologer_id)
        if chart_user_id is not None:
            query = query.filter(AssistantSurvey.chart_user_id == chart_user_id)
        rows = (query.order_by(AssistantSurvey.created_at.desc())
                .limit(max(1, min(limit, 50))).all())
        return [
            {
                "survey_id": r.survey_id,
                "kind": r.kind,
                "parameters": r.parameters or {},
                "event_count": r.event_count,
                "truncated": r.truncated,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    except Exception:
        logger.exception("survey listing failed")
        return []
