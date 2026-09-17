"""Campaign promo codes at signup (conference QR code → 90-day trial).

The code travels in the `steliara_promo` cookie (written client-side from
?promo=... in the landing URL) and stretches the trial window that
plan_expires_at encodes. Everything else — the read-only paywall once that date
passes — is the existing trial machinery.
"""
import os
from dataclasses import replace
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_signup_promo_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.auth import dependencies as auth_dependencies  # noqa: E402
from app.auth.security import utcnow  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import (  # noqa: E402
    Astrologer,
    AuditEvent,
    AuthSession,
    BillingCustomer,
    BillingEvent,
    BillingPriceMap,
    BillingSubscription,
    CallSession,
    CompositeChart,
    Consultation,
    EmailVerificationToken,
    PasswordResetToken,
    User,
)
from app.services import signup_promos  # noqa: E402
from app.services.entitlements_service import TRIAL_PERIOD_DAYS  # noqa: E402


PROMO_CODE = "dav2026"

engine = create_engine("sqlite:///./_signup_promo_test.sqlite3", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _prepare_sqlite_types():
    Astrologer.__table__.c.signup_attribution.type = JSON()
    User.__table__.c.tags.type = JSON()
    CompositeChart.__table__.c.partner_birth_data.type = JSON()
    CompositeChart.__table__.c.chart_data.type = JSON()
    CompositeChart.__table__.c.tags.type = JSON()
    CallSession.__table__.c.transcript_segments.type = JSON()
    CallSession.__table__.c.key_points.type = JSON()
    CallSession.__table__.c.summary_json.type = JSON()
    BillingCustomer.__table__.c.raw_provider_payload.type = JSON()
    BillingSubscription.__table__.c.raw_provider_payload.type = JSON()
    BillingEvent.__table__.c.raw_payload.type = JSON()


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


TABLES = (
    CallSession.__table__,
    CompositeChart.__table__,
    Consultation.__table__,
    AuditEvent.__table__,
    AuthSession.__table__,
    BillingEvent.__table__,
    BillingSubscription.__table__,
    BillingPriceMap.__table__,
    BillingCustomer.__table__,
    EmailVerificationToken.__table__,
    PasswordResetToken.__table__,
    User.__table__,
    Astrologer.__table__,
)


@pytest.fixture(autouse=True)
def _db_setup(monkeypatch):
    _prepare_sqlite_types()
    for table in TABLES:
        table.drop(bind=engine, checkfirst=True)
    for table in reversed(TABLES):
        table.create(bind=engine, checkfirst=True)

    monkeypatch.setattr(auth_dependencies, "RATE_LIMIT_MAX_PER_IP", 50)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


def _register(email: str, *, promo: str = None, host: str = None):
    with TestClient(app) as client:
        if promo is not None:
            client.cookies.set(signup_promos.PROMO_COOKIE, promo)
        return client.post(
            "/api/v1/auth/register",
            headers={"host": host} if host else None,
            json={"email": email, "password": "StrongPass123"},
        )


def _trial_days(email: str) -> float:
    db = TestingSessionLocal()
    try:
        astrologer = db.query(Astrologer).filter(Astrologer.email == email).first()
        assert astrologer is not None
        assert astrologer.plan_expires_at is not None
        expires_at = astrologer.plan_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=utcnow().tzinfo)
        return (expires_at - utcnow()).total_seconds() / 86400
    finally:
        db.close()


def _promo_code(email: str):
    db = TestingSessionLocal()
    try:
        astrologer = db.query(Astrologer).filter(Astrologer.email == email).first()
        return astrologer.signup_promo_code if astrologer else None
    finally:
        db.close()


def test_promo_cookie_extends_the_trial_to_ninety_days():
    assert _register("conf@example.com", promo=PROMO_CODE).status_code == 200
    assert 89 < _trial_days("conf@example.com") <= 90
    assert _promo_code("conf@example.com") == PROMO_CODE


def test_signup_without_promo_keeps_the_standard_trial():
    assert _register("plain@example.com").status_code == 200
    assert TRIAL_PERIOD_DAYS - 1 < _trial_days("plain@example.com") <= TRIAL_PERIOD_DAYS
    assert _promo_code("plain@example.com") is None


@pytest.mark.parametrize("promo", ["not-a-real-code", "'; DROP TABLE astrologers; --", "x" * 200])
def test_unknown_or_malformed_promo_falls_back_to_the_standard_trial(promo):
    assert _register("junk@example.com", promo=promo).status_code == 200
    assert TRIAL_PERIOD_DAYS - 1 < _trial_days("junk@example.com") <= TRIAL_PERIOD_DAYS
    assert _promo_code("junk@example.com") is None


def test_promo_stops_granting_after_its_expiry_date(monkeypatch):
    promo = signup_promos.SIGNUP_PROMOS[PROMO_CODE]
    monkeypatch.setitem(
        signup_promos.SIGNUP_PROMOS,
        PROMO_CODE,
        replace(promo, valid_until=utcnow() - timedelta(days=1)),
    )
    assert _register("late@example.com", promo=PROMO_CODE).status_code == 200
    assert TRIAL_PERIOD_DAYS - 1 < _trial_days("late@example.com") <= TRIAL_PERIOD_DAYS
    assert _promo_code("late@example.com") is None


def test_promo_stops_granting_once_the_redemption_cap_is_reached(monkeypatch):
    promo = signup_promos.SIGNUP_PROMOS[PROMO_CODE]
    monkeypatch.setitem(
        signup_promos.SIGNUP_PROMOS,
        PROMO_CODE,
        replace(promo, max_redemptions=1),
    )
    assert _register("first@example.com", promo=PROMO_CODE).status_code == 200
    assert _register("second@example.com", promo=PROMO_CODE).status_code == 200

    assert 89 < _trial_days("first@example.com") <= 90
    assert TRIAL_PERIOD_DAYS - 1 < _trial_days("second@example.com") <= TRIAL_PERIOD_DAYS
    assert _promo_code("second@example.com") is None


def test_solo_registration_ignores_the_promo(monkeypatch):
    monkeypatch.setenv("SOLO_REGISTRATION_HOSTS", "solo.example.com")
    assert _register("solo@example.com", promo=PROMO_CODE, host="solo.example.com").status_code == 200

    db = TestingSessionLocal()
    try:
        astrologer = db.query(Astrologer).filter(Astrologer.email == "solo@example.com").first()
        assert astrologer.plan_code == "solo"
        # Solo has no trial window to stretch, so nothing is redeemed.
        assert astrologer.plan_expires_at is None
        assert astrologer.signup_promo_code is None
    finally:
        db.close()


def test_registration_audit_event_records_the_promo():
    assert _register("tracked@example.com", promo=PROMO_CODE).status_code == 200

    db = TestingSessionLocal()
    try:
        event = (
            db.query(AuditEvent)
            .filter(AuditEvent.action == "auth.register", AuditEvent.result == "success")
            .first()
        )
        assert event is not None
        assert (event.properties or {}).get("promo") == PROMO_CODE
    finally:
        db.close()


def test_signup_promo_endpoint_reports_a_live_promo():
    with TestClient(app) as client:
        payload = client.get(f"/api/v1/auth/signup-promo?code={PROMO_CODE}").json()

    assert payload["valid"] is True
    assert payload["trial_days"] == 90
    assert payload["message_key"] == "page.login.promo.dav2026"


def test_signup_promo_endpoint_rejects_unknown_codes():
    with TestClient(app) as client:
        payload = client.get("/api/v1/auth/signup-promo?code=made-up").json()

    assert payload["valid"] is False
    assert payload["trial_days"] is None


def test_signup_promo_endpoint_falls_back_to_the_cookie():
    with TestClient(app) as client:
        client.cookies.set(signup_promos.PROMO_COOKIE, PROMO_CODE)
        payload = client.get("/api/v1/auth/signup-promo").json()

    assert payload["valid"] is True
    assert payload["code"] == PROMO_CODE
