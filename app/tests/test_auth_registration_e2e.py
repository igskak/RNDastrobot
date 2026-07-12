import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_auth_registration_e2e_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.api.routes import auth as auth_route  # noqa: E402
from app.auth import dependencies as auth_dependencies  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import AdConversion, Astrologer  # noqa: E402
from app.tests.api_test_db import create_sqlite_test_session_factory, make_get_db_override, reset_sqlite_schema  # noqa: E402


engine, TestingSessionLocal = create_sqlite_test_session_factory("./_auth_registration_e2e_test.sqlite3")


@pytest.fixture(autouse=True)
def _db_setup(monkeypatch):
    reset_sqlite_schema(engine)

    monkeypatch.setattr(auth_dependencies, "RATE_LIMIT_MAX_PER_IP", 25)
    monkeypatch.setattr(auth_dependencies, "LOCKOUT_MAX_FAILURES", 5)
    app.dependency_overrides[get_db] = make_get_db_override(TestingSessionLocal)
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


def test_register_persists_percent_encoded_attribution_cookie(monkeypatch):
    """Regression for the offline-conversion break: the client stores the
    attribution cookie as encodeURIComponent(JSON.stringify(...)), so its value
    is percent-encoded JSON. Starlette does not percent-decode cookie values, so
    the server must unquote() before json.loads — otherwise read_attribution
    returned None and every signup_gclid / ad_conversions row was lost.
    """
    monkeypatch.setattr(auth_route, "send_email_verification_email", lambda **_: True)
    monkeypatch.setenv("OCI_CONVERSION_VALUE", "1")

    # Byte-for-byte what the browser sends (captured from the live site):
    # encodeURIComponent('{"utm_campaign":"steliara_search_us","gclid":"CjwTEST123","landing_path":"/"}')
    cookie_value = (
        "%7B%22utm_campaign%22%3A%22steliara_search_us%22%2C"
        "%22gclid%22%3A%22CjwTEST123%22%2C%22landing_path%22%3A%22%2F%22%7D"
    )

    with TestClient(app) as client:
        client.cookies.set("steliara_attribution", cookie_value)
        register = client.post(
            "/api/v1/auth/register",
            json={"email": "gclid@example.com", "password": "StrongPass123"},
        )
        assert register.status_code == 200

    session = TestingSessionLocal()
    try:
        astro = (
            session.query(Astrologer)
            .filter(Astrologer.email == "gclid@example.com")
            .one()
        )
        assert astro.signup_gclid == "CjwTEST123"
        assert astro.signup_attribution["utm_campaign"] == "steliara_search_us"

        conversion = (
            session.query(AdConversion)
            .filter(AdConversion.order_id == str(astro.id))
            .one()
        )
        assert conversion.gclid == "CjwTEST123"
        assert conversion.method == "email"
    finally:
        session.close()


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


def test_login_omits_mismatched_cookie_domain(monkeypatch):
    astrologer = Astrologer(
        email="domain-e2e@example.com",
        password_hash=auth_route.hash_password("StrongPass123"),
        auth_provider="local",
        is_active=True,
        email_verified_at=auth_route.utcnow(),
    )
    db = TestingSessionLocal()
    db.add(astrologer)
    db.commit()
    db.close()

    monkeypatch.setenv("COOKIE_DOMAIN", "www.steliara.com")
    monkeypatch.setenv("COOKIE_SECURE", "true")

    with TestClient(app, base_url="https://steliara.com") as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "domain-e2e@example.com", "password": "StrongPass123"},
        )

    assert login.status_code == 200
    set_cookie = login.headers.get("set-cookie", "")
    assert "astrobot_session=" in set_cookie
    assert "Domain=www.steliara.com" not in set_cookie
    assert "Secure" in set_cookie
