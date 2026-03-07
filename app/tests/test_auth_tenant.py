import os
from datetime import date, time as time_type
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_auth_tenant_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_JWT_AUDIENCE", "authenticated")

from app.api.main import app  # noqa: E402
from app.api.routes import auth as auth_route  # noqa: E402
from app.api.routes import natal as natal_route  # noqa: E402
from app.auth.security import hash_password  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import Astrologer, AuditEvent, AuthSession, User  # noqa: E402


engine = create_engine("sqlite:///./_auth_tenant_test.sqlite3", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _db_setup():
    for table in (AuditEvent.__table__, AuthSession.__table__, User.__table__, Astrologer.__table__):
        table.drop(bind=engine, checkfirst=True)
    Astrologer.__table__.create(bind=engine, checkfirst=True)
    User.__table__.create(bind=engine, checkfirst=True)
    AuthSession.__table__.create(bind=engine, checkfirst=True)
    AuditEvent.__table__.create(bind=engine, checkfirst=True)

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


def _create_astrologer(email: str, password: str) -> Astrologer:
    db = TestingSessionLocal()
    astrologer = Astrologer(
        email=email,
        password_hash=hash_password(password),
        auth_provider="local",
        is_active=True,
    )
    db.add(astrologer)
    db.commit()
    db.refresh(astrologer)
    db.close()
    return astrologer


def _create_user(astrologer_id):
    db = TestingSessionLocal()
    user = User(
        user_id=uuid4(),
        astrologer_id=astrologer_id,
        first_name="Client",
        last_name="One",
        birth_date=date(1990, 1, 1),
        birth_time=time_type(12, 0, 0),
        timezone="UTC",
        birth_place="Kyiv",
        lat=50.45,
        lon=30.523,
        julian_day=2447892.5,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def test_password_login_me_logout_flow():
    _create_astrologer("astro@example.com", "password123")

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"email": "astro@example.com", "password": "password123"})
        assert login.status_code == 200
        assert login.json()["email"] == "astro@example.com"

        me = client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == "astro@example.com"

        logout = client.post("/api/v1/auth/logout")
        assert logout.status_code == 200

        me_after = client.get("/api/v1/auth/me")
        assert me_after.status_code == 401


def test_tenant_isolation_list_open_forbidden(monkeypatch):
    owner = _create_astrologer("owner@example.com", "password123")
    other = _create_astrologer("other@example.com", "password123")
    own_user = _create_user(owner.id)
    foreign_user = _create_user(other.id)

    def _fake_chart(user_id, _db):
        return {
            "user_id": str(user_id),
            "birth_data": {
                "date": "1990-01-01",
                "time": "12:00:00",
                "timezone": "UTC",
                "utc_time": "1990-01-01T12:00:00+00:00",
                "julian_day": 2447892.5,
                "latitude": 50.45,
                "longitude": 30.523,
                "place": "Kyiv",
            },
            "planets": [],
            "houses": [],
            "angles": {},
            "special_points": {},
            "configurations": {},
            "aspects": [],
            "aspect_configurations": [],
            "stelliums": [],
            "cosmogram_pattern": None,
            "planet_distribution": None,
            "balances": None,
                "karmic_analysis": {
                    "nodes": {"north_node": {}, "south_node": {}},
                    "saturn_analysis": {},
                    "lunar_points_analysis": {"black_moon": {}, "white_moon": {}},
                    "karmic_status": {},
                    "karmic_support": {"harmonic_trines": []},
                "karmic_development": {},
                "jones_pattern": {},
            },
        }

    monkeypatch.setattr(natal_route.natal_service, "get_natal_chart_from_db", _fake_chart)

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "password123"})
        assert login.status_code == 200

        users = client.get("/api/v1/users")
        assert users.status_code == 200
        returned_ids = {item["user_id"] for item in users.json()}
        assert str(own_user.user_id) in returned_ids
        assert str(foreign_user.user_id) not in returned_ids

        own_chart = client.get(f"/api/v1/natal/{own_user.user_id}")
        assert own_chart.status_code == 200

        foreign_chart = client.get(f"/api/v1/natal/{foreign_user.user_id}")
        assert foreign_chart.status_code == 403


def test_google_login_valid_token(monkeypatch):
    monkeypatch.setattr(
        auth_route,
        "verify_supabase_token",
        lambda _token: SimpleNamespace(
            sub="google-sub-1",
            email="oauth@example.com",
            provider="google",
            claims={"iss": "https://example.supabase.co/auth/v1"},
        ),
    )

    with TestClient(app) as client:
        response = client.post("/api/v1/auth/google", json={"id_token": "valid-token"})
        assert response.status_code == 200
        assert response.json()["email"] == "oauth@example.com"

        me = client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == "oauth@example.com"


@pytest.mark.parametrize(
    "error_text",
    [
        "Invalid Supabase token: invalid iss",
        "Invalid Supabase token: invalid aud",
        "Invalid Supabase token: token expired",
    ],
)
def test_google_login_invalid_claims(monkeypatch, error_text):
    monkeypatch.setattr(auth_route, "verify_supabase_token", lambda _token: (_ for _ in ()).throw(ValueError(error_text)))
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/google", json={"id_token": "bad-token"})
        assert response.status_code == 401
        assert error_text in response.json()["detail"]


def test_google_login_missing_required_claims(monkeypatch):
    monkeypatch.setattr(
        auth_route,
        "verify_supabase_token",
        lambda _token: (_ for _ in ()).throw(ValueError("Supabase token must contain sub and email claims")),
    )
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/google", json={"id_token": "missing-claims"})
        assert response.status_code == 401
        assert "sub and email" in response.json()["detail"]
