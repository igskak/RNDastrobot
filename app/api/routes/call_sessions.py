"""
API endpoints for video call sessions (LiveKit).
Astrologer-facing: create/manage call rooms, start/stop recording.
Client-facing: join via token (unauthenticated).
Webhook: LiveKit egress events.
"""
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, status
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, create_audit_event, require_auth
from app.database.connection import get_db
from app.database.models import Astrologer, CallSession, Consultation, User
from app.api.routes.call_session_utils import TERMINAL_CALL_SESSION_STATUSES
from app.services.livekit_service import livekit_service
from app.services.storage_service import storage_service
from app.services.processing_pipeline import run_post_call_pipeline
from app.services.entitlements_service import FEATURE_CALLS, FEATURE_RECORDING, assert_feature_enabled

router = APIRouter(prefix="/call-sessions")

_JOIN_BASE_URL = os.getenv("CONSULTATION_JOIN_BASE_URL", "")
_JOIN_TOKEN_TTL_HOURS = int(os.getenv("JOIN_TOKEN_TTL_HOURS", "24"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _build_join_url(token: str, request: Request) -> str:
    base = _JOIN_BASE_URL.rstrip("/") if _JOIN_BASE_URL else str(request.base_url).rstrip("/")
    return f"{base}/call/{token}"


def _ensure_session_access(db: Session, auth: AuthContext, session_id: UUID) -> CallSession:
    cs = db.query(CallSession).filter(CallSession.id == session_id).first()
    if not cs or cs.astrologer_id != auth.astrologer.id:
        raise HTTPException(status_code=404, detail="Call session not found")
    return cs


def _serialize(cs: CallSession, join_url: Optional[str] = None, user=None) -> dict:
    client_name = None
    if user:
        client_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or None
    d = {
        "client_name": client_name,
        "id": str(cs.id),
        "user_id": str(cs.user_id),
        "astrologer_id": str(cs.astrologer_id),
        "consultation_id": str(cs.consultation_id) if cs.consultation_id else None,
        "livekit_room_name": cs.livekit_room_name,
        "call_status": cs.call_status,
        "started_at": cs.started_at.isoformat() if cs.started_at else None,
        "ended_at": cs.ended_at.isoformat() if cs.ended_at else None,
        "duration_seconds": cs.duration_seconds,
        "astrologer_consent_at": cs.astrologer_consent_at.isoformat() if cs.astrologer_consent_at else None,
        "client_consent_at": cs.client_consent_at.isoformat() if cs.client_consent_at else None,
        "recording_started_at": cs.recording_started_at.isoformat() if cs.recording_started_at else None,
        "client_join_token_expires_at": cs.client_join_token_expires_at.isoformat() if cs.client_join_token_expires_at else None,
        "audio_storage_path": cs.audio_storage_path,
        "transcript_text": cs.transcript_text,
        "transcript_segments": cs.transcript_segments,
        "summary_text": cs.summary_text,
        "key_points": cs.key_points,
        "client_facing_summary": cs.client_facing_summary,
        "processing_error": cs.processing_error,
        "created_at": cs.created_at.isoformat() if cs.created_at else None,
    }
    if join_url:
        d["join_url"] = join_url
    return d


# ---------------------------------------------------------------------------
# Astrologer — CRUD + call management
# ---------------------------------------------------------------------------

class CallSessionCreate(BaseModel):
    user_id: UUID
    consultation_id: Optional[UUID] = None


class CallSessionList(BaseModel):
    user_id: Optional[UUID] = None


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a new call session")
def create_call_session(
    payload: CallSessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    # Verify client belongs to this astrologer
    user = db.query(User).filter(
        User.user_id == payload.user_id,
        User.astrologer_id == auth.astrologer.id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Client not found")

    # Optionally verify consultation ownership
    if payload.consultation_id:
        c = db.query(Consultation).filter(
            Consultation.id == payload.consultation_id,
            Consultation.astrologer_id == auth.astrologer.id,
        ).first()
        if not c:
            raise HTTPException(status_code=404, detail="Consultation not found")

    # Generate client join token
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = _utcnow() + timedelta(hours=_JOIN_TOKEN_TTL_HOURS)

    cs = CallSession(
        astrologer_id=auth.astrologer.id,
        user_id=payload.user_id,
        consultation_id=payload.consultation_id,
        livekit_room_name=livekit_service.generate_room_name(str(UUID(int=0))),  # temp — refreshed after insert
        client_join_token_hash=token_hash,
        client_join_token_expires_at=expires_at,
        call_status="created",
    )
    db.add(cs)
    db.flush()  # Get the UUID

    # Set the real room name now that we have the ID
    cs.livekit_room_name = livekit_service.generate_room_name(str(cs.id))
    db.commit()
    db.refresh(cs)

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="call_session.create",
        resource_type="call_session",
        resource_id=str(cs.id),
        result="success",
    )

    join_url = _build_join_url(raw_token, request)
    return _serialize(cs, join_url=join_url)


@router.get("", summary="List call sessions for a client or all sessions")
def list_call_sessions(
    request: Request,
    user_id: Optional[UUID] = None,
    include_non_terminal: bool = Query(
        False,
        description="Include active, created, and processing sessions in the response",
    ),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    q = db.query(CallSession).filter(CallSession.astrologer_id == auth.astrologer.id)
    if user_id:
        q = q.filter(CallSession.user_id == user_id)
    if not include_non_terminal:
        q = q.filter(CallSession.call_status.in_(TERMINAL_CALL_SESSION_STATUSES))
    sessions = q.order_by(CallSession.created_at.desc()).all()
    return [_serialize(cs) for cs in sessions]


@router.get("/{session_id}", summary="Get a single call session")
def get_call_session(
    session_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    cs = _ensure_session_access(db, auth, session_id)
    user = db.query(User).filter(User.user_id == cs.user_id).first()
    return _serialize(cs, user=user)


@router.post("/{session_id}/token", summary="Get astrologer LiveKit token")
def get_astrologer_token(
    session_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    cs = _ensure_session_access(db, auth, session_id)

    if cs.call_status == "failed":
        raise HTTPException(status_code=400, detail="Call session has failed")

    if not livekit_service.is_configured():
        raise HTTPException(status_code=503, detail="Video call service not configured")

    astrologer = auth.astrologer
    display_name = f"{astrologer.first_name or ''} {astrologer.last_name or ''}".strip() or "Astrologer"

    token = livekit_service.generate_astrologer_token(
        room_name=cs.livekit_room_name,
        astrologer_id=str(astrologer.id),
        display_name=display_name,
    )

    # Mark as active on first token fetch
    if cs.call_status == "created":
        cs.call_status = "active"
        cs.started_at = _utcnow()
        db.commit()

    return {
        "token": token,
        "livekit_url": os.getenv("LIVEKIT_URL", ""),
        "room_name": cs.livekit_room_name,
        "call_status": cs.call_status,
    }


@router.post("/{session_id}/consent", summary="Record astrologer recording consent")
def astrologer_consent(
    session_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    cs = _ensure_session_access(db, auth, session_id)

    if cs.astrologer_consent_at:
        return {"message": "Consent already recorded", "call_status": cs.call_status}

    cs.astrologer_consent_at = _utcnow()
    db.commit()

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="call_session.astrologer_consent",
        resource_type="call_session",
        resource_id=str(cs.id),
        result="success",
    )

    return {
        "message": "Consent recorded",
        "both_consented": cs.client_consent_at is not None,
        "call_status": cs.call_status,
    }


@router.post("/{session_id}/start-recording", summary="Start audio recording (requires both consents)")
async def start_recording(
    session_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    assert_feature_enabled(auth.astrologer, FEATURE_RECORDING, plan_code=auth.effective_plan_code)
    cs = _ensure_session_access(db, auth, session_id)

    if cs.recording_started_at:
        return {"message": "Recording already started", "egress_id": cs.livekit_egress_id}

    if not cs.astrologer_consent_at:
        raise HTTPException(status_code=400, detail="Astrologer recording consent required first")

    if not cs.client_consent_at:
        raise HTTPException(status_code=400, detail="Client recording consent required first")

    if not livekit_service.is_configured():
        raise HTTPException(status_code=503, detail="Video call service not configured")

    astrologer = auth.astrologer
    expected_storage_path = livekit_service.build_storage_path(
        call_session_id=str(cs.id),
        astrologer_id=str(astrologer.id),
        user_id=str(cs.user_id),
    )
    egress_id = await livekit_service.start_audio_egress(
        room_name=cs.livekit_room_name,
        call_session_id=str(cs.id),
        astrologer_id=str(astrologer.id),
        user_id=str(cs.user_id),
    )

    cs.livekit_egress_id = egress_id
    # Keep expected path even before webhook arrives, so manual reprocess remains possible.
    cs.audio_storage_path = cs.audio_storage_path or expected_storage_path
    cs.recording_started_at = _utcnow()
    db.commit()

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="call_session.recording_start",
        resource_type="call_session",
        resource_id=str(cs.id),
        result="success",
    )

    return {"message": "Recording started", "egress_id": egress_id}


@router.post("/{session_id}/stop-recording", summary="Stop audio recording")
async def stop_recording(
    session_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    assert_feature_enabled(auth.astrologer, FEATURE_RECORDING, plan_code=auth.effective_plan_code)
    cs = _ensure_session_access(db, auth, session_id)

    if not cs.livekit_egress_id:
        raise HTTPException(status_code=400, detail="No active recording")

    await livekit_service.stop_egress(cs.livekit_egress_id)

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="call_session.recording_stop",
        resource_type="call_session",
        resource_id=str(cs.id),
        result="success",
    )

    return {"message": "Recording stopped"}


@router.post("/{session_id}/end", summary="End the call and trigger post-processing")
async def end_call(
    session_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    cs = _ensure_session_access(db, auth, session_id)

    if cs.call_status in ("ended", "processing", "completed", "failed"):
        return {"message": "Call already ended", "call_status": cs.call_status}

    now = _utcnow()
    cs.call_status = "ended"
    cs.ended_at = now
    if cs.started_at:
        cs.duration_seconds = int((now - cs.started_at).total_seconds())

    # Stop egress if still running
    if cs.livekit_egress_id:
        try:
            await livekit_service.stop_egress(cs.livekit_egress_id)
        except Exception as e:
            logger.warning(f"Could not stop egress on call end: {e}")

    db.commit()

    # Clean up LiveKit room in background
    room_name = cs.livekit_room_name
    background_tasks.add_task(_cleanup_room, room_name)

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="call_session.end",
        resource_type="call_session",
        resource_id=str(cs.id),
        result="success",
    )

    return {
        "message": "Call ended",
        "call_status": cs.call_status,
        "duration_seconds": cs.duration_seconds,
    }


@router.get("/{session_id}/audio-url", summary="Get a signed URL for the recorded audio (1 hr TTL)")
def get_audio_url(
    session_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    assert_feature_enabled(auth.astrologer, FEATURE_RECORDING, plan_code=auth.effective_plan_code)
    cs = _ensure_session_access(db, auth, session_id)
    if not cs.audio_storage_path:
        raise HTTPException(status_code=404, detail="No recording available yet")
    if not storage_service.is_configured():
        raise HTTPException(status_code=503, detail="Storage service not configured")
    try:
        url = storage_service.get_signed_url(cs.audio_storage_path, expires_in=3600)
        return {"url": url, "expires_in": 3600}
    except Exception as e:
        logger.error(f"Could not generate audio URL for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not generate audio URL")


@router.post("/{session_id}/reprocess", summary="Re-trigger post-call pipeline (for failed/stuck sessions)")
async def reprocess_call(
    session_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_auth),
):
    assert_feature_enabled(auth.astrologer, FEATURE_CALLS, plan_code=auth.effective_plan_code)
    assert_feature_enabled(auth.astrologer, FEATURE_RECORDING, plan_code=auth.effective_plan_code)
    cs = _ensure_session_access(db, auth, session_id)

    if not cs.audio_storage_path:
        raise HTTPException(status_code=400, detail="No audio recording available to process")

    if cs.call_status == "processing":
        raise HTTPException(status_code=400, detail="Session is already being processed")

    cs.call_status      = "processing"
    cs.processing_error = None
    db.commit()

    background_tasks.add_task(run_post_call_pipeline, cs.id)

    create_audit_event(
        db, request,
        actor_id=auth.astrologer.id,
        action="call_session.reprocess",
        resource_type="call_session",
        resource_id=str(cs.id),
        result="success",
    )
    return {"message": "Reprocessing started", "call_status": "processing"}


# ---------------------------------------------------------------------------
# Client join (unauthenticated — token-based)
# ---------------------------------------------------------------------------

class ClientJoinRequest(BaseModel):
    token: str
    display_name: Optional[str] = None


@router.post("/join", summary="Client joins a call via token (unauthenticated)")
def client_join(payload: ClientJoinRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(payload.token)
    cs = db.query(CallSession).filter(
        CallSession.client_join_token_hash == token_hash
    ).first()

    if not cs:
        raise HTTPException(status_code=404, detail="Invalid or expired call link")

    now = _utcnow()
    if cs.client_join_token_expires_at and cs.client_join_token_expires_at < now:
        raise HTTPException(status_code=410, detail="Call link has expired")

    if cs.call_status in ("completed", "failed"):
        raise HTTPException(status_code=410, detail="This call has ended")

    if not livekit_service.is_configured():
        raise HTTPException(status_code=503, detail="Video call service not configured")

    # Fetch names for display
    user = db.query(User).filter(User.user_id == cs.user_id).first()
    astrologer = db.query(Astrologer).filter(Astrologer.id == cs.astrologer_id).first()

    client_name = payload.display_name
    if not client_name and user:
        client_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "Client"

    astrologer_name = ""
    if astrologer:
        astrologer_name = f"{astrologer.first_name or ''} {astrologer.last_name or ''}".strip() or "Astrologer"

    lk_token = livekit_service.generate_client_token(
        room_name=cs.livekit_room_name,
        user_id=str(cs.user_id),
        display_name=client_name or "Client",
    )

    return {
        "session_id": str(cs.id),
        "token": lk_token,
        "livekit_url": os.getenv("LIVEKIT_URL", ""),
        "room_name": cs.livekit_room_name,
        "call_status": cs.call_status,
        "astrologer_name": astrologer_name,
        "client_name": client_name,
        "recording_active": cs.recording_started_at is not None,
    }


@router.post("/join/{raw_token}/consent", summary="Client gives recording consent")
def client_consent(raw_token: str, db: Session = Depends(get_db)):
    token_hash = _hash_token(raw_token)
    cs = db.query(CallSession).filter(
        CallSession.client_join_token_hash == token_hash
    ).first()

    if not cs:
        raise HTTPException(status_code=404, detail="Invalid call link")

    if cs.client_consent_at:
        return {"message": "Consent already recorded", "both_consented": cs.astrologer_consent_at is not None}

    cs.client_consent_at = _utcnow()
    db.commit()

    return {
        "message": "Consent recorded",
        "both_consented": cs.astrologer_consent_at is not None,
    }


# ---------------------------------------------------------------------------
# LiveKit webhook
# ---------------------------------------------------------------------------

@router.post("/webhooks/livekit", summary="LiveKit webhook receiver", include_in_schema=False)
async def livekit_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    body = await request.body()
    try:
        event = livekit_service.verify_webhook(body, authorization or "")
    except ValueError as e:
        logger.warning(f"LiveKit webhook signature invalid: {e}")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event_type = getattr(event, "event", None)
    logger.info(f"LiveKit webhook event: {event_type}")

    # Room finished — auto-end any session still active (handles unexpected disconnects)
    if event_type == "room_finished":
        room = getattr(event, "room", None)
        if room:
            cs = db.query(CallSession).filter(
                CallSession.livekit_room_name == room.name,
                CallSession.call_status.in_(["created", "active"]),
            ).first()
            if cs:
                now = _utcnow()
                cs.call_status = "ended"
                cs.ended_at    = now
                if cs.started_at:
                    cs.duration_seconds = int((now - cs.started_at).total_seconds())
                db.commit()
                logger.info(f"Room finished — auto-ended session {cs.id}")

    # Egress ended — audio file is now in Supabase Storage → trigger processing pipeline
    if event_type == "egress_ended":
        egress = getattr(event, "egress_info", None)
        if egress:
            cs = db.query(CallSession).filter(
                CallSession.livekit_egress_id == egress.egress_id
            ).first()
            if cs:
                file_results = getattr(egress, "file_results", [])
                if file_results:
                    cs.audio_storage_path = file_results[0].filename
                    cs.audio_duration_seconds = int(getattr(egress, "duration", 0) / 1_000_000_000)
                db.commit()
                if cs.call_status in ("processing", "completed", "failed"):
                    logger.info(f"Duplicate egress_ended webhook — session {cs.id} already {cs.call_status}, skipping pipeline")
                else:
                    logger.info(f"Egress completed for call session {cs.id} — queuing pipeline")
                    background_tasks.add_task(run_post_call_pipeline, cs.id)

    return {"ok": True}


# ---------------------------------------------------------------------------
# Background helpers
# ---------------------------------------------------------------------------

async def _cleanup_room(room_name: str) -> None:
    try:
        await livekit_service.delete_room(room_name)
    except Exception as e:
        logger.warning(f"Room cleanup failed for {room_name}: {e}")
