import os
from datetime import date, time as time_type, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_auth_password_reset_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.auth import dependencies as auth_dependencies  # noqa: E402
from app.auth.security import hash_password, hash_password_reset_token, utcnow  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import Astrologer, AuditEvent, AuthSession, EmailVerificationToken, PasswordResetToken, User  # noqa: E402


engine = create_engine("sqlite:///./_auth_password_reset_test.sqlite3", connect_args={"check_same_thread": False})
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
def _db_setup(monkeypatch):
    for table in (
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
    AuthSession.__table__.create(bind=engine, checkfirst=True)
    AuditEvent.__table__.create(bind=engine, checkfirst=True)
    EmailVerificationToken.__table__.create(bind=engine, checkfirst=True)
    PasswordResetToken.__table__.create(bind=engine, checkfirst=True)

    monkeypatch.setattr(auth_dependencies, "RATE_LIMIT_MAX_PER_IP", 25)
    monkeypatch.setattr(auth_dependencies, "LOCKOUT_MAX_FAILURES", 5)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


def _create_astrologer(email: str, password: str) -> Astrologer:
    db = TestingSessionLocal()
    astrologer = Astrologer(
        email=email,
        password_hash=hash_password(password),
        auth_provider="local",
        email_verified_at=utcnow(),
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
        last_name="Reset",
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


def _create_reset_token(astrologer_id, raw_token: str, *, expires_delta: timedelta = timedelta(minutes=30), used: bool = False):
    db = TestingSessionLocal()
    token = PasswordResetToken(
        astrologer_id=astrologer_id,
        token_hash=hash_password_reset_token(raw_token),
        expires_at=utcnow() + expires_delta,
        used_at=utcnow() if used else None,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    db.close()
    return token


def test_forgot_password_is_neutral_and_creates_token_for_existing_user():
    _create_astrologer("astro@example.com", "password123")

    with TestClient(app) as client:
        existing = client.post("/api/v1/auth/forgot-password", json={"email": "astro@example.com"})
        missing = client.post("/api/v1/auth/forgot-password", json={"email": "missing@example.com"})

    assert existing.status_code == 200
    assert missing.status_code == 200
    assert existing.json()["message"] == missing.json()["message"]
    assert existing.json()["status"] == "ok"

    db = TestingSessionLocal()
    try:
        assert db.query(PasswordResetToken).count() == 1
        audit_results = db.query(AuditEvent).filter(AuditEvent.action == "auth.forgot-password").all()
        assert len(audit_results) == 2
    finally:
        db.close()


@pytest.mark.parametrize(
    ("raw_token", "expires_delta", "used", "expected_detail"),
    [
        ("valid-expired-token-1234567890", timedelta(minutes=-1), False, "Reset link has expired"),
        ("valid-used-token-1234567890", timedelta(minutes=30), True, "Reset link has already been used"),
    ],
)
def test_reset_password_rejects_expired_and_used_tokens(raw_token, expires_delta, used, expected_detail):
    astrologer = _create_astrologer("astro@example.com", "password123")
    _create_reset_token(astrologer.id, raw_token, expires_delta=expires_delta, used=used)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/reset-password",
            json={"token": raw_token, "password": "new-password-123"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == expected_detail


def test_reset_password_rejects_invalid_token():
    _create_astrologer("astro@example.com", "password123")

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "non-existent-reset-token-123456", "password": "new-password-123"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Reset link is invalid"


def test_password_reset_revokes_existing_sessions_and_allows_login_with_new_password():
    astrologer = _create_astrologer("astro@example.com", "password123")
    _create_user(astrologer.id)
    _create_reset_token(astrologer.id, "reset-token-valid-1234567890")

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"email": "astro@example.com", "password": "password123"})
        assert login.status_code == 200

        reset = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "reset-token-valid-1234567890", "password": "new-password-123"},
        )
        assert reset.status_code == 200

        me_after_reset = client.get("/api/v1/auth/me")
        assert me_after_reset.status_code == 401

        old_login = client.post("/api/v1/auth/login", json={"email": "astro@example.com", "password": "password123"})
        assert old_login.status_code == 401

        new_login = client.post("/api/v1/auth/login", json={"email": "astro@example.com", "password": "new-password-123"})
        assert new_login.status_code == 200

        users = client.get("/api/v1/users")
        assert users.status_code == 200
        assert len(users.json()) == 1

    db = TestingSessionLocal()
    try:
        sessions = db.query(AuthSession).filter(AuthSession.astrologer_id == astrologer.id).all()
        assert len(sessions) >= 1
        assert any(session.revoked_at is not None for session in sessions)
    finally:
        db.close()


def test_login_rate_limit_triggers_after_repeated_failures(monkeypatch):
    _create_astrologer("astro@example.com", "password123")
    monkeypatch.setattr(auth_dependencies, "LOCKOUT_MAX_FAILURES", 2)

    with TestClient(app) as client:
        for _ in range(2):
            response = client.post("/api/v1/auth/login", json={"email": "astro@example.com", "password": "wrong-password"})
            assert response.status_code == 401

        locked = client.post("/api/v1/auth/login", json={"email": "astro@example.com", "password": "wrong-password"})

    assert locked.status_code == 429
    assert locked.json()["detail"] == "Account temporarily locked"


def test_reset_rate_limit_triggers_after_repeated_failures(monkeypatch):
    _create_astrologer("astro@example.com", "password123")
    monkeypatch.setattr(auth_dependencies, "LOCKOUT_MAX_FAILURES", 2)

    with TestClient(app) as client:
        for _ in range(2):
            response = client.post(
                "/api/v1/auth/reset-password",
                json={"token": "invalid-reset-token-1234567890", "password": "new-password-123"},
            )
            assert response.status_code == 401

        locked = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "invalid-reset-token-1234567890", "password": "new-password-123"},
        )

    assert locked.status_code == 429
    assert locked.json()["detail"] == "Account temporarily locked"
