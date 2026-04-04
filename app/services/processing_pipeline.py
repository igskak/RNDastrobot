"""
Post-call processing pipeline.
Called as a FastAPI BackgroundTask after egress ends.

Flow:
  1. Generate signed URL for audio file
  2. Transcribe with AssemblyAI (blocking poll — takes 1-3 min)
  3. Summarize with OpenAI
  4. Persist results to call_sessions DB row
  5. Update call_status → "completed" (or "failed")
"""
from uuid import UUID

from loguru import logger
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import CallSession, Astrologer, User
from app.services.storage_service import storage_service
from app.services.transcription_service import transcription_service
from app.services.openai_service import openai_service


def run_post_call_pipeline(session_id: UUID) -> None:
    """Entry point for BackgroundTasks — creates its own DB session."""
    db_gen = get_db()
    db: Session = next(db_gen)
    try:
        _process(db, session_id)
    except Exception as e:
        logger.error(f"Post-call pipeline crashed for session {session_id}: {e}")
        _mark_failed(db, session_id, str(e))
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


def _process(db: Session, session_id: UUID) -> None:
    cs = db.query(CallSession).filter(CallSession.id == session_id).first()
    if not cs:
        logger.warning(f"Pipeline: session {session_id} not found — skipping")
        return

    if not cs.audio_storage_path:
        logger.warning(f"Pipeline: session {session_id} has no audio_storage_path — skipping")
        return

    logger.info(f"Pipeline START — session {session_id}")
    cs.call_status = "processing"
    db.commit()

    # ── 1. Signed URL ──────────────────────────────────────────────────────────
    try:
        signed_url = storage_service.get_signed_url(cs.audio_storage_path, expires_in=7200)
    except Exception as e:
        raise RuntimeError(f"Cannot generate signed URL: {e}") from e

    # ── 2. Transcription ───────────────────────────────────────────────────────
    astrologer_name = "Astrologer"
    client_name     = "Client"

    astrologer = db.query(Astrologer).filter(Astrologer.id == cs.astrologer_id).first()
    if astrologer:
        astrologer_name = (
            f"{astrologer.first_name or ''} {astrologer.last_name or ''}".strip()
            or "Astrologer"
        )

    user = db.query(User).filter(User.user_id == cs.user_id).first()
    if user:
        client_name = (
            f"{user.first_name or ''} {user.last_name or ''}".strip()
            or "Client"
        )

    transcript_result = transcription_service.transcribe(signed_url)
    transcript_text   = transcript_result.get("text", "")
    segments          = transcript_result.get("segments", [])

    cs.transcript_text     = transcript_text
    cs.transcript_segments = segments
    db.commit()
    logger.info(f"Pipeline: transcript saved ({len(transcript_text)} chars)")

    # ── 3. Summarize ───────────────────────────────────────────────────────────
    if not openai_service.is_configured():
        logger.warning("Pipeline: OPENAI_API_KEY not set — skipping summary")
        cs.call_status = "completed"
        db.commit()
        return

    if not transcript_text.strip():
        logger.warning(f"Pipeline: empty transcript for session {session_id} — skipping summary")
        cs.call_status = "completed"
        db.commit()
        return

    summary = openai_service.summarize_consultation(
        transcript_text=transcript_text,
        segments=segments,
        astrologer_name=astrologer_name,
        client_name=client_name,
    )

    cs.summary_text          = summary.get("summary_text", "")
    cs.key_points            = summary.get("key_points", [])
    cs.client_facing_summary = summary.get("client_facing_summary", "")
    cs.call_status           = "completed"
    db.commit()
    logger.info(f"Pipeline DONE — session {session_id} → completed")


def _mark_failed(db: Session, session_id: UUID, error: str) -> None:
    try:
        cs = db.query(CallSession).filter(CallSession.id == session_id).first()
        if cs:
            cs.call_status    = "failed"
            cs.processing_error = error[:500]
            db.commit()
    except Exception as e:
        logger.error(f"Could not mark session {session_id} as failed: {e}")
