"""
Assistant API — computational tools for the astrologer assistant.

PR2: the aspect-passes endpoint. Wraps TransitService.find_aspect_passes with
deterministic, enum-validated arguments and a structured result. Domain
conditions (unknown body, no contact in window, …) are returned as a
machine-readable ``status`` in the 200 body so the agent layer can react;
only a missing natal chart is a 404, and internal errors never leak text.
"""
from __future__ import annotations

from datetime import date as date_type
from typing import List, Optional
from uuid import UUID

import pytz
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session
from loguru import logger
from starlette.concurrency import run_in_threadpool

from app.auth.dependencies import AuthContext, ensure_client_access, require_auth
from app.services.entitlements_service import (
    FEATURE_ASSISTANT,
    FEATURE_TRANSCRIPTION,
    assert_account_writable,
    assert_feature_enabled,
)
from app.database.connection import db_manager, get_db
from app.i18n.context import get_current_locale
from app.services.astro_assistant_service import (
    ASPECT_TYPE_NAMES as _ASPECT_TYPES,
    AstroAssistantService,
    NATAL_BODY_NAMES as _NATAL_BODY_NAMES,
    TRANSIT_BODY_NAMES as _TRANSIT_BODY_NAMES,
)
from app.services.assistant_log_service import (
    delete_conversation,
    export_turns,
    flag_turn_correction,
    get_conversation,
    latest_user_message,
    list_conversations,
    log_turn,
    set_turn_feedback,
)
from app.services.openai_service import is_openai_configured, transcribe_audio
from app.services.transit_service import TransitService
from app.utils.ephemeris import get_ephemeris_path

router = APIRouter(prefix="/assistant", tags=["Assistant"])

EPHE_PATH = get_ephemeris_path()

MAX_EXPANSION_DAYS = 4000
MAX_CHAT_MESSAGES = 40
MAX_CHAT_CONTENT_CHARS = 4000

# Push-to-talk dictation limits.
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_AUDIO_TYPES = frozenset({
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3',
    'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav',
})
_AUDIO_EXTENSIONS = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
}


def assert_assistant_enabled(auth: AuthContext) -> None:
    assert_feature_enabled(auth.astrologer, FEATURE_ASSISTANT, plan_code=auth.effective_plan_code)


def validate_audio_upload(content_type: str, size_bytes: int) -> str:
    """Return '' if acceptable, else an error code. Pure, so it's unit-testable."""
    base_type = (content_type or '').split(';', 1)[0].strip().lower()
    if size_bytes <= 0:
        return 'empty'
    if size_bytes > MAX_AUDIO_BYTES:
        return 'too_large'
    if base_type not in ALLOWED_AUDIO_TYPES:
        return 'unsupported_type'
    return ''


def merge_chat_history(persisted: List[dict], incoming: List[dict], limit: int = MAX_CHAT_MESSAGES) -> List[dict]:
    """Merge stored thread messages with the browser-sent tail without duplicating overlap.

    The browser normally sends its in-memory history, but long step-by-step work can
    outlive that buffer. Server-side history keeps "исполняй следующий шаг" grounded
    in the earlier calculations already saved for the conversation.
    """
    def clean(items: List[dict]) -> List[dict]:
        return [
            {"role": m.get("role"), "content": m.get("content", "") or ""}
            for m in (items or [])
            if m.get("role") in ("user", "assistant")
        ]

    base = clean(persisted)
    tail = clean(incoming)
    if not base:
        return tail[-limit:]
    if not tail:
        return base[-limit:]

    max_overlap = min(len(base), len(tail))
    overlap = 0
    for size in range(max_overlap, 0, -1):
        if base[-size:] == tail[:size]:
            overlap = size
            break
    return (base + tail[overlap:])[-limit:]


class AspectPassesRequest(BaseModel):
    """Find when a transiting body forms an aspect to a natal object."""

    user_id: UUID = Field(..., description="Chart source (active chart's user_id).")
    transit_body: str = Field(..., description="Transiting body.")
    natal_body: str = Field(..., description="Natal target object.")
    aspect_type: str = Field(..., description="Aspect type (ref_aspect_types).")
    timezone: str = Field(..., description="IANA timezone, e.g. 'Europe/Kiev'.")
    mode: str = Field(
        'next_contact',
        description="'next_contact' (auto-expand forward) or 'window' (explicit range).",
    )
    start_date: Optional[date_type] = Field(None, description="window mode: range start.")
    end_date: Optional[date_type] = Field(None, description="window mode: range end.")
    anchor_date: Optional[date_type] = Field(
        None, description="next_contact mode: scan anchor (defaults to today).")
    max_expansion_days: Optional[int] = Field(
        None, ge=1, le=MAX_EXPANSION_DAYS,
        description="next_contact mode: forward cap; defaults per body.")

    @field_validator('transit_body')
    @classmethod
    def _validate_transit_body(cls, v: str) -> str:
        if v not in _TRANSIT_BODY_NAMES:
            raise ValueError(f"Unsupported transit_body: {v}")
        return v

    @field_validator('natal_body')
    @classmethod
    def _validate_natal_body(cls, v: str) -> str:
        if v not in _NATAL_BODY_NAMES:
            raise ValueError(f"Unsupported natal_body: {v}")
        return v

    @field_validator('aspect_type')
    @classmethod
    def _validate_aspect_type(cls, v: str) -> str:
        if v not in _ASPECT_TYPES:
            raise ValueError(f"Unknown aspect_type: {v}")
        return v

    @field_validator('mode')
    @classmethod
    def _validate_mode(cls, v: str) -> str:
        if v not in ('next_contact', 'window'):
            raise ValueError("mode must be 'next_contact' or 'window'")
        return v

    @field_validator('timezone')
    @classmethod
    def _validate_timezone(cls, v: str) -> str:
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f"Unknown timezone: {v}")
        return v

    @model_validator(mode='after')
    def _validate_window(self):
        if self.mode == 'window':
            if self.start_date is None or self.end_date is None:
                raise ValueError("window mode requires start_date and end_date")
            if self.end_date < self.start_date:
                raise ValueError("end_date must not precede start_date")
        return self


class AspectPass(BaseModel):
    date: str
    motion: str  # 'direct' | 'retrograde'
    orb: float


class Station(BaseModel):
    date: str
    type: str  # 'R' | 'D'


class ClosestApproach(BaseModel):
    orb: float
    date: str


class AspectContact(BaseModel):
    enter: str
    enter_complete: bool
    leave: str
    leave_complete: bool
    exact_pass_count: int
    passes: List[AspectPass]
    stations: List[Station]
    closest_approach: ClosestApproach


class AspectPassesResponse(BaseModel):
    status: str
    transit_body: str
    natal_body: str
    aspect_type: str
    timezone: str
    calc_version: str
    exact_angle: Optional[float] = None
    orb_used: Optional[float] = None
    orb_source: Optional[str] = None
    mode: Optional[str] = None
    requested_window: Optional[dict] = None
    effective_window: Optional[dict] = None
    window_cap_reached: Optional[bool] = None
    boundary_complete: Optional[bool] = None
    contacts: List[AspectContact] = Field(default_factory=list)


@router.post(
    "/aspect-passes",
    response_model=AspectPassesResponse,
    status_code=status.HTTP_200_OK,
    summary="Aspect passes (enter / each exact crossing / leave)",
    description=(
        "Finds when a transiting body forms an aspect to a natal object: every "
        "exact crossing (retrograde loops yield multiple), motion per pass, and "
        "station dates. Orbs come from the astrologer's configured settings."
    ),
)
def aspect_passes(
    request: AspectPassesRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_assistant_enabled(auth)
    try:
        ensure_client_access(
            db, http_request, auth, request.user_id, action="client.assistant.aspect_passes")
        service = TransitService(db_session=db, ephe_path=EPHE_PATH)
        return service.find_aspect_passes(
            user_id=request.user_id,
            transit_body=request.transit_body,
            natal_body=request.natal_body,
            aspect_type=request.aspect_type,
            timezone=request.timezone,
            anchor_date=request.anchor_date,
            start_date=request.start_date if request.mode == 'window' else None,
            end_date=request.end_date if request.mode == 'window' else None,
            max_expansion_days=request.max_expansion_days,
        )
    except ValueError as e:
        # Only raised for a genuinely missing natal chart.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception:
        logger.exception("aspect_passes failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Aspect passes calculation failed",
        )


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'.")
    content: str = Field(..., max_length=MAX_CHAT_CONTENT_CHARS)

    @field_validator('role')
    @classmethod
    def _validate_role(cls, v: str) -> str:
        if v not in ('user', 'assistant'):
            raise ValueError("role must be 'user' or 'assistant'")
        return v


class ChatRequest(BaseModel):
    """A chat turn bound to the active chart."""

    user_id: UUID = Field(..., description="Active chart's user_id (server-bound context).")
    timezone: str = Field('UTC', description="Active chart's timezone (default for tools).")
    anchor_date: Optional[date_type] = Field(
        None, description="Date currently selected in the chart workspace.")
    conversation_id: Optional[UUID] = Field(
        None, description="Existing conversation to append to; omit to start a new one.")
    workspace: Optional[dict] = Field(
        None,
        description=(
            "Compact live-workspace summary (wheelView, layers, date, solarYear, "
            "houseSystem) for grounding follow-up commands. Advisory only; the "
            "server validates each field and never derives access from it."
        ),
    )
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=MAX_CHAT_MESSAGES)

    @field_validator('timezone')
    @classmethod
    def _validate_timezone(cls, v: str) -> str:
        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f"Unknown timezone: {v}")
        return v


class ChatResponse(BaseModel):
    reply: str
    tool_results: List[dict] = Field(default_factory=list)
    # Workspace commands the client should apply (PR2). The server validates the
    # model's intent but never executes it — workspace state lives in the browser.
    actions: List[dict] = Field(default_factory=list)
    iterations: int
    max_iterations_reached: bool
    conversation_id: Optional[str] = None
    metrics: Optional[dict] = None
    # Layer-3 gate outcome for this turn (client renders the trust/degraded state):
    # ok | regenerated | degraded | regenerated_degraded | blocked | blocked_degraded.
    guardrail: Optional[str] = None
    # This turn's metric id — the handle the client uses to flag it for correction.
    metric_id: Optional[int] = None


def _commit_and_close_request_db(db: Session) -> None:
    """Persist auth/audit reads, then release the request connection before LLM work."""
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _run_assistant_chat_turn(
    *,
    user_id: UUID,
    messages: List[dict],
    timezone: str,
    anchor_date: Optional[date_type],
    workspace: Optional[dict],
    astrologer_id: UUID,
    locale: Optional[str] = None,
    conversation_id: Optional[UUID] = None,
) -> dict:
    db = db_manager.get_new_session()
    try:
        service = AstroAssistantService(
            db_session=db,
            default_timezone=timezone,
            default_anchor_date=anchor_date,
            default_workspace=workspace,
            astrologer_id=astrologer_id,
            conversation_id=conversation_id,
        )
        return service.chat(user_id=user_id, messages=messages, locale=locale)
    finally:
        db.close()


def _log_assistant_turn(
    *,
    astrologer_id: UUID,
    chart_user_id: UUID,
    conversation_id: Optional[UUID],
    user_message: str,
    assistant_reply: str,
    metrics: dict,
    max_iterations_reached: bool,
    guardrail: Optional[str],
    tool_results: List[dict],
    workspace_manifest: Optional[dict],
    methodology_hash: Optional[str] = None,
    resolved_settings: Optional[dict] = None,
) -> "tuple[Optional[UUID], Optional[int]]":
    db = db_manager.get_new_session()
    try:
        return log_turn(
            db,
            astrologer_id=astrologer_id,
            chart_user_id=chart_user_id,
            conversation_id=conversation_id,
            user_message=user_message,
            assistant_reply=assistant_reply,
            metrics=metrics,
            max_iterations_reached=max_iterations_reached,
            guardrail=guardrail,
            tool_results=tool_results,
            workspace_manifest=workspace_manifest,
            methodology_hash=methodology_hash,
            resolved_settings=resolved_settings,
        )
    finally:
        db.close()


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Astrologer assistant chat turn",
    description=(
        "Runs the function-calling assistant for the active chart. The model "
        "selects deterministic tools; the chart's user_id is bound server-side "
        "and never controlled by the model."
    ),
)
async def chat(
    request: ChatRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_assistant_enabled(auth)
    assert_account_writable(auth.astrologer, plan_code=auth.effective_plan_code)
    if not is_openai_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Assistant is not configured",
        )
    ensure_client_access(db, http_request, auth, request.user_id, action="client.assistant.chat")
    astrologer_id = auth.astrologer.id
    messages = [m.model_dump() for m in request.messages]
    if request.conversation_id:
        conv = get_conversation(
            db,
            astrologer_id=astrologer_id,
            conversation_id=request.conversation_id,
        )
        if conv and conv.get("chart_user_id") == str(request.user_id):
            messages = merge_chat_history(conv.get("messages", []), messages)

    _commit_and_close_request_db(db)

    # Resolve the UI locale here (request context is active) and pass it in so the
    # reply matches the astrologer's interface language.
    locale = get_current_locale()

    try:
        result = await run_in_threadpool(
            _run_assistant_chat_turn,
            user_id=request.user_id,
            messages=messages,
            timezone=request.timezone,
            anchor_date=request.anchor_date,
            workspace=request.workspace,
            astrologer_id=astrologer_id,
            locale=locale,
            conversation_id=request.conversation_id,
        )
    except Exception:
        logger.exception("assistant chat failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Assistant request failed",
        )

    applied_actions = result.get("actions", []) or []
    if applied_actions:
        logger.info(
            "assistant applied %d workspace action(s): %s",
            len(applied_actions),
            ",".join(a.get("name", "?") for a in applied_actions),
        )

    # Persist the turn (history + cost/latency). Never fails the response.
    conv_id, metric_id = _log_assistant_turn(
        astrologer_id=astrologer_id,
        chart_user_id=request.user_id,
        conversation_id=request.conversation_id,
        user_message=latest_user_message(messages),
        assistant_reply=result.get("reply", ""),
        metrics=result.get("metrics") or {},
        max_iterations_reached=result.get("max_iterations_reached", False),
        guardrail=result.get("guardrail"),
        tool_results=result.get("tool_results") or [],
        workspace_manifest=request.workspace,
        methodology_hash=(result.get("methodology") or {}).get("methodology_hash"),
        resolved_settings=(result.get("methodology") or {}).get("resolved_settings"),
    )

    return ChatResponse(
        reply=result.get("reply", ""),
        tool_results=result.get("tool_results", []),
        actions=applied_actions,
        iterations=result.get("iterations", 0),
        max_iterations_reached=result.get("max_iterations_reached", False),
        conversation_id=str(conv_id) if conv_id else None,
        metrics=result.get("metrics"),
        guardrail=result.get("guardrail"),
        metric_id=metric_id,
    )


class ConversationSummary(BaseModel):
    id: str
    title: Optional[str] = None
    chart_user_id: Optional[str] = None
    message_count: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ConversationListResponse(BaseModel):
    conversations: List[ConversationSummary] = Field(default_factory=list)


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List the astrologer's assistant threads",
    description=(
        "Threads owned by the authenticated astrologer, newest first. Pass "
        "chart_user_id to scope to one chart's history."
    ),
)
def list_threads(
    auth: AuthContext = Depends(require_auth),
    db: Session = Depends(get_db),
    chart_user_id: Optional[UUID] = None,
    limit: int = 50,
):
    assert_assistant_enabled(auth)
    limit = max(1, min(limit, 100))
    return {
        "conversations": list_conversations(
            db,
            astrologer_id=auth.astrologer.id,
            chart_user_id=chart_user_id,
            limit=limit,
        )
    }


class ConversationDetailMessage(BaseModel):
    role: str
    content: str
    created_at: Optional[str] = None


class ConversationDetailResponse(BaseModel):
    id: str
    title: Optional[str] = None
    chart_user_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    messages: List[ConversationDetailMessage] = Field(default_factory=list)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Load one assistant thread with its messages",
)
def get_thread(
    conversation_id: UUID,
    auth: AuthContext = Depends(require_auth),
    db: Session = Depends(get_db),
):
    assert_assistant_enabled(auth)
    conv = get_conversation(
        db, astrologer_id=auth.astrologer.id, conversation_id=conversation_id)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an assistant thread",
)
def delete_thread(
    conversation_id: UUID,
    auth: AuthContext = Depends(require_auth),
    db: Session = Depends(get_db),
):
    assert_assistant_enabled(auth)
    removed = delete_conversation(
        db, astrologer_id=auth.astrologer.id, conversation_id=conversation_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return None


class CorrectionRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=2000, description="Optional what-was-wrong note.")


@router.post(
    "/turns/{metric_id}/correction",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Flag an assistant turn as needing correction (beta tuning signal)",
)
def flag_correction(
    metric_id: int,
    body: CorrectionRequest,
    auth: AuthContext = Depends(require_auth),
    db: Session = Depends(get_db),
):
    assert_assistant_enabled(auth)
    flagged = flag_turn_correction(
        db, astrologer_id=auth.astrologer.id, metric_id=metric_id, note=body.note)
    if not flagged:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turn not found")
    return None


class FeedbackRequest(BaseModel):
    kind: str = Field(..., description="'like' or 'dislike'.")
    note: Optional[str] = Field(None, max_length=2000, description="Optional note (dislike).")

    @field_validator('kind')
    @classmethod
    def _validate_kind(cls, v: str) -> str:
        if v not in ('like', 'dislike'):
            raise ValueError("kind must be 'like' or 'dislike'")
        return v


@router.post(
    "/turns/{metric_id}/feedback",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Record like/dislike on an assistant turn (beta signal)",
)
def record_feedback(
    metric_id: int,
    body: FeedbackRequest,
    auth: AuthContext = Depends(require_auth),
    db: Session = Depends(get_db),
):
    assert_assistant_enabled(auth)
    ok = set_turn_feedback(
        db, astrologer_id=auth.astrologer.id, metric_id=metric_id,
        kind=body.kind, note=body.note)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turn not found")
    return None


class ExportResponse(BaseModel):
    turns: List[dict] = Field(default_factory=list)


@router.get(
    "/export",
    response_model=ExportResponse,
    summary="Export the astrologer's captured turns for tuning",
    description=(
        "Tenant-scoped export of captured turns (tool_results, workspace manifest, "
        "guardrail outcome, correction flags) for the authenticated astrologer only."
    ),
)
def export_captured_turns(
    auth: AuthContext = Depends(require_auth),
    db: Session = Depends(get_db),
    corrections_only: bool = False,
    limit: int = 1000,
):
    assert_assistant_enabled(auth)
    return {
        "turns": export_turns(
            db,
            astrologer_id=auth.astrologer.id,
            corrections_only=corrections_only,
            limit=limit,
        )
    }


class TranscribeResponse(BaseModel):
    text: str


@router.post(
    "/transcribe",
    response_model=TranscribeResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcribe a short dictation clip",
    description="Push-to-talk speech-to-text for the assistant composer (OpenAI).",
)
async def transcribe(
    audio: UploadFile = File(...),
    auth: AuthContext = Depends(require_auth),
):
    assert_assistant_enabled(auth)
    assert_feature_enabled(auth.astrologer, FEATURE_TRANSCRIPTION, plan_code=auth.effective_plan_code)
    if not is_openai_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transcription is not configured",
        )

    data = await audio.read(MAX_AUDIO_BYTES + 1)
    await audio.close()
    content_type = (audio.content_type or '').split(';', 1)[0].strip().lower()
    error = validate_audio_upload(content_type, len(data))
    if error == 'empty':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio")
    if error == 'too_large':
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Audio too large")
    if error == 'unsupported_type':
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported audio type")

    try:
        filename = f"dictation.{_AUDIO_EXTENSIONS[content_type]}"
        text = await run_in_threadpool(transcribe_audio, data, filename, content_type)
        return {"text": text}
    except Exception:
        logger.exception("assistant transcribe failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Transcription failed",
        )
