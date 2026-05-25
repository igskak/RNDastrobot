import os
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_auth_registration_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.api.routes import auth as auth_route  # noqa: E402
from app.auth import dependencies as auth_dependencies  # noqa: E402
from app.auth.security import hash_email_verification_token, utcnow  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import (  # noqa: E402
    Astrologer,
    AuditEvent,
    AuthSession,
    EmailVerificationToken,
    PasswordResetToken,
    User,
)


engine = create_engine("sqlite:///./_auth_registration_test.sqlite3", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _prepare_sqlite_user_table():
    User.__table__.c.tags.type = JSON()


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


def _create_verification_token(astrologer_id, raw_token: str, *, expires_delta: timedelta, used: bool = False):
    db = TestingSessionLocal()
    token = EmailVerificationToken(
        astrologer_id=astrologer_id,
        token_hash=hash_email_verification_token(raw_token),
        expires_at=utcnow() + expires_delta,
        used_at=utcnow() if used else None,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    db.close()
    return token


def test_register_success_creates_verified_local_account_without_token(monkeypatch):
    sent = {"count": 0}

    def _fake_send(**_kwargs):
        sent["count"] += 1
        return True

    monkeypatch.setattr(auth_route, "send_email_verification_email", _fake_send)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "new@example.com",
                "password": "StrongPass123",
                "first_name": "Ihor",
                "last_name": "Skakovskyi",
                "locale": "uk",
            },
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "ready shortly" in response.json()["message"].lower()
    assert sent["count"] == 0

    db = TestingSessionLocal()
    try:
        astrologer = db.query(Astrologer).filter(Astrologer.email == "new@example.com").first()
        assert astrologer is not None
        assert astrologer.auth_provider == "local"
        assert astrologer.email_verified_at is not None
        assert astrologer.password_hash != "StrongPass123"
        assert astrologer.plan_code == "trial"

        token = db.query(EmailVerificationToken).filter(EmailVerificationToken.astrologer_id == astrologer.id).first()
        assert token is None

        audit_actions = {row.action for row in db.query(AuditEvent).all()}
        assert "auth.register" in audit_actions
        assert "auth.verification.sent" not in audit_actions
    finally:
        db.close()


def test_register_can_choose_solo_plan():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "solo-new@example.com",
                "password": "StrongPass123",
                "plan_code": "solo",
            },
        )

    assert response.status_code == 200

    db = TestingSessionLocal()
    try:
        astrologer = db.query(Astrologer).filter(Astrologer.email == "solo-new@example.com").first()
        assert astrologer is not None
        assert astrologer.plan_code == "solo"
    finally:
        db.close()


def test_register_rejects_paid_plan_selection():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "paid-new@example.com",
                "password": "StrongPass123",
                "plan_code": "pro",
            },
        )

    assert response.status_code == 422

    db = TestingSessionLocal()
    try:
        assert db.query(Astrologer).filter(Astrologer.email == "paid-new@example.com").first() is None
    finally:
        db.close()


def test_register_duplicate_email_returns_neutral_response(monkeypatch):
    astrologer = Astrologer(
        email="dup@example.com",
        password_hash="hash",
        auth_provider="local",
        is_active=True,
        email_verified_at=utcnow(),
    )
    db = TestingSessionLocal()
    db.add(astrologer)
    db.commit()
    db.close()

    monkeypatch.setattr(auth_route, "send_email_verification_email", lambda **_: True)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={"email": "dup@example.com", "password": "StrongPass123"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    db = TestingSessionLocal()
    try:
        assert db.query(Astrologer).filter(Astrologer.email == "dup@example.com").count() == 1
        duplicate_events = (
            db.query(AuditEvent)
            .filter(AuditEvent.action == "auth.register", AuditEvent.result == "failure")
            .count()
        )
        assert duplicate_events == 1
    finally:
        db.close()


def test_login_succeeds_immediately_after_registration():
    with TestClient(app) as client:
        register = client.post(
            "/api/v1/auth/register",
            json={"email": "blocked@example.com", "password": "StrongPass123"},
        )
        assert register.status_code == 200

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "blocked@example.com", "password": "StrongPass123"},
        )
        assert login.status_code == 200
        assert login.json()["email"] == "blocked@example.com"


def test_login_marks_legacy_local_account_verified_on_success():
    astrologer = Astrologer(
        email="legacy@example.com",
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
            json={"email": "legacy@example.com", "password": "StrongPass123"},
        )

    assert login.status_code == 200

    db = TestingSessionLocal()
    try:
        refreshed = db.query(Astrologer).filter(Astrologer.email == "legacy@example.com").first()
        assert refreshed is not None
        assert refreshed.email_verified_at is not None
    finally:
        db.close()


@pytest.mark.parametrize(
    ("raw_token", "expires_delta", "used", "expected_detail"),
    [
        ("valid-expired-verification-token-123456", timedelta(minutes=-1), False, "Verification link has expired"),
        ("valid-used-verification-token-123456", timedelta(hours=1), True, "Verification link has already been used"),
    ],
)
def test_verify_email_rejects_expired_and_used(raw_token, expires_delta, used, expected_detail):
    astrologer = Astrologer(
        email="verify@example.com",
        password_hash="hash",
        auth_provider="local",
        is_active=True,
    )
    db = TestingSessionLocal()
    db.add(astrologer)
    db.commit()
    db.refresh(astrologer)
    db.close()

    _create_verification_token(astrologer.id, raw_token, expires_delta=expires_delta, used=used)

    with TestClient(app) as client:
        response = client.post("/api/v1/auth/verify-email", json={"token": raw_token})

    assert response.status_code == 401
    assert response.json()["detail"] == expected_detail


def test_verify_email_rejects_invalid_token():
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/verify-email", json={"token": "non-existent-verification-token-123456"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Verification link is invalid"


def test_resend_verification_obeys_cooldown_and_rate_limit(monkeypatch):
    sent = {"count": 0}

    def _fake_send(**_kwargs):
        sent["count"] += 1
        return True

    monkeypatch.setattr(auth_route, "send_email_verification_email", _fake_send)

    astrologer = Astrologer(
        email="resend@example.com",
        password_hash="hash",
        auth_provider="local",
        is_active=True,
        email_verified_at=None,
    )
    db = TestingSessionLocal()
    db.add(astrologer)
    db.commit()
    db.refresh(astrologer)
    db.close()

    _create_verification_token(
        astrologer.id,
        "seed-resend-token-1234567890",
        expires_delta=timedelta(hours=1),
        used=False,
    )

    with TestClient(app) as client:
        first = client.post("/api/v1/auth/resend-verification", json={"email": "resend@example.com"})
        assert first.status_code == 200
        assert sent["count"] == 0

    monkeypatch.setattr(auth_dependencies, "RATE_LIMIT_MAX_PER_IP", 1)
    with TestClient(app) as client:
        blocked = client.post("/api/v1/auth/resend-verification", json={"email": "resend@example.com"})
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many authentication attempts"


def test_register_does_not_emit_verification_audit_event(monkeypatch):
    sent = {"count": 0}

    def _fake_send(**_kwargs):
        sent["count"] += 1
        return False

    monkeypatch.setattr(auth_route, "send_email_verification_email", _fake_send)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={"email": "mailfail@example.com", "password": "StrongPass123", "locale": "ru"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert sent["count"] == 0

    db = TestingSessionLocal()
    try:
        sent_event = (
            db.query(AuditEvent)
            .filter(
                AuditEvent.action == "auth.verification.sent",
                AuditEvent.resource_id == "mailfail@example.com",
            )
            .order_by(AuditEvent.created_at.desc())
            .first()
        )
        assert sent_event is None
    finally:
        db.close()
