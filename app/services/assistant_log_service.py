"""
Persistence for the astrologer-assistant dialogue.

Records each turn — the user's message, the assistant's reply, and the turn's
cost/latency metrics — into the app's own tables. This is the product's
queryable history and the basis for future token-based billing; Langfuse
covers the lower-level LLM tracing.

Logging must never break a chat response: callers wrap ``log_turn`` so a write
failure is swallowed (and logged) rather than surfaced to the user.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy.orm import Session

from app.database.models import (
    AssistantConversation,
    AssistantMessage,
    AssistantTurnMetric,
)

# A conversation title is a short snippet of the first user message.
_TITLE_MAX = 120


def _resolve_conversation(
    db: Session,
    *,
    astrologer_id: UUID,
    chart_user_id: UUID,
    conversation_id: Optional[UUID],
    first_user_text: str,
) -> AssistantConversation:
    if conversation_id is not None:
        conv = (
            db.query(AssistantConversation)
            .filter(
                AssistantConversation.id == conversation_id,
                AssistantConversation.astrologer_id == astrologer_id,
                AssistantConversation.chart_user_id == chart_user_id,
            )
            .first()
        )
        if conv is not None:
            conv.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            return conv

    conv = AssistantConversation(
        astrologer_id=astrologer_id,
        chart_user_id=chart_user_id,
        title=(first_user_text or "").strip()[:_TITLE_MAX] or None,
    )
    db.add(conv)
    db.flush()  # assign conv.id without committing the outer transaction yet
    return conv


def log_turn(
    db: Session,
    *,
    astrologer_id: UUID,
    chart_user_id: UUID,
    conversation_id: Optional[UUID],
    user_message: str,
    assistant_reply: str,
    metrics: Dict,
    max_iterations_reached: bool,
) -> Optional[UUID]:
    """Persist one assistant turn. Returns the conversation id, or None on failure.

    Writes are committed here so a caller's read-only request transaction does
    not need to. Failures are swallowed — the chat reply has already been
    produced and must not be lost to a logging error.
    """
    try:
        conv = _resolve_conversation(
            db,
            astrologer_id=astrologer_id,
            chart_user_id=chart_user_id,
            conversation_id=conversation_id,
            first_user_text=user_message,
        )

        db.add(AssistantMessage(
            conversation_id=conv.id, role="user", content=user_message or ""))
        db.add(AssistantMessage(
            conversation_id=conv.id, role="assistant", content=assistant_reply or ""))

        m = metrics or {}
        db.add(AssistantTurnMetric(
            conversation_id=conv.id,
            astrologer_id=astrologer_id,
            model=m.get("model", "unknown"),
            iterations=m.get("iterations", 0),
            model_calls=m.get("model_calls", 0),
            latency_ms=m.get("latency_ms", 0),
            prompt_tokens=m.get("prompt_tokens", 0),
            completion_tokens=m.get("completion_tokens", 0),
            total_tokens=m.get("total_tokens", 0),
            max_iterations_reached=max_iterations_reached,
        ))
        db.commit()
        return conv.id
    except Exception:
        logger.exception("assistant turn logging failed")
        db.rollback()
        return None


def latest_user_message(messages: List[Dict]) -> str:
    """The newest user-authored message in the turn's history."""
    for m in reversed(messages):
        if m.get("role") == "user":
            return m.get("content", "") or ""
    return ""


# --- thread browsing (history UI) --------------------------------------

def list_conversations(
    db: Session,
    *,
    astrologer_id: UUID,
    chart_user_id: Optional[UUID] = None,
    limit: int = 50,
) -> List[Dict]:
    """Threads owned by an astrologer, newest first, with a message count.

    When ``chart_user_id`` is given, only threads bound to that chart are
    returned (so the widget can show "history for this chart").
    """
    from sqlalchemy import func as _func

    msg_count = (
        db.query(
            AssistantMessage.conversation_id.label("cid"),
            _func.count(AssistantMessage.id).label("n"),
        )
        .group_by(AssistantMessage.conversation_id)
        .subquery()
    )

    q = (
        db.query(AssistantConversation, msg_count.c.n)
        .outerjoin(msg_count, msg_count.c.cid == AssistantConversation.id)
        .filter(AssistantConversation.astrologer_id == astrologer_id)
    )
    if chart_user_id is not None:
        q = q.filter(AssistantConversation.chart_user_id == chart_user_id)

    rows = q.order_by(AssistantConversation.updated_at.desc()).limit(limit).all()
    return [
        {
            "id": str(conv.id),
            "title": conv.title,
            "chart_user_id": str(conv.chart_user_id) if conv.chart_user_id else None,
            "message_count": int(n or 0),
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        }
        for conv, n in rows
    ]


def get_conversation(
    db: Session,
    *,
    astrologer_id: UUID,
    conversation_id: UUID,
) -> Optional[Dict]:
    """Full thread (metadata + ordered messages), or None if not the owner's."""
    conv = (
        db.query(AssistantConversation)
        .filter(
            AssistantConversation.id == conversation_id,
            AssistantConversation.astrologer_id == astrologer_id,
        )
        .first()
    )
    if conv is None:
        return None
    return {
        "id": str(conv.id),
        "title": conv.title,
        "chart_user_id": str(conv.chart_user_id) if conv.chart_user_id else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in conv.messages
        ],
    }


def delete_conversation(
    db: Session,
    *,
    astrologer_id: UUID,
    conversation_id: UUID,
) -> bool:
    """Delete a thread (cascades to messages and metrics). True if removed."""
    conv = (
        db.query(AssistantConversation)
        .filter(
            AssistantConversation.id == conversation_id,
            AssistantConversation.astrologer_id == astrologer_id,
        )
        .first()
    )
    if conv is None:
        return False
    db.delete(conv)
    db.commit()
    return True
