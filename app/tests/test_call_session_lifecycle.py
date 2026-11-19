"""Abandoned call sessions get closed when the astrologer looks at them.

A session turns "active" when the call page fetches the astrologer's token, but
LiveKit only creates the room (and later sends ``room_finished``) once somebody
connects. Opening the call page and leaving left sessions "active" forever.
"""
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./_call_lifecycle_test.db")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_JWT_AUDIENCE", "authenticated")

from app.api.main import app  # noqa: E402
from app.api.routes import call_sessions as cs_route  # noqa: E402
from app.auth.dependencies import AuthContext, require_auth  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import CallSession  # noqa: E402
from app.services.call_session_lifecycle import is_abandoned  # noqa: E402
from app.tests.api_test_db import (  # noqa: E402
    create_sqlite_test_session_factory,
    make_get_db_override,
    reset_sqlite_schema,
)

engine, SessionFactory = create_sqlite_test_session_factory("./_call_lifecycle_test.sqlite3")
ASTROLOGER_ID = uuid4()


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture(autouse=True)
def _db_and_overrides(monkeypatch):
    reset_sqlite_schema(engine)
    monkeypatch.setattr(cs_route, "assert_feature_enabled", lambda *args, **kwargs: None)
    app.dependency_overrides[get_db] = make_get_db_override(SessionFactory)
    app.dependency_overrides[require_auth] = lambda: AuthContext(
        astrologer=SimpleNamespace(id=ASTROLOGER_ID, plan_code="trial"),
        session=SimpleNamespace(session_id="test"),
    )
    yield
    app.dependency_overrides.clear()


def _seed(call_status: str, expires_in: timedelta, **extra) -> str:
    db = SessionFactory()
    try:
        cs = CallSession(
            astrologer_id=ASTROLOGER_ID,
            person_id=None,
            livekit_room_name=f"call-{uuid4()}",
            client_join_token_expires_at=_now() + expires_in,
            call_status=call_status,
            **extra,
        )
        db.add(cs)
        db.commit()
        return str(cs.id)
    finally:
        db.close()


def _load(session_id: str) -> CallSession:
    db = SessionFactory()
    try:
        return db.query(CallSession).filter(CallSession.id == UUID(session_id)).one()
    finally:
        db.close()


def test_is_abandoned_rules():
    past = _now() - timedelta(hours=1)
    future = _now() + timedelta(hours=1)

    def make(**kw):
        base = dict(call_status="active", recording_started_at=None, livekit_egress_id=None,
                    client_join_token_expires_at=past)
        base.update(kw)
        return SimpleNamespace(**base)

    assert is_abandoned(make())
    assert is_abandoned(make(call_status="created"))
    assert not is_abandoned(make(client_join_token_expires_at=future))
    assert not is_abandoned(make(client_join_token_expires_at=None))
    assert not is_abandoned(make(recording_started_at=past))
    assert not is_abandoned(make(livekit_egress_id="EG_1"))
    for status in ("ended", "processing", "completed", "failed", "summary_failed"):
        assert not is_abandoned(make(call_status=status))


def test_list_closes_expired_open_sessions_and_keeps_live_ones():
    stale_active = _seed("active", timedelta(hours=-2), started_at=_now() - timedelta(hours=26))
    stale_created = _seed("created", timedelta(days=-90))
    live = _seed("active", timedelta(hours=20), started_at=_now())
    recorded = _seed("active", timedelta(hours=-2), recording_started_at=_now() - timedelta(hours=26))

    response = TestClient(app).get("/api/v1/call-sessions?include_non_terminal=true")
    assert response.status_code == 200
    by_id = {row["id"]: row for row in response.json()}

    assert by_id[stale_active]["call_status"] == "ended"
    assert by_id[stale_created]["call_status"] == "ended"
    assert by_id[live]["call_status"] == "active"
    assert by_id[recorded]["call_status"] == "active"

    closed = _load(stale_active)
    assert closed.call_status == "ended"
    assert closed.ended_at == closed.client_join_token_expires_at
    assert closed.duration_seconds is None
    assert _load(live).call_status == "active"


def test_get_closes_an_expired_open_session():
    session_id = _seed("active", timedelta(minutes=-5))

    response = TestClient(app).get(f"/api/v1/call-sessions/{session_id}")
    assert response.status_code == 200
    assert response.json()["call_status"] == "ended"
    assert _load(session_id).call_status == "ended"
