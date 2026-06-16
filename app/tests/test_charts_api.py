import os
from datetime import date, time
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_charts_api_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.api.routes import charts as charts_route  # noqa: E402
from app.auth.dependencies import AuthContext, require_auth  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import Astrologer, Person, User  # noqa: E402
from app.tests.api_test_db import create_sqlite_test_session_factory, make_get_db_override, reset_sqlite_schema  # noqa: E402


engine, TestingSessionLocal = create_sqlite_test_session_factory("./_charts_api_test.sqlite3")


def _create_astrologer(email="owner@example.com"):
    db = TestingSessionLocal()
    try:
        astrologer = Astrologer(
            email=email,
            auth_provider="local",
            password_hash="hash",
            plan_code="pro",
        )
        db.add(astrologer)
        db.commit()
        db.refresh(astrologer)
        return astrologer.id
    finally:
        db.close()


def _create_chart(astrologer_id, *, title, chart_kind="birth", tags=None, place="Kyiv"):
    db = TestingSessionLocal()
    try:
        user = User(
            astrologer_id=astrologer_id,
            title=title,
            chart_kind=chart_kind,
            first_name=None,
            last_name=None,
            birth_date=date(1990, 6, 26),
            birth_time=time(14, 35),
            timezone="Europe/Kiev",
            birth_place=place,
            lat=50.4501,
            lon=30.5234,
            julian_day=2448068.1,
            house_system="P",
            tags=tags or [],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.user_id
    finally:
        db.close()


def _create_person(astrologer_id, *, first_name="Andrii", last_name="Test", tags=None):
    db = TestingSessionLocal()
    try:
        person = Person(
            astrologer_id=astrologer_id,
            first_name=first_name,
            last_name=last_name,
            tags=tags or [],
        )
        db.add(person)
        db.commit()
        db.refresh(person)
        return person.person_id
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


def test_list_charts_filters_to_current_astrologer_and_searches_metadata():
    owner_id = _create_astrologer("owner@example.com")
    other_id = _create_astrologer("other@example.com")
    own_chart_id = _create_chart(owner_id, title="Собеседование Андрея", chart_kind="event", tags=["работа"])
    _create_chart(other_id, title="Foreign chart", chart_kind="event", tags=["работа"])
    _create_chart(owner_id, title="Марина, рождение", chart_kind="birth", tags=["семья"])

    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)
    with TestClient(app) as client:
        response = client.get("/api/v1/charts", params={"q": "Андрея", "chart_kind": "event", "tag": "работа"})

    assert response.status_code == 200
    data = response.json()
    assert [row["chart_id"] for row in data] == [str(own_chart_id)]
    assert data[0]["display_title"] == "Собеседование Андрея"
    assert data[0]["user_id"] == data[0]["chart_id"]


def test_patch_chart_updates_only_chart_metadata():
    owner_id = _create_astrologer()
    chart_id = _create_chart(owner_id, title="Old title", tags=["old"])
    person_id = _create_person(owner_id)

    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)
    with TestClient(app) as client:
        response = client.patch(
            f"/api/v1/charts/{chart_id}",
            json={"title": "Запуск проекта", "chart_kind": "company", "person_id": str(person_id), "tags": ["work", "work", " launch "]},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Запуск проекта"
    assert data["chart_kind"] == "company"
    assert data["person_id"] == str(person_id)
    assert data["tags"] == ["work", "launch"]
    assert data["date"] == "1990-06-26"


def test_get_foreign_chart_is_forbidden():
    owner_id = _create_astrologer("owner@example.com")
    other_id = _create_astrologer("other@example.com")
    foreign_chart_id = _create_chart(other_id, title="Foreign")

    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)
    with TestClient(app) as client:
        response = client.get(f"/api/v1/charts/{foreign_chart_id}")

    assert response.status_code == 403


def test_create_chart_persists_chart_metadata_after_existing_natal_save(monkeypatch):
    owner_id = _create_astrologer()

    monkeypatch.setattr(charts_route, "assert_can_create_saved_chart", lambda *_args, **_kwargs: None)

    def fake_calculate_natal_chart(**kwargs):
        user = User(
            astrologer_id=kwargs["astrologer_id"],
            first_name=kwargs.get("first_name"),
            last_name=kwargs.get("last_name"),
            birth_date=kwargs["birth_date"],
            birth_time=kwargs["birth_time"],
            timezone=kwargs["timezone"],
            birth_place=kwargs.get("place") or "Madrid",
            lat=kwargs.get("latitude") or 40.4168,
            lon=kwargs.get("longitude") or -3.7038,
            julian_day=2460000.0,
            house_system=kwargs.get("house_system") or "P",
            tags=[],
        )
        kwargs["db_session"].add(user)
        kwargs["db_session"].flush()
        return {"user_id": str(user.user_id)}

    monkeypatch.setattr(charts_route.natal_service, "calculate_natal_chart", fake_calculate_natal_chart)

    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/charts",
            json={
                "title": "Собеседование",
                "chart_kind": "event",
                "date": "2026-06-12",
                "time": "10:00:00",
                "timezone": "Europe/Madrid",
                "location_name": "Madrid",
                "latitude": 40.4168,
                "longitude": -3.7038,
                "tags": ["работа", "событие"],
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Собеседование"
    assert data["display_title"] == "Собеседование"
    assert data["chart_kind"] == "event"
    assert data["tags"] == ["работа", "событие"]
    assert data["location_name"] == "Madrid"


def test_delete_chart_removes_it():
    owner_id = _create_astrologer()
    chart_id = _create_chart(owner_id, title="To delete")

    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)
    with TestClient(app) as client:
        response = client.delete(f"/api/v1/charts/{chart_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        # Verify it's gone — 404 because ensure_client_access finds no record
        gone = client.get(f"/api/v1/charts/{chart_id}")
        assert gone.status_code == 404


def test_delete_foreign_chart_is_forbidden():
    owner_id = _create_astrologer("owner@example.com")
    other_id = _create_astrologer("other@example.com")
    foreign_chart_id = _create_chart(other_id, title="Foreign")

    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)
    with TestClient(app) as client:
        response = client.delete(f"/api/v1/charts/{foreign_chart_id}")

    assert response.status_code == 403
