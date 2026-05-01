import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_auth_registration_e2e_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.api.routes import auth as auth_route  # noqa: E402
from app.auth import dependencies as auth_dependencies  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import (  # noqa: E402
    Astrologer,
    AuditEvent,
    AuthSession,
    CallSession,
    Consultation,
    EmailVerificationToken,
    PasswordResetToken,
    User,
)


engine = create_engine("sqlite:///./_auth_registration_e2e_test.sqlite3", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _prepare_sqlite_user_table():
    User.__table__.c.tags.type = JSON()
    CallSession.__table__.c.transcript_segments.type = JSON()
    CallSession.__table__.c.key_points.type = JSON()


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
def _db_setup(monkeypatch):
    _prepare_sqlite_user_table()
    for table in (
        CallSession.__table__,
        Consultation.__table__,
        AuditEvent.__table__,
        AuthSession.__table__,
        EmailVerificationToken.__table__,
        PasswordResetToken.__table__,
        User.__table__,
        Astrologer.__table__,
    ):
        table.drop(bind=engine, checkfirst=True)

    Astrologer.__table__.create(bind=engine, checkfirst=True)
    User.__table__.create(bind=engine, checkfirst=True)
    Consultation.__table__.create(bind=engine, checkfirst=True)
    CallSession.__table__.create(bind=engine, checkfirst=True)
    AuthSession.__table__.create(bind=engine, checkfirst=True)
    AuditEvent.__table__.create(bind=engine, checkfirst=True)
    EmailVerificationToken.__table__.create(bind=engine, checkfirst=True)
    PasswordResetToken.__table__.create(bind=engine, checkfirst=True)

    monkeypatch.setattr(auth_dependencies, "RATE_LIMIT_MAX_PER_IP", 25)
    monkeypatch.setattr(auth_dependencies, "LOCKOUT_MAX_FAILURES", 5)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


def test_e2e_register_login_and_open_clients_page(monkeypatch):
    monkeypatch.setattr(auth_route, "send_email_verification_email", lambda **_: True)

    with TestClient(app) as client:
        register = client.post(
            "/api/v1/auth/register",
            json={"email": "e2e@example.com", "password": "StrongPass123"},
        )
        assert register.status_code == 200

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "e2e@example.com", "password": "StrongPass123"},
        )
        assert login.status_code == 200

        users = client.get("/api/v1/users")
        assert users.status_code == 200
        assert users.json() == []

        clients_page = client.get("/")
        assert clients_page.status_code == 200
        assert "text/html" in clients_page.headers.get("content-type", "")


def test_e2e_legacy_local_account_can_login_without_verify():
    astrologer = Astrologer(
        email="blocked-e2e@example.com",
        password_hash=auth_route.hash_password("StrongPass123"),
        auth_provider="local",
        is_active=True,
        email_verified_at=None,
    )
    db = TestingSessionLocal()
    db.add(astrologer)
    db.commit()
    db.close()

    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "blocked-e2e@example.com", "password": "StrongPass123"},
        )
        assert login.status_code == 200
