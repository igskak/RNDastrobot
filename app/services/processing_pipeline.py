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
import json
from datetime import datetime, timezone
from uuid import UUID

from loguru import logger
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import (
    CallSession, Astrologer, Person, User, ConsultationTranscript, ClientMemoryEntry,
)
from app.services.storage_service import storage_service
from app.services.transcription_service import transcription_service
from app.services.openai_service import openai_service
from app.services.consultation_summary import SummaryValidationError

# Soft guard: gpt-4.1 has huge context, but cap absurdly long transcripts so a
# runaway recording can't blow the token budget. ~4 chars/token → 500k chars ≈ 125k tok.
_MAX_TRANSCRIPT_CHARS = 500_000


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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

    person = db.query(Person).filter(Person.person_id == cs.person_id).first() if cs.person_id else None
    user = db.query(User).filter(User.user_id == cs.user_id).first() if cs.user_id else None
    if person:
        client_name = (
            person.display_name
            or f"{person.first_name or ''} {person.last_name or ''}".strip()
            or "Client"
        )
    elif user:
        client_name = (
            f"{user.first_name or ''} {user.last_name or ''}".strip()
            or "Client"
        )

    transcript_result = transcription_service.transcribe(signed_url)
    transcript_text   = transcript_result.get("text", "")
    segments          = transcript_result.get("segments", [])

    # Display cache on the call row (canonical copy is consultation_transcripts).
    cs.transcript_text     = transcript_text
    cs.transcript_segments = segments
    db.commit()

    # Immutable source-of-truth transcript (spec §2.1) — INSERT-once per session.
    _store_immutable_transcript(db, cs, transcript_text, segments)
    logger.info(f"Pipeline: transcript saved ({len(transcript_text)} chars)")

    # ── 3. Summarize (v1 §4 contract) ──────────────────────────────────────────
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

    if len(transcript_text) > _MAX_TRANSCRIPT_CHARS:
        logger.warning(
            f"Pipeline: transcript {len(transcript_text)} chars exceeds cap — truncating for summary"
        )
        transcript_text = transcript_text[:_MAX_TRANSCRIPT_CHARS]

    # The summary call can fail in routine ways now (bad JSON, refusal, §10 validation).
    # A failure here must NOT discard the transcript we already committed above.
    try:
        result = _summarize_with_retry(
            transcript_text=transcript_text,
            segments=segments,
            session_id=str(cs.id),
            client_id=str(cs.person_id or cs.user_id),
            astrologer_name=astrologer_name,
            client_name=client_name,
        )
    except (SummaryValidationError, ValueError, RuntimeError) as e:
        logger.error(f"Pipeline: summary failed for {session_id} (transcript preserved): {e}")
        cs.call_status  = "summary_failed"
        cs.summary_error = str(e)[:500]
        db.commit()
        return

    summary_obj = result["summary"]
    cs.summary_json            = summary_obj
    cs.summary_schema_version  = summary_obj.get("schema_version", "1.0")
    cs.ai_model_used           = result.get("model")
    cs.summary_error           = None
    # Seed the editable client report draft from the generated text (first run only).
    if cs.client_report_edited is None:
        cs.client_report_edited = summary_obj.get("client_facing_report", {}).get("text", "")
    cs.call_status = "completed"
    db.commit()

    # ── 4. Append AI memory entries (idempotent — never doubles on reprocess) ──
    _append_ai_memory(db, cs, summary_obj.get("memory_entries_to_append", []))
    logger.info(f"Pipeline DONE — session {session_id} → completed")


def _store_immutable_transcript(db: Session, cs: CallSession, transcript_text: str, segments: list) -> None:
    """INSERT-once. Re-runs (reprocess/recovery) are no-ops — transcript is immutable."""
    exists = db.query(ConsultationTranscript).filter(
        ConsultationTranscript.call_session_id == cs.id
    ).first()
    if exists:
        return
    db.add(ConsultationTranscript(
        call_session_id=cs.id,
        astrologer_id=cs.astrologer_id,
        user_id=cs.user_id,
        person_id=cs.person_id,
        transcript_text=transcript_text,
        transcript_segments=segments,
    ))
    db.commit()


def _summarize_with_retry(**kwargs) -> dict:
    """Bounded retry: one transient-failure retry before giving up. Transcription
    already cost 1-3 min — don't throw that away on a single flaky completion."""
    last_exc = None
    for attempt in (1, 2):
        try:
            return openai_service.summarize_consultation(**kwargs)
        except (json.JSONDecodeError, SummaryValidationError, RuntimeError) as e:
            last_exc = e
            logger.warning(f"Summary attempt {attempt} failed: {e}")
    raise last_exc


def _append_ai_memory(db: Session, cs: CallSession, entries: list) -> None:
    """Append source='ai' memory entries for this session. Idempotent: delete prior
    UN-EDITED ai rows for the session first, so reprocess never doubles client history.
    Astrologer-edited rows (edited_at set) are preserved."""
    if not entries:
        return
    # Remove prior un-edited AI rows for this session (preserve astrologer-touched ones).
    db.query(ClientMemoryEntry).filter(
        ClientMemoryEntry.call_session_id == cs.id,
        ClientMemoryEntry.source == "ai",
        ClientMemoryEntry.edited_at.is_(None),
        ClientMemoryEntry.deleted_at.is_(None),
    ).delete(synchronize_session=False)

    seen = set()
    for e in entries:
        body = (e.get("text") or "").strip()
        if not body or body in seen:
            continue
        seen.add(body)
        db.add(ClientMemoryEntry(
            call_session_id=cs.id,
            astrologer_id=cs.astrologer_id,
            user_id=cs.user_id,
            person_id=cs.person_id,
            category=e.get("category", "other"),
            text=body,
            mentioned_by=e.get("mentioned_by", "both"),
            source="ai",
            origin="consultation_ai",
        ))
    db.commit()
    logger.info(f"Pipeline: {len(seen)} AI memory entries appended for session {cs.id}")


def _mark_failed(db: Session, session_id: UUID, error: str) -> None:
    try:
        db.rollback()   # clear any failed transaction state
        cs = db.query(CallSession).filter(CallSession.id == session_id).first()
        if cs:
            cs.call_status      = "failed"
            cs.processing_error = error[:500]
            db.commit()
    except Exception as e:
        logger.error(f"Could not mark session {session_id} as failed: {e}")


def recover_stuck_sessions() -> None:
    """
    Re-queue sessions that were left in 'processing' state (e.g. after a
    server restart).  Called once at app startup in a background thread.
    """
    import threading
    from datetime import datetime, timezone, timedelta

    def _do_recover() -> None:
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10)
            stuck = (
                db.query(CallSession)
                .filter(
                    CallSession.call_status == "processing",
                    CallSession.updated_at < cutoff,
                )
                .all()
            )
            if stuck:
                logger.warning(f"Recovering {len(stuck)} stuck processing session(s)")
                for cs in stuck:
                    run_post_call_pipeline(cs.id)
        except Exception as e:
            logger.error(f"Stuck-session recovery error: {e}")
        finally:
            try:
                next(db_gen)
            except StopIteration:
                pass

    threading.Thread(target=_do_recover, daemon=True).start()
