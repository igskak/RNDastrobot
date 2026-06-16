import os
from datetime import date, time
from types import SimpleNamespace

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_persons_api_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.auth.dependencies import AuthContext, require_auth  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import Astrologer, Person, User  # noqa: E402
from app.tests.api_test_db import create_sqlite_test_session_factory, make_get_db_override, reset_sqlite_schema  # noqa: E402


engine, TestingSessionLocal = create_sqlite_test_session_factory("./_persons_api_test.sqlite3")


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


def _create_chart(astrologer_id, person_id):
    db = TestingSessionLocal()
    try:
        user = User(
            astrologer_id=astrologer_id,
            person_id=person_id,
            title="Birth chart",
            chart_kind="birth",
            first_name="Andrii",
            last_name="Test",
            birth_date=date(1990, 6, 26),
            birth_time=time(14, 35),
            timezone="Europe/Kiev",
            birth_place="Kyiv",
            lat=50.4501,
            lon=30.5234,
            julian_day=2448068.1,
            house_system="P",
            tags=[],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.user_id
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


def test_create_list_and_patch_person():
    owner_id = _create_astrologer()
    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)

    with TestClient(app) as client:
        created = client.post(
            "/api/v1/persons",
            json={
                "first_name": "Андрей",
                "last_name": "Иванов",
                "email": "andrii@example.com",
                "tags": ["семья", " семья ", "vip"],
            },
        )
        assert created.status_code == 201
        person_id = created.json()["person_id"]
        assert created.json()["display_name"] == "Андрей Иванов"
        assert created.json()["tags"] == ["семья", "vip"]

        patched = client.patch(f"/api/v1/persons/{person_id}", json={"display_name": "Андрей И.", "phone": "+34"})
        assert patched.status_code == 200
        assert patched.json()["display_name"] == "Андрей И."

        listed = client.get("/api/v1/persons", params={"q": "Андрей", "tag": "vip"})
        assert listed.status_code == 200
        assert [row["person_id"] for row in listed.json()] == [person_id]


def test_persons_are_scoped_to_current_astrologer():
    owner_id = _create_astrologer("owner@example.com")
    other_id = _create_astrologer("other@example.com")
    _create_person(owner_id, first_name="Own")
    foreign_person_id = _create_person(other_id, first_name="Foreign")

    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)
    with TestClient(app) as client:
        listed = client.get("/api/v1/persons")
        assert listed.status_code == 200
        assert [row["display_name"] for row in listed.json()] == ["Own Test"]

        foreign = client.get(f"/api/v1/persons/{foreign_person_id}")
        assert foreign.status_code == 404


def test_delete_person_unlinks_charts_without_deleting_them():
    owner_id = _create_astrologer()
    person_id = _create_person(owner_id)
    chart_id = _create_chart(owner_id, person_id)

    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)
    with TestClient(app) as client:
        response = client.delete(f"/api/v1/persons/{person_id}")
        assert response.status_code == 200

    db = TestingSessionLocal()
    try:
        chart = db.query(User).filter(User.user_id == chart_id).first()
        assert chart is not None
        assert chart.person_id is None
    finally:
        db.close()
