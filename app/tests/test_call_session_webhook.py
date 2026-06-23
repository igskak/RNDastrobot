"""Tests for the LiveKit egress webhook handling in call_sessions.

Focus: a FAILED egress (e.g. Supabase HTTP 413 EntityTooLarge on an oversized
recording) must mark the session failed with the real error and must NOT run the
post-call pipeline against a file that never landed in storage. A COMPLETE egress
records the file path and queues the pipeline as before.
"""
import os
import uuid
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./_call_webhook_test.db")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_JWT_AUDIENCE", "authenticated")

from livekit.api import EgressStatus  # noqa: E402

from app.api.main import app  # noqa: E402
from app.api.routes import call_sessions as cs_route  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import CallSession  # noqa: E402
from app.tests.api_test_db import (  # noqa: E402
    create_sqlite_test_session_factory,
    make_get_db_override,
    reset_sqlite_schema,
)

WEBHOOK_URL = "/api/v1/call-sessions/webhooks/livekit"

engine, SessionFactory = create_sqlite_test_session_factory("./_call_webhook_test.sqlite3")


@pytest.fixture(autouse=True)
def _db_and_overrides(monkeypatch):
    reset_sqlite_schema(engine)
    app.dependency_overrides[get_db] = make_get_db_override(SessionFactory)
    yield
    app.dependency_overrides.clear()


def _seed_session(egress_id: str, call_status: str = "ended") -> str:
    db = SessionFactory()
    try:
        cs = CallSession(
            astrologer_id=uuid4(),
            user_id=uuid4(),
            livekit_room_name=f"call-{uuid4()}",
            livekit_egress_id=egress_id,
            call_status=call_status,
        )
        db.add(cs)
        db.commit()
        return str(cs.id)
    finally:
        db.close()


def _patch_event(monkeypatch, event):
    monkeypatch.setattr(cs_route.livekit_service, "verify_webhook", lambda body, auth: event)


def _patch_pipeline(monkeypatch):
    calls = []
    monkeypatch.setattr(cs_route, "run_post_call_pipeline", lambda session_id: calls.append(str(session_id)))
    return calls


def test_egress_failed_marks_session_failed_and_skips_pipeline(monkeypatch):
    egress_id = "EG_fail"
    session_id = _seed_session(egress_id)
    pipeline_calls = _patch_pipeline(monkeypatch)

    event = SimpleNamespace(
        event="egress_ended",
        egress_info=SimpleNamespace(
            egress_id=egress_id,
            status=EgressStatus.EGRESS_FAILED,
            error="S3 upload failed: api error EntityTooLarge: The object exceeded the maximum allowed size",
            file_results=[],
            duration=0,
        ),
    )
    _patch_event(monkeypatch, event)

    with TestClient(app) as client:
        resp = client.post(WEBHOOK_URL, content=b"{}", headers={"Authorization": "Bearer x"})

    assert resp.status_code == 200

    db = SessionFactory()
    try:
        cs = db.query(CallSession).filter(CallSession.id == uuid.UUID(session_id)).first()
        assert cs.call_status == "failed"
        assert "EntityTooLarge" in (cs.processing_error or "")
        assert cs.processing_error.startswith("Recording failed:")
    finally:
        db.close()

    assert pipeline_calls == [], "pipeline must not run when the recording failed to upload"


def test_egress_failed_does_not_clobber_completed_session(monkeypatch):
    egress_id = "EG_dup"
    session_id = _seed_session(egress_id, call_status="completed")
    _patch_pipeline(monkeypatch)

    event = SimpleNamespace(
        event="egress_ended",
        egress_info=SimpleNamespace(
            egress_id=egress_id,
            status=EgressStatus.EGRESS_ABORTED,
            error="late failure",
            file_results=[],
            duration=0,
        ),
    )
    _patch_event(monkeypatch, event)

    with TestClient(app) as client:
        resp = client.post(WEBHOOK_URL, content=b"{}", headers={"Authorization": "Bearer x"})
    assert resp.status_code == 200

    db = SessionFactory()
    try:
        cs = db.query(CallSession).filter(CallSession.id == uuid.UUID(session_id)).first()
        assert cs.call_status == "completed"  # preserved
    finally:
        db.close()


def test_egress_complete_records_file_and_queues_pipeline(monkeypatch):
    egress_id = "EG_ok"
    session_id = _seed_session(egress_id)
    pipeline_calls = _patch_pipeline(monkeypatch)

    event = SimpleNamespace(
        event="egress_ended",
        egress_info=SimpleNamespace(
            egress_id=egress_id,
            status=EgressStatus.EGRESS_COMPLETE,
            error="",
            file_results=[SimpleNamespace(filename="a1/u1/rec.ogg")],
            duration=60 * 1_000_000_000,  # 60s in ns
        ),
    )
    _patch_event(monkeypatch, event)

    with TestClient(app) as client:
        resp = client.post(WEBHOOK_URL, content=b"{}", headers={"Authorization": "Bearer x"})
    assert resp.status_code == 200

    db = SessionFactory()
    try:
        cs = db.query(CallSession).filter(CallSession.id == uuid.UUID(session_id)).first()
        assert cs.audio_storage_path == "a1/u1/rec.ogg"
        assert cs.audio_duration_seconds == 60
    finally:
        db.close()

    assert pipeline_calls == [session_id]
