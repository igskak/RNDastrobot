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


def _user_stub(user_id):
    return type("UserStub", (), {"user_id": user_id, "astrologer_id": uuid4()})()


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
    def fake_access(*args, **kwargs):
        calls.setdefault("access", args)
        return _user_stub(args[3])

    monkeypatch.setattr(transits, "ensure_client_access", fake_access)

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


def test_aspect_dynamics_route_uses_universal_service_for_progression(monkeypatch):
    user_id = uuid4()
    calls = {}

    class FakeAspectDynamicsService:
        def __init__(self, db_session, ephe_path=None):
            calls["db_session"] = db_session
            calls["ephe_path"] = ephe_path

        @staticmethod
        def request_cache_key(payload, *, astrologer_id):
            calls["cache_payload"] = payload
            calls["cache_astrologer_id"] = astrologer_id
            return "cache-key"

        def context_from_user(self, user):
            calls.setdefault("contexts", []).append(user.user_id)
            return object()

        def calculate(self, **kwargs):
            calls["calculate"] = kwargs
            return {
                "method": kwargs["method"],
                "transit_body": kwargs["source_body"],
                "natal_body": kwargs["target_body"],
                "source_body": kwargs["source_body"],
                "target_body": kwargs["target_body"],
                "aspect_type": kwargs["aspect_type"],
                "timezone": kwargs["timezone"],
                "calc_version": "aspect_dynamics_v2",
                "status": "ok",
                "cache_hit": False,
                "contacts": [],
                "series": [],
            }

    monkeypatch.setattr(transits, "AspectDynamicsService", FakeAspectDynamicsService)
    def fake_access(*args, **kwargs):
        calls.setdefault("access", args)
        return _user_stub(args[3])

    monkeypatch.setattr(transits, "ensure_client_access", fake_access)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transits/aspect-dynamics",
            json={
                "user_id": str(user_id),
                "method": "progression",
                "source_body": "Moon",
                "target_body": "Sun",
                "aspect_type": "Trine",
                "selected_date": "2026-06-29",
                "selected_time": "12:00:00",
                "timezone": "UTC",
                "max_points": 240,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["method"] == "progression"
    assert body["source_body"] == "Moon"
    assert calls["contexts"] == [user_id]
    assert calls["calculate"]["method"] == "progression"
    assert calls["calculate"]["max_points"] == 240
    assert calls["calculate"]["preview"] is False
    assert calls["calculate"]["cache_key"] == "cache-key"


def test_aspect_dynamics_route_uses_universal_service_for_natal(monkeypatch):
    user_id = uuid4()
    calls = {}

    class FakeAspectDynamicsService:
        def __init__(self, db_session, ephe_path=None):
            calls["db_session"] = db_session
            calls["ephe_path"] = ephe_path

        @staticmethod
        def request_cache_key(payload, *, astrologer_id):
            calls["cache_payload"] = payload
            calls["cache_astrologer_id"] = astrologer_id
            return "cache-key"

        def context_from_user(self, user):
            calls["context"] = user.user_id
            return object()

        def calculate(self, **kwargs):
            calls["calculate"] = kwargs
            return {
                "method": kwargs["method"],
                "transit_body": kwargs["source_body"],
                "natal_body": kwargs["target_body"],
                "source_body": kwargs["source_body"],
                "target_body": kwargs["target_body"],
                "aspect_type": kwargs["aspect_type"],
                "timezone": kwargs["timezone"],
                "calc_version": "aspect_dynamics_v2",
                "status": "ok",
                "cache_hit": False,
                "contacts": [],
                "series": [],
            }

    monkeypatch.setattr(transits, "AspectDynamicsService", FakeAspectDynamicsService)
    def fake_access(*args, **kwargs):
        calls.setdefault("access", args)
        return _user_stub(args[3])

    monkeypatch.setattr(transits, "ensure_client_access", fake_access)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transits/aspect-dynamics",
            json={
                "user_id": str(user_id),
                "method": "natal",
                "source_body": "Moon",
                "target_body": "Sun",
                "aspect_type": "Trine",
                "selected_date": "1990-06-26",
                "selected_time": "14:30:00",
                "timezone": "UTC",
                "max_points": 240,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["method"] == "natal"
    assert body["source_body"] == "Moon"
    assert body["target_body"] == "Sun"
    assert calls["context"] == user_id
    assert calls["access"][3] == user_id
    assert calls["calculate"]["method"] == "natal"
    assert calls["calculate"]["max_points"] == 240
    assert calls["calculate"]["cache_key"] == "cache-key"


def test_aspect_dynamics_route_passes_preview_to_universal_service(monkeypatch):
    user_id = uuid4()
    calls = {}

    class FakeAspectDynamicsService:
        def __init__(self, db_session, ephe_path=None):
            calls["db_session"] = db_session
            calls["ephe_path"] = ephe_path

        @staticmethod
        def request_cache_key(payload, *, astrologer_id):
            calls["cache_payload"] = payload
            return "cache-key"

        def context_from_user(self, user):
            calls["context"] = user.user_id
            return object()

        def calculate(self, **kwargs):
            calls["calculate"] = kwargs
            return {
                "method": kwargs["method"],
                "transit_body": kwargs["source_body"],
                "natal_body": kwargs["target_body"],
                "source_body": kwargs["source_body"],
                "target_body": kwargs["target_body"],
                "aspect_type": kwargs["aspect_type"],
                "timezone": kwargs["timezone"],
                "calc_version": "aspect_dynamics_v2",
                "status": "ok",
                "preview": kwargs["preview"],
                "cache_hit": False,
                "contacts": [],
                "series": [],
            }

    monkeypatch.setattr(transits, "AspectDynamicsService", FakeAspectDynamicsService)
    monkeypatch.setattr(transits, "ensure_client_access", lambda *args, **kwargs: _user_stub(args[3]))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transits/aspect-dynamics",
            json={
                "user_id": str(user_id),
                "transit_body": "Pluto",
                "natal_body": "Sun",
                "aspect_type": "Trine",
                "selected_date": "2026-06-29",
                "selected_time": "12:00:00",
                "timezone": "UTC",
                "preview": True,
                "max_points": 96,
            },
        )

    assert response.status_code == 200
    assert response.json()["preview"] is True
    assert calls["context"] == user_id
    assert calls["cache_payload"]["preview"] is True
    assert calls["calculate"]["source_body"] == "Pluto"
    assert calls["calculate"]["target_body"] == "Sun"
    assert calls["calculate"]["preview"] is True
    assert calls["calculate"]["max_points"] == 96


def test_aspect_dynamics_route_returns_cache_before_context_load(monkeypatch):
    user_id = uuid4()
    calls = {}

    class FakeAspectDynamicsService:
        @staticmethod
        def request_cache_key(payload, *, astrologer_id):
            calls["cache_payload"] = payload
            return "cache-key"

        @staticmethod
        def cached_response(cache_key):
            calls["cache_key"] = cache_key
            return {
                "method": "progression",
                "transit_body": "Moon",
                "natal_body": "Sun",
                "source_body": "Moon",
                "target_body": "Sun",
                "aspect_type": "Trine",
                "timezone": "UTC",
                "calc_version": "aspect_dynamics_v2",
                "status": "ok",
                "cache_hit": True,
                "contacts": [],
                "series": [],
            }

        def __init__(self, *args, **kwargs):
            raise AssertionError("service must not be constructed on cache hit")

    def fake_access(*args, **kwargs):
        calls["access"] = args
        return _user_stub(args[3])

    monkeypatch.setattr(transits, "AspectDynamicsService", FakeAspectDynamicsService)
    monkeypatch.setattr(transits, "ensure_client_access", fake_access)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transits/aspect-dynamics",
            json={
                "user_id": str(user_id),
                "method": "progression",
                "source_body": "Moon",
                "target_body": "Sun",
                "aspect_type": "Trine",
                "selected_date": "2026-06-29",
                "selected_time": "12:00:00",
                "timezone": "UTC",
            },
        )

    assert response.status_code == 200
    assert response.json()["cache_hit"] is True
    assert calls["cache_key"] == "cache-key"
    assert calls["access"][3] == user_id


def test_aspect_dynamics_route_checks_partner_access_for_synastry(monkeypatch):
    user_id = uuid4()
    partner_id = uuid4()
    accessed = []

    class FakeAspectDynamicsService:
        def __init__(self, db_session, ephe_path=None):
            pass

        @staticmethod
        def request_cache_key(payload, *, astrologer_id):
            return "cache-key"

        def context_from_user(self, user):
            return {"user_id": user.user_id}

        def calculate(self, **kwargs):
            return {
                "method": "synastry_partner",
                "transit_body": kwargs["source_body"],
                "natal_body": kwargs["target_body"],
                "source_body": kwargs["source_body"],
                "target_body": kwargs["target_body"],
                "aspect_type": kwargs["aspect_type"],
                "timezone": kwargs["timezone"],
                "calc_version": "aspect_dynamics_v2",
                "status": "ok",
                "cache_hit": False,
                "contacts": [],
                "series": [],
            }

    def fake_access(_db, _request, _auth, client_id, *, action):
        accessed.append((client_id, action))
        return _user_stub(client_id)

    monkeypatch.setattr(transits, "AspectDynamicsService", FakeAspectDynamicsService)
    monkeypatch.setattr(transits, "ensure_client_access", fake_access)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transits/aspect-dynamics",
            json={
                "user_id": str(user_id),
                "partner": {"user_id": str(partner_id)},
                "method": "synastry_partner",
                "source_body": "Venus",
                "target_body": "Mars",
                "aspect_type": "Square",
                "selected_date": "1990-02-03",
                "selected_time": "04:05:00",
                "timezone": "UTC",
            },
        )

    assert response.status_code == 200
    assert accessed == [
        (user_id, "client.aspects.dynamics"),
        (partner_id, "client.aspects.dynamics_partner"),
    ]
