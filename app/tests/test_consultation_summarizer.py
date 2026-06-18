"""
Tests for Consultation Summarizer v1.

Covers the two highest-risk areas from the /autoplan eng review:
  - §10 validation + enum fallback + id echo (pure, no DB)
  - idempotent AI-memory append (reprocess must NOT double client history)
  - immutable transcript is INSERT-once
"""
import uuid
from datetime import date, time as time_type

import pytest

from app.services.consultation_summary import (
    SUMMARY_JSON_SCHEMA,
    validate_summary,
    SummaryValidationError,
    build_prompt,
)
from app.tests.api_test_db import (
    create_sqlite_test_session_factory,
    reset_sqlite_schema,
)


# ── §10 validation (pure) ────────────────────────────────────────────────────

def _good():
    return {
        "schema_version": "1.0",
        "session": {"session_id": "x", "client_id": "y", "consultation_types": ["natal"], "language": "en"},
        "session_summary": {"brief": "b", "detailed": "d"},
        "client_facing_report": {"text": "t", "review_required": True},
        "key_points": [{"category": "life_context", "text": "k", "mentioned_by": "client"}],
        "memory_entries_to_append": [{"category": "career", "text": "m", "mentioned_by": "client"}],
        "open_questions_or_unclear_items": [],
    }


def test_validate_forces_session_and_client_id():
    out = validate_summary(_good(), session_id="SESS", client_id="CLI")
    assert out["session"]["session_id"] == "SESS"
    assert out["session"]["client_id"] == "CLI"


def test_validate_forces_review_required_true():
    data = _good()
    data["client_facing_report"]["review_required"] = False
    out = validate_summary(data, "s", "c")
    assert out["client_facing_report"]["review_required"] is True


def test_validate_enum_fallbacks():
    data = _good()
    data["session"]["consultation_types"] = ["natal", "bogus"]
    data["key_points"][0]["category"] = "not_a_category"
    data["key_points"][0]["mentioned_by"] = "alien"
    data["memory_entries_to_append"][0]["category"] = "nope"
    data["open_questions_or_unclear_items"] = [{"text": "o", "reason": "bad", "mentioned_by": "??"}]
    out = validate_summary(data, "s", "c")
    assert out["session"]["consultation_types"] == ["natal", "unknown"]
    assert out["key_points"][0]["category"] == "life_context"
    assert out["key_points"][0]["mentioned_by"] == "both"
    assert out["memory_entries_to_append"][0]["category"] == "other"
    assert out["open_questions_or_unclear_items"][0]["reason"] == "ambiguous_statement"
    assert out["open_questions_or_unclear_items"][0]["mentioned_by"] == "unknown"


def test_validate_structural_failure_raises():
    with pytest.raises(SummaryValidationError):
        validate_summary({"schema_version": "1.0"}, "s", "c")  # no session
    with pytest.raises(SummaryValidationError):
        validate_summary({"schema_version": "1.0", "session": {}, "session_summary": {}}, "s", "c")


def test_schema_is_strict_compatible():
    # Every object must list all props as required + additionalProperties False.
    def check(node):
        if isinstance(node, dict) and node.get("type") == "object":
            props = set(node.get("properties", {}).keys())
            req = set(node.get("required", []))
            assert props == req, f"strict mode needs all props required: {props ^ req}"
            assert node.get("additionalProperties") is False
            for v in node["properties"].values():
                check(v)
        if isinstance(node, dict) and node.get("type") == "array":
            check(node["items"])
    check(SUMMARY_JSON_SCHEMA)


def test_build_prompt_injects_ids():
    p = build_prompt("S1", "C1", "hello transcript")
    assert "S1" in p and "C1" in p and "hello transcript" in p
    assert "third person" in p  # faithful rule present


# ── Pipeline idempotency (SQLite) ────────────────────────────────────────────

@pytest.fixture
def db(tmp_path):
    engine, factory = create_sqlite_test_session_factory(str(tmp_path / "t.db"))
    reset_sqlite_schema(engine)
    session = factory()
    yield session
    session.close()


def _seed_call_session(db):
    from app.database.models import Astrologer, User, CallSession
    astro = Astrologer(id=uuid.uuid4(), email="a@x.com", password_hash="h", auth_provider="local", is_active=True)
    db.add(astro); db.commit()
    user = User(
        user_id=uuid.uuid4(), astrologer_id=astro.id, birth_date=date(1990, 1, 1),
        birth_time=time_type(12, 0), timezone="UTC", birth_place="X", lat=0.0, lon=0.0, julian_day=2447892.5,
    )
    db.add(user); db.commit()
    cs = CallSession(
        id=uuid.uuid4(), astrologer_id=astro.id, user_id=user.user_id,
        livekit_room_name=f"room-{uuid.uuid4()}", call_status="processing",
    )
    db.add(cs); db.commit()
    return cs


def test_append_ai_memory_is_idempotent(db):
    """Reprocess (running _append_ai_memory twice) must NOT double client history."""
    from app.services.processing_pipeline import _append_ai_memory
    from app.database.models import ClientMemoryEntry
    cs = _seed_call_session(db)
    entries = [
        {"category": "career", "text": "Wants a career change", "mentioned_by": "client"},
        {"category": "timing", "text": "Watch the next 3 months", "mentioned_by": "astrologer"},
    ]
    _append_ai_memory(db, cs, entries)
    _append_ai_memory(db, cs, entries)  # simulate reprocess
    n = db.query(ClientMemoryEntry).filter(
        ClientMemoryEntry.call_session_id == cs.id,
        ClientMemoryEntry.deleted_at.is_(None),
    ).count()
    assert n == 2  # exactly one set, not four


def test_append_ai_memory_preserves_astrologer_edits(db):
    """An astrologer-edited AI row (edited_at set) survives reprocess."""
    from app.services.processing_pipeline import _append_ai_memory
    from app.database.models import ClientMemoryEntry
    from datetime import datetime
    cs = _seed_call_session(db)
    _append_ai_memory(db, cs, [{"category": "career", "text": "orig", "mentioned_by": "client"}])
    row = db.query(ClientMemoryEntry).filter(ClientMemoryEntry.call_session_id == cs.id).first()
    row.edited_at = datetime.utcnow()
    row.text = "edited by astrologer"
    db.commit()
    # Reprocess with fresh AI output
    _append_ai_memory(db, cs, [{"category": "career", "text": "new ai text", "mentioned_by": "client"}])
    texts = {r.text for r in db.query(ClientMemoryEntry).filter(
        ClientMemoryEntry.call_session_id == cs.id, ClientMemoryEntry.deleted_at.is_(None)).all()}
    assert "edited by astrologer" in texts  # preserved
    assert "new ai text" in texts           # new one added


def test_store_immutable_transcript_insert_once(db):
    from app.services.processing_pipeline import _store_immutable_transcript
    from app.database.models import ConsultationTranscript
    cs = _seed_call_session(db)
    _store_immutable_transcript(db, cs, "first transcript", [])
    _store_immutable_transcript(db, cs, "OVERWRITE ATTEMPT", [])  # must be a no-op
    rows = db.query(ConsultationTranscript).filter(ConsultationTranscript.call_session_id == cs.id).all()
    assert len(rows) == 1
    assert rows[0].transcript_text == "first transcript"  # immutable
