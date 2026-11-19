"""Lifecycle rules for call sessions that nobody finished.

A session turns "active" as soon as the call page fetches the astrologer's
LiveKit token. LiveKit only creates the room when someone actually connects, so
when the astrologer opens the call page and leaves before connecting there is
no room, no ``room_finished`` webhook, and the session stays "created"/"active"
forever. Once the client's join link has expired nobody can join any more, so a
session without a recording is over by then and is closed as "ended".
"""
from datetime import datetime, timezone
from typing import Iterable, Optional

from loguru import logger
from sqlalchemy.orm import Session

from app.database.models import CallSession

OPEN_CALL_SESSION_STATUSES = ("created", "active")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_abandoned(cs: CallSession, now: Optional[datetime] = None) -> bool:
    """True when the session never finished and can no longer be joined.

    Sessions with a recording are left alone: the egress webhook owns them.
    """
    if cs.call_status not in OPEN_CALL_SESSION_STATUSES:
        return False
    if cs.recording_started_at is not None or cs.livekit_egress_id:
        return False
    expires_at = cs.client_join_token_expires_at
    if expires_at is None:
        return False
    return expires_at <= (now or _utcnow())


def close_abandoned_call_sessions(db: Session, sessions: Iterable[CallSession]) -> int:
    """Mark abandoned sessions as "ended" and commit. Returns how many changed.

    ``ended_at`` is set to the moment the join link expired rather than "now",
    and the duration stays empty because no call took place that we can measure.
    """
    now = _utcnow()
    closed = 0
    for cs in sessions:
        if not is_abandoned(cs, now):
            continue
        cs.call_status = "ended"
        cs.ended_at = cs.client_join_token_expires_at
        closed += 1
        logger.info(f"Closed abandoned call session {cs.id}")
    if closed:
        db.commit()
    return closed
