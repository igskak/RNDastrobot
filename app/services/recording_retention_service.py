"""Deletes consultation audio six months after it was recorded.

The terms of service and the in-call consent notices say consultation audio is kept for
six months and then deleted automatically. This module is what makes that true.

Only the audio goes. The transcript and the summaries made from it stay on the person's
profile, because they are the reason the recording existed: an astrologer should never
have to rebuild a person's story from memory before a session. The raw voice recording
is the most sensitive thing we store, and after six months it has done its job.

Scheduling rides on the app process rather than a separate cron. Each worker runs the
purge shortly after it starts and then once a day while it lives. On Render's free plan
the service sleeps when idle, but the daily SEO monitor wakes it every morning, so the
startup pass alone guarantees a run at least daily. Rows are claimed with
`FOR UPDATE SKIP LOCKED`, so two gunicorn workers purging at the same moment each take
different rows instead of racing on the same files (on SQLite the clause is dropped,
which is fine for tests).
"""
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from loguru import logger
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import CallSession
from app.services.storage_service import storage_service

RECORDING_RETENTION_DAYS = 180

# Small enough that one batch never holds row locks for long, large enough that a backlog
# clears in a few passes.
_BATCH_SIZE = 100

# Give the worker time to finish booting before touching the database and storage.
_STARTUP_DELAY_SECONDS = 60
_INTERVAL_SECONDS = 24 * 60 * 60


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def retention_cutoff(now: Optional[datetime] = None) -> datetime:
    """Audio recorded before this moment is due for deletion."""
    return (now or _utcnow()) - timedelta(days=RECORDING_RETENTION_DAYS)


def purge_expired_recordings(db: Session, now: Optional[datetime] = None, storage=storage_service) -> int:
    """Delete audio older than the retention period. Returns how many recordings went.

    The age of a recording is taken from when recording started, falling back to when
    the call ended and then to when the session was created, for rows made before
    `recording_started_at` was reliably set.

    The database is only told the audio is gone once storage has actually removed it. A
    failed delete leaves the row untouched, so the next pass retries it instead of the
    profile claiming the audio was deleted while the file is still in the bucket.
    """
    now = now or _utcnow()
    cutoff = retention_cutoff(now)
    recorded_at = func.coalesce(
        CallSession.recording_started_at, CallSession.ended_at, CallSession.created_at,
    )

    deleted = 0
    # Rows whose delete failed are skipped for the rest of this pass, so one bad file is
    # retried tomorrow rather than on every batch of today's.
    failed_ids = set()
    while True:
        query = db.query(CallSession).filter(
            CallSession.audio_storage_path.isnot(None), recorded_at < cutoff,
        )
        if failed_ids:
            query = query.filter(CallSession.id.notin_(failed_ids))
        batch = (
            query
            .order_by(recorded_at)
            .limit(_BATCH_SIZE)
            .with_for_update(skip_locked=True)
            .all()
        )
        if not batch:
            break

        removed_this_batch = 0
        for session in batch:
            if storage.delete_file(session.audio_storage_path):
                session.audio_storage_path = None
                session.audio_deleted_at = now
                removed_this_batch += 1
            else:
                failed_ids.add(session.id)
        db.commit()
        deleted += removed_this_batch

        # Every row in a full batch failed to delete: storage is down or misconfigured.
        # Stop rather than spin on the same rows; tomorrow's pass will retry them.
        if removed_this_batch == 0:
            logger.warning(
                f"Recording retention: could not delete any of {len(batch)} expired recording(s); will retry next pass"
            )
            break
        if len(batch) < _BATCH_SIZE:
            break

    if deleted:
        logger.info(
            f"Recording retention: deleted audio for {deleted} consultation(s) recorded before {cutoff:%Y-%m-%d}"
        )
    return deleted


def _run_once() -> None:
    db_gen = get_db()
    db: Session = next(db_gen)
    try:
        purge_expired_recordings(db)
    except Exception as e:
        db.rollback()
        logger.error(f"Recording retention pass failed: {e}")
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


def start_recording_retention_worker() -> None:
    """Run the purge shortly after startup, then daily. Called from the app lifespan."""
    if not storage_service.is_configured():
        logger.info("Recording retention: storage is not configured here, worker not started")
        return

    def _loop() -> None:
        time.sleep(_STARTUP_DELAY_SECONDS)
        while True:
            _run_once()
            time.sleep(_INTERVAL_SECONDS)

    threading.Thread(target=_loop, name="recording-retention", daemon=True).start()
