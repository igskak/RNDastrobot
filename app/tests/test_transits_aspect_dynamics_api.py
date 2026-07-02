import os
from datetime import date, time
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_transits_aspect_dynamics_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.api.routes import transits  # noqa: E402
from app.auth.dependencies import AuthContext, require_auth  # noqa: E402
from app.database.connection import get_db  # noqa: E402


class _DummySession:
    pass


def _override_get_db():
    yield _DummySession()


def _override_auth():
    astrologer = type("AstrologerStub", (), {"id": uuid4(), "email": "test@example.com"})()
    session = type("SessionStub", (), {"session_id": "test"})()
    return AuthContext(astrologer=astrologer, session=session)


def setup_function(_):
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[require_auth] = _override_auth


def teardown_function(_):
    app.dependency_overrides.clear()


def _ok_payload():
    return {
        "transit_body": "Pluto",
        "natal_body": "Sun",
        "aspect_type": "Trine",
        "timezone": "UTC",
        "calc_version": "aspect_dynamics_v1",
        "status": "ok",
        "exact_angle": 120.0,
        "orb_used": 5.0,
        "orb_source": "astrologer_settings",
        "target_angle": 120.0,
        "selected_point": {
            "datetime": "2026-06-29T12:00:00+00:00",
            "julian_day": 2461221.0,
            "signed_orb": 0.1,
            "abs_orb": 0.1,
            "strength": 0.98,
            "in_orb": True,
        },
        "requested_window": {"selected": "2026-06-29T12:00:00+00:00"},
        "effective_window": {
            "start": "2026-06-01T00:00:00+00:00",
            "end": "2026-07-20T00:00:00+00:00",
        },
        "boundary_complete": True,
        "contacts": [
            {
                "enter": "2026-06-01T00:00:00+00:00",
                "enter_complete": True,
                "leave": "2026-07-20T00:00:00+00:00",
                "leave_complete": True,
                "exact_pass_count": 1,
                "passes": [
                    {
                        "date": "2026-06-30T12:00:00+00:00",
                        "motion": "direct",
                        "orb": 0.0,
                    }
                ],
                "stations": [],
                "closest_approach": {
                    "date": "2026-06-30T12:00:00+00:00",
                    "orb": 0.0,
                },
            }
        ],
        "series": [
            {
                "datetime": "2026-06-01T00:00:00+00:00",
                "julian_day": 2461192.5,
                "signed_orb": 2.0,
                "abs_orb": 2.0,
                "strength": 0.6,
                "in_orb": True,
            },
            {
                "datetime": "2026-06-30T12:00:00+00:00",
                "julian_day": 2461222.0,
                "signed_orb": 0.0,
                "abs_orb": 0.0,
                "strength": 1.0,
                "in_orb": True,
            },
        ],
    }


def test_transit_aspect_dynamics_route_valid_request(monkeypatch):
    user_id = uuid4()
    calls = {}

    class FakeTransitService:
        def __init__(self, db_session, ephe_path=None):
            calls["db_session"] = db_session
            calls["ephe_path"] = ephe_path

        def calculate_aspect_dynamics(self, **kwargs):
            calls["kwargs"] = kwargs
            return _ok_payload()

    monkeypatch.setattr(transits, "TransitService", FakeTransitService)
    monkeypatch.setattr(transits, "ensure_client_access", lambda *args, **kwargs: calls.setdefault("access", args))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transits/aspect-dynamics",
            json={
                "user_id": str(user_id),
                "transit_body": "Pluto",
                "natal_body": "Sun",
                "aspect_type": "Trine",
                "selected_date": "2026-06-29",
                "selected_time": "12:30:00",
                "timezone": "UTC",
                "max_points": 180,
            },
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    kwargs = calls["kwargs"]
    assert kwargs["user_id"] == user_id
    assert kwargs["selected_date"] == date(2026, 6, 29)
    assert kwargs["selected_time"] == time(12, 30)
    assert kwargs["max_points"] == 180


def test_transit_aspect_dynamics_route_returns_domain_status(monkeypatch):
    class FakeTransitService:
        def __init__(self, db_session, ephe_path=None):
            pass

        def calculate_aspect_dynamics(self, **kwargs):
            return {
                "transit_body": kwargs["transit_body"],
                "natal_body": kwargs["natal_body"],
                "aspect_type": kwargs["aspect_type"],
                "timezone": kwargs["timezone"],
                "calc_version": "aspect_dynamics_v1",
                "status": "unknown_natal_body",
                "contacts": [],
                "series": [],
            }

    monkeypatch.setattr(transits, "TransitService", FakeTransitService)
    monkeypatch.setattr(transits, "ensure_client_access", lambda *args, **kwargs: None)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transits/aspect-dynamics",
            json={
                "user_id": str(uuid4()),
                "transit_body": "Pluto",
                "natal_body": "MissingPoint",
                "aspect_type": "Trine",
                "selected_date": "2026-06-29",
                "selected_time": "12:00:00",
                "timezone": "UTC",
            },
        )

    assert response.status_code == 200
    assert response.json()["status"] == "unknown_natal_body"


def test_transit_aspect_dynamics_route_checks_client_access(monkeypatch):
    class FakeTransitService:
        def __init__(self, db_session, ephe_path=None):
            raise AssertionError("TransitService should not be constructed")

    monkeypatch.setattr(transits, "TransitService", FakeTransitService)
    monkeypatch.setattr(
        transits,
        "ensure_client_access",
        lambda *args, **kwargs: (_ for _ in ()).throw(HTTPException(status_code=403)),
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transits/aspect-dynamics",
            json={
                "user_id": str(uuid4()),
                "transit_body": "Pluto",
                "natal_body": "Sun",
                "aspect_type": "Trine",
                "selected_date": "2026-06-29",
                "selected_time": "12:00:00",
                "timezone": "UTC",
            },
        )

    assert response.status_code == 403
