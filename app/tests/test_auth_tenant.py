import os
import hashlib
import hmac
import json
from datetime import date, timedelta, time as time_type, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_auth_tenant_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_JWT_AUDIENCE", "authenticated")

from app.api.main import app  # noqa: E402
from app.api.routes import assistant as assistant_route  # noqa: E402
from app.api.routes import auth as auth_route  # noqa: E402
from app.api.routes import natal as natal_route  # noqa: E402
from app.api.routes import synastry as synastry_route  # noqa: E402
from app.auth.security import hash_password, utcnow  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import Astrologer, AuditEvent, AuthSession, BillingCustomer, BillingEvent, BillingPriceMap, BillingSubscription, CallSession, ClientRelationship, CompositeChart, Consultation, EmailVerificationToken, PasswordResetToken, User  # noqa: E402
from app.services import billing_service  # noqa: E402


engine = create_engine("sqlite:///./_auth_tenant_test.sqlite3", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _prepare_sqlite_json_columns():
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


@pytest.fixture(autouse=True)
def _db_setup():
    _prepare_sqlite_json_columns()
    for table in (
        CallSession.__table__,
        CompositeChart.__table__,
        BillingEvent.__table__,
        BillingSubscription.__table__,
        BillingPriceMap.__table__,
        BillingCustomer.__table__,
        ClientRelationship.__table__,
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
    BillingCustomer.__table__.create(bind=engine, checkfirst=True)
    BillingPriceMap.__table__.create(bind=engine, checkfirst=True)
    BillingSubscription.__table__.create(bind=engine, checkfirst=True)
    BillingEvent.__table__.create(bind=engine, checkfirst=True)
    Consultation.__table__.create(bind=engine, checkfirst=True)
    ClientRelationship.__table__.create(bind=engine, checkfirst=True)
    CompositeChart.__table__.create(bind=engine, checkfirst=True)
    CallSession.__table__.create(bind=engine, checkfirst=True)
    AuthSession.__table__.create(bind=engine, checkfirst=True)
    AuditEvent.__table__.create(bind=engine, checkfirst=True)
    EmailVerificationToken.__table__.create(bind=engine, checkfirst=True)
    PasswordResetToken.__table__.create(bind=engine, checkfirst=True)

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


def _create_astrologer(email: str, password: str, *, plan_code: str = "pro", plan_expires_at=None) -> Astrologer:
    db = TestingSessionLocal()
    astrologer = Astrologer(
        email=email,
        password_hash=hash_password(password),
        auth_provider="local",
        email_verified_at=utcnow(),
        is_active=True,
        plan_code=plan_code,
        plan_expires_at=plan_expires_at,
    )
    db.add(astrologer)
    db.commit()
    db.refresh(astrologer)
    db.close()
    return astrologer


def _login(client: TestClient, email: str, password: str = "password123"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response


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


def _create_price_map(plan_code="pro", interval="monthly", price_id="pri_test"):
    db = TestingSessionLocal()
    row = BillingPriceMap(
        provider="paddle",
        plan_code=plan_code,
        interval=interval,
        provider_price_id=price_id,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    db.close()
    return row


def _paddle_signature(body: bytes, secret: str, timestamp: str = "1710000000") -> str:
    digest = hmac.new(secret.encode("utf-8"), f"{timestamp}:".encode("utf-8") + body, hashlib.sha256).hexdigest()
    return f"ts={timestamp};h1={digest}"


def _fake_chart_payload(user_id):
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


def test_authenticated_request_refreshes_aging_session_cookie():
    _create_astrologer("rolling@example.com", "password123")

    with TestClient(app) as client:
        _login(client, "rolling@example.com")
        sid = client.cookies.get("astrobot_session")
        assert sid

        db = TestingSessionLocal()
        try:
            session = db.query(AuthSession).filter(AuthSession.session_id == sid).one()
            session.expires_at = utcnow() + timedelta(hours=2)
            db.commit()
        finally:
            db.close()

        me = client.get("/api/v1/auth/me")

    assert me.status_code == 200
    set_cookie = me.headers.get("set-cookie", "")
    assert "astrobot_session=" in set_cookie
    assert "Max-Age=604800" in set_cookie

    db = TestingSessionLocal()
    try:
        refreshed = db.query(AuthSession).filter(AuthSession.session_id == sid).one()
        refreshed_expires_at = refreshed.expires_at
        if refreshed_expires_at.tzinfo is None:
            refreshed_expires_at = refreshed_expires_at.replace(tzinfo=timezone.utc)
        assert refreshed_expires_at - utcnow() > timedelta(days=6)
    finally:
        db.close()


def test_me_includes_plan_entitlements_and_usage():
    astrologer = _create_astrologer("standard@example.com", "password123", plan_code="standard")
    _create_user(astrologer.id)

    with TestClient(app) as client:
        _login(client, "standard@example.com")
        me = client.get("/api/v1/auth/me")

    assert me.status_code == 200
    payload = me.json()
    assert payload["plan_code"] == "standard"
    assert payload["entitlements"]["calls_enabled"] is False
    assert payload["entitlements"]["clients_enabled"] is True
    assert payload["entitlements"]["assistant_enabled"] is True
    assert payload["usage"]["saved_charts_count"] == 1
    assert payload["usage"]["max_saved_charts"] is None


def test_authenticated_user_can_update_plan_without_payment():
    _create_astrologer("upgrade@example.com", "password123", plan_code="trial")

    with TestClient(app) as client:
        _login(client, "upgrade@example.com")
        response = client.patch("/api/v1/auth/me/plan", json={"plan_code": "pro"})
        me = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["plan_code"] == "pro"
    assert response.json()["entitlements"]["calls_enabled"] is True
    assert me.status_code == 200
    assert me.json()["plan_code"] == "pro"


def test_authenticated_plan_update_rejects_unknown_plan():
    _create_astrologer("bad-upgrade@example.com", "password123", plan_code="trial")

    with TestClient(app) as client:
        _login(client, "bad-upgrade@example.com")
        response = client.patch("/api/v1/auth/me/plan", json={"plan_code": "enterprise"})

    assert response.status_code == 422


def test_authenticated_plan_update_is_disabled_in_production(monkeypatch):
    _create_astrologer("prod-upgrade@example.com", "password123", plan_code="trial")
    monkeypatch.setenv("APP_ENV", "production")

    with TestClient(app) as client:
        _login(client, "prod-upgrade@example.com")
        response = client.patch("/api/v1/auth/me/plan", json={"plan_code": "pro"})

    assert response.status_code == 404


def test_billing_checkout_creates_paddle_checkout_with_coupon(monkeypatch):
    monkeypatch.setenv("BILLING_PROVIDER", "paddle")
    _create_astrologer("checkout@example.com", "password123", plan_code="trial")
    _create_price_map(plan_code="pro", interval="monthly", price_id="pri_pro_month")
    captured = {}

    def _fake_api_request(self, method, path, payload=None):
        captured.update({"method": method, "path": path, "payload": payload})
        return {"data": {"checkout": {"url": "https://checkout.paddle.test/session"}}}

    monkeypatch.setenv("PADDLE_API_KEY", "test-key")
    monkeypatch.setattr(billing_service.PaddleBillingProvider, "_api_request", _fake_api_request)

    with TestClient(app) as client:
        _login(client, "checkout@example.com")
        response = client.post(
            "/api/v1/billing/checkout",
            json={"plan_code": "pro", "interval": "monthly", "coupon_code": "WELCOME"},
        )

    assert response.status_code == 200
    assert response.json()["checkout_url"] == "https://checkout.paddle.test/session"
    assert captured["method"] == "POST"
    assert captured["path"] == "/transactions"
    assert captured["payload"]["items"] == [{"price_id": "pri_pro_month", "quantity": 1}]
    assert captured["payload"]["discount_id"] == "WELCOME"
    assert captured["payload"]["custom_data"]["coupon_code"] == "WELCOME"
    assert captured["payload"]["custom_data"]["plan_code"] == "pro"


def test_paddle_webhook_activates_paid_effective_plan_and_replay_is_idempotent(monkeypatch):
    monkeypatch.setenv("BILLING_PROVIDER", "paddle")
    astrologer = _create_astrologer("webhook@example.com", "password123", plan_code="trial")
    _create_price_map(plan_code="pro", interval="monthly", price_id="pri_pro_month")
    secret = "whsec_test"
    monkeypatch.setenv("PADDLE_WEBHOOK_SECRET", secret)
    period_end = (utcnow() + timedelta(days=30)).isoformat()
    payload = {
        "event_id": "evt_123",
        "event_type": "subscription.activated",
        "data": {
            "id": "sub_123",
            "customer_id": "ctm_123",
            "status": "active",
            "custom_data": {
                "astrologer_id": str(astrologer.id),
                "plan_code": "pro",
                "interval": "monthly",
            },
            "items": [
                {
                    "price": {
                        "id": "pri_pro_month",
                        "billing_cycle": {"interval": "month"},
                    }
                }
            ],
            "current_billing_period": {
                "starts_at": utcnow().isoformat(),
                "ends_at": period_end,
            },
        },
    }
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Paddle-Signature": _paddle_signature(body, secret),
    }

    with TestClient(app) as client:
        first = client.post("/api/v1/webhooks/billing/paddle", content=body, headers=headers)
        replay = client.post("/api/v1/webhooks/billing/paddle", content=body, headers=headers)
        _login(client, "webhook@example.com")
        me = client.get("/api/v1/auth/me")

    assert first.status_code == 200
    assert first.json()["status"] == "processed"
    assert replay.status_code == 200
    assert replay.json()["status"] == "duplicate"
    assert me.status_code == 200
    assert me.json()["base_plan_code"] == "trial"
    assert me.json()["plan_code"] == "pro"
    assert me.json()["entitlements"]["calls_enabled"] is True
    assert me.json()["billing"]["subscription"]["status"] == "active"


def test_paddle_webhook_rejects_invalid_signature(monkeypatch):
    monkeypatch.setenv("BILLING_PROVIDER", "paddle")
    monkeypatch.setenv("PADDLE_WEBHOOK_SECRET", "whsec_test")

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/webhooks/billing/paddle",
            content=b'{"event_id":"evt_bad","event_type":"subscription.activated"}',
            headers={"Paddle-Signature": "ts=1710000000;h1=bad"},
        )

    assert response.status_code == 401


def test_expired_trial_blocks_new_persisted_chart(monkeypatch):
    # Trial is now full-Pro with no chart limit; the paywall kicks in only once
    # plan_expires_at has passed, dropping the account to read-only.
    astrologer = _create_astrologer(
        "expired@example.com",
        "password123",
        plan_code="trial",
        plan_expires_at=utcnow() - timedelta(days=1),
    )
    for _ in range(5):
        _create_user(astrologer.id)

    called = {"value": False}

    def _fake_calculate(*_args, **_kwargs):
        called["value"] = True
        return {}

    monkeypatch.setattr(natal_route.natal_service, "calculate_natal_chart", _fake_calculate)

    payload = {
        "first_name": "Trial",
        "last_name": "Ended",
        "date": "1990-01-01",
        "time": "12:00:00",
        "timezone": "UTC",
        "place": "Kyiv",
        "latitude": 50.45,
        "longitude": 30.523,
        "house_system": "P",
    }

    with TestClient(app) as client:
        _login(client, "expired@example.com")
        response = client.post("/api/v1/natal/calculate", json=payload)

    assert response.status_code == 403
    assert response.json()["error_code"] == "TRIAL_ENDED"
    assert called["value"] is False


def test_trial_allows_persisted_chart_beyond_old_limit(monkeypatch):
    # Regression guard: the former 5-chart trial cap is gone — a trial account
    # with many saved charts can still create another.
    astrologer = _create_astrologer(
        "trial-unlimited@example.com",
        "password123",
        plan_code="trial",
        plan_expires_at=utcnow() + timedelta(days=7),
    )
    for _ in range(6):
        _create_user(astrologer.id)

    called = {"value": False}

    def _fake_calculate(*_args, **_kwargs):
        called["value"] = True
        raise RuntimeError("stop after the entitlement gate passes")

    monkeypatch.setattr(natal_route.natal_service, "calculate_natal_chart", _fake_calculate)

    payload = {
        "first_name": "Trial",
        "last_name": "Unlimited",
        "date": "1990-01-01",
        "time": "12:00:00",
        "timezone": "UTC",
        "place": "Kyiv",
        "latitude": 50.45,
        "longitude": 30.523,
        "house_system": "P",
    }

    with TestClient(app) as client:
        _login(client, "trial-unlimited@example.com")
        response = client.post("/api/v1/natal/calculate", json=payload)

    # The entitlement gate let us through (no 403); calculation itself was reached.
    assert response.status_code != 403
    assert called["value"] is True


def test_standard_plan_blocks_call_session_creation():
    astrologer = _create_astrologer("standard-calls@example.com", "password123", plan_code="standard")
    user = _create_user(astrologer.id)

    with TestClient(app) as client:
        _login(client, "standard-calls@example.com")
        response = client.post("/api/v1/call-sessions", json={"user_id": str(user.user_id)})

    assert response.status_code == 403
    assert response.json()["error_code"] == "PLAN_FEATURE_LOCKED"


def test_pro_plan_allows_call_session_creation():
    astrologer = _create_astrologer("pro-calls@example.com", "password123", plan_code="pro")
    user = _create_user(astrologer.id)

    with TestClient(app) as client:
        _login(client, "pro-calls@example.com")
        response = client.post("/api/v1/call-sessions", json={"user_id": str(user.user_id)})

    assert response.status_code == 201
    payload = response.json()
    assert payload["user_id"] == str(user.user_id)
    assert payload["join_url"]


def test_solo_plan_blocks_consultations():
    astrologer = _create_astrologer("solo@example.com", "password123", plan_code="solo")
    user = _create_user(astrologer.id)

    with TestClient(app) as client:
        _login(client, "solo@example.com")
        response = client.get(f"/api/v1/consultations?user_id={user.user_id}")

    assert response.status_code == 403
    assert response.json()["error_code"] == "PLAN_FEATURE_LOCKED"


def test_solo_plan_blocks_assistant_chat(monkeypatch):
    astrologer = _create_astrologer("solo-assistant@example.com", "password123", plan_code="solo")
    user = _create_user(astrologer.id)
    monkeypatch.setattr(assistant_route, "is_openai_configured", lambda: True)

    with TestClient(app) as client:
        _login(client, "solo-assistant@example.com")
        response = client.post(
            "/api/v1/assistant/chat",
            json={
                "user_id": str(user.user_id),
                "timezone": "UTC",
                "messages": [{"role": "user", "content": "Find next Venus contact"}],
            },
        )

    assert response.status_code == 403
    assert response.json()["error_code"] == "PLAN_FEATURE_LOCKED"


def test_solo_plan_allows_persisted_chart_creation(monkeypatch):
    _create_astrologer("solo-chart-create@example.com", "password123", plan_code="solo")
    called = {"value": False}

    def _fake_calculate(*_args, **_kwargs):
        called["value"] = True
        raise RuntimeError("stop after the entitlement gate passes")

    monkeypatch.setattr(natal_route.natal_service, "calculate_natal_chart", _fake_calculate)

    payload = {
        "first_name": "Solo",
        "last_name": "Learner",
        "date": "1990-01-01",
        "time": "12:00:00",
        "timezone": "UTC",
        "place": "Kyiv",
        "latitude": 50.45,
        "longitude": 30.523,
        "house_system": "P",
    }

    with TestClient(app) as client:
        _login(client, "solo-chart-create@example.com")
        response = client.post("/api/v1/natal/calculate", json=payload)

    assert response.status_code != 403
    assert called["value"] is True


def test_solo_plan_allows_saved_charts_related_people_and_synastry(monkeypatch):
    astrologer = _create_astrologer("solo-synastry@example.com", "password123", plan_code="solo")
    user = _create_user(astrologer.id)
    partner = _create_user(astrologer.id)

    class FakeSynastryService:
        def __init__(self, *_args, **_kwargs):
            pass

        def build_synastry_payload(self, *, astrologer, user_id, partner_id):
            return {
                "primary_chart": _fake_chart_payload(user_id),
                "partner_chart": _fake_chart_payload(partner_id),
                "inter_aspects": [],
                "house_overlays": {
                    "primary_in_partner_houses": [],
                    "partner_in_primary_houses": [],
                },
                "resolved_preferences": {},
            }

    monkeypatch.setattr(synastry_route, "SynastryService", FakeSynastryService)

    with TestClient(app) as client:
        _login(client, "solo-synastry@example.com")
        me = client.get("/api/v1/auth/me")
        related = client.get(f"/api/v1/users/{user.user_id}/related-people")
        link = client.post(
            f"/api/v1/users/{user.user_id}/related-people",
            json={"related_user_id": str(partner.user_id), "relation_label": "Partner"},
        )
        synastry = client.get(f"/api/v1/synastry?user_id={user.user_id}&partner_id={partner.user_id}")

    assert me.status_code == 200
    assert me.json()["entitlements"]["clients_enabled"] is True
    assert me.json()["entitlements"]["assistant_enabled"] is False
    assert me.json()["usage"]["max_saved_charts"] is None
    assert related.status_code == 200
    assert related.json() == []
    assert link.status_code == 201
    assert link.json()["user_id"] == str(partner.user_id)
    assert synastry.status_code == 200
    assert synastry.json()["primary_chart"]["user_id"] == str(user.user_id)
    assert synastry.json()["partner_chart"]["user_id"] == str(partner.user_id)


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


def test_tenant_isolation_update_client_birth_data(monkeypatch):
    owner = _create_astrologer("editor@example.com", "password123")
    other = _create_astrologer("foreign@example.com", "password123")
    own_user = _create_user(owner.id)
    foreign_user = _create_user(other.id)

    def _fake_updated_chart(user_id, **_kwargs):
        return {
            "user_id": str(user_id),
            "birth_data": {
                "first_name": "Updated",
                "last_name": "Client",
                "date": "1991-02-03",
                "time": "13:45:00",
                "timezone": "Europe/Kyiv",
                "utc_time": "1991-02-03T11:45:00+00:00",
                "julian_day": 2448285.99,
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

    monkeypatch.setattr(natal_route.natal_service, "update_existing_chart", _fake_updated_chart)

    payload = {
        "first_name": "Updated",
        "last_name": "Client",
        "date": "1991-02-03",
        "time": "13:45:00",
        "timezone": "Europe/Kyiv",
        "place": "Kyiv",
        "latitude": 50.45,
        "longitude": 30.523,
        "house_system": "P",
    }

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"email": "editor@example.com", "password": "password123"})
        assert login.status_code == 200

        own_update = client.put(f"/api/v1/users/{own_user.user_id}", json=payload)
        assert own_update.status_code == 200
        assert own_update.json()["birth_data"]["first_name"] == "Updated"

        foreign_update = client.put(f"/api/v1/users/{foreign_user.user_id}", json=payload)
        assert foreign_update.status_code == 403


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
