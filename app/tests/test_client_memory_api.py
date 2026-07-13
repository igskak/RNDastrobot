import os
from datetime import date, time
from types import SimpleNamespace
import uuid

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_client_memory_api_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.auth.dependencies import AuthContext, require_auth  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import Astrologer, ClientMemoryEntry, Person, User  # noqa: E402
from app.tests.api_test_db import (  # noqa: E402
    create_sqlite_test_session_factory,
    make_get_db_override,
    reset_sqlite_schema,
)


engine, TestingSessionLocal = create_sqlite_test_session_factory("./_client_memory_api_test.sqlite3")


def _seed():
    db = TestingSessionLocal()
    try:
        astrologer = Astrologer(
            email=f"{uuid.uuid4()}@example.com",
            auth_provider="local",
            password_hash="hash",
            plan_code="pro",
        )
        db.add(astrologer)
        db.flush()
        person = Person(
            astrologer_id=astrologer.id,
            first_name="Client",
            last_name="Notes",
            tags=[],
        )
        db.add(person)
        db.flush()
        chart = User(
            astrologer_id=astrologer.id,
            person_id=person.person_id,
            first_name="Client",
            last_name="Notes",
            birth_date=date(1990, 1, 1),
            birth_time=time(12, 0),
            timezone="UTC",
            birth_place="Kyiv",
            lat=50.45,
            lon=30.52,
            julian_day=2447892.5,
            house_system="P",
            tags=[],
        )
        db.add(chart)
        db.flush()
        person.primary_chart_id = chart.user_id
        db.commit()
        return astrologer.id, person.person_id, chart.user_id
    finally:
        db.close()


def _auth_override(astrologer_id):
    db = TestingSessionLocal()
    try:
        astrologer = db.query(Astrologer).filter(Astrologer.id == astrologer_id).first()
        return AuthContext(astrologer=astrologer, session=SimpleNamespace(session_id="test"))
    finally:
        db.close()


def setup_function(_):
    reset_sqlite_schema(engine)
    app.dependency_overrides[get_db] = make_get_db_override(TestingSessionLocal)


def teardown_function(_):
    app.dependency_overrides.clear()


def test_create_manual_note_with_context_and_idempotency():
    astrologer_id, person_id, chart_id = _seed()
    app.dependency_overrides[require_auth] = lambda: _auth_override(astrologer_id)
    key = str(uuid.uuid4())
    payload = {
        "text": "Есть аспектация Марса к Луне на транзитах 2026-07-13",
        "origin": "assistant_voice",
        "idempotency_key": key,
        "context_snapshot": {
            "method": "transit",
            "selected_layer_id": "layer-1",
            "date": "2026-07-13",
            "time": "12:00:00",
            "timezone": "Europe/Prague",
            "wheel_view": "multi",
            "unknown": "ignored",
        },
    }

    with TestClient(app) as client:
        created = client.post(f"/api/v1/clients/{chart_id}/memory", json=payload)
        assert created.status_code == 201
        body = created.json()
        assert body["source"] == "astrologer"
        assert body["origin"] == "assistant_voice"
        assert body["context_snapshot"]["method"] == "transit"
        assert "unknown" not in body["context_snapshot"]

        duplicate = client.post(f"/api/v1/clients/{chart_id}/memory", json=payload)
        assert duplicate.status_code == 200
        assert duplicate.json()["id"] == body["id"]

        listed = client.get(f"/api/v1/persons/{person_id}/memory", params={"source": "astrologer"})
        assert listed.status_code == 200
        assert [entry["id"] for entry in listed.json()["entries"]] == [body["id"]]


def test_source_filter_separates_consultation_ai_from_notes():
    astrologer_id, person_id, chart_id = _seed()
    db = TestingSessionLocal()
    try:
        db.add(ClientMemoryEntry(
            astrologer_id=astrologer_id,
            person_id=person_id,
            user_id=chart_id,
            category="other",
            text="AI memory",
            mentioned_by="both",
            source="ai",
            origin="consultation_ai",
        ))
        db.add(ClientMemoryEntry(
            astrologer_id=astrologer_id,
            person_id=person_id,
            user_id=chart_id,
            category="other",
            text="Manual note",
            mentioned_by="astrologer",
            source="astrologer",
            origin="manual",
        ))
        db.commit()
    finally:
        db.close()

    app.dependency_overrides[require_auth] = lambda: _auth_override(astrologer_id)
    with TestClient(app) as client:
        notes = client.get(f"/api/v1/persons/{person_id}/memory", params={"source": "astrologer"})
        ai = client.get(f"/api/v1/persons/{person_id}/memory", params={"source": "ai"})

    assert notes.status_code == 200
    assert [entry["text"] for entry in notes.json()["entries"]] == ["Manual note"]
    assert ai.status_code == 200
    assert [entry["origin"] for entry in ai.json()["entries"]] == ["consultation_ai"]
