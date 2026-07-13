import os
from uuid import uuid4

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_lunar_api_test.db")

from app.api.main import app  # noqa: E402
from app.auth.dependencies import AuthContext, require_auth  # noqa: E402
from app.services.lunar_service import LunarService  # noqa: E402


def _override_auth():
    astrologer = type("AstrologerStub", (), {"id": uuid4(), "email": "test@example.com"})()
    session = type("SessionStub", (), {"session_id": "test"})()
    return AuthContext(astrologer=astrologer, session=session)


def test_eclipse_period_route_uses_chart_timezone_and_location(monkeypatch):
    captured = {}

    def _fake(self, start_utc, end_utc, **kwargs):
        captured.update(start_utc=start_utc, end_utc=end_utc, **kwargs)
        return {"events": [], "count": 0}

    monkeypatch.setattr(LunarService, "eclipses_in_period", _fake)
    app.dependency_overrides[require_auth] = _override_auth
    try:
        response = TestClient(app).get(
            "/api/v1/lunar/eclipses",
            params={
                "start_date": "2026-08-01",
                "end_date": "2026-08-31",
                "timezone": "Europe/Prague",
                "latitude": 50.0755,
                "longitude": 14.4378,
                "location_name": "Prague",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["timezone_name"] == "Europe/Prague"
    assert captured["latitude"] == 50.0755
    assert captured["longitude"] == 14.4378
    assert captured["start_utc"].hour == 22  # local midnight during CEST
    assert captured["start_utc"].day == 31


def test_eclipse_period_route_requires_coordinate_pair():
    app.dependency_overrides[require_auth] = _override_auth
    try:
        response = TestClient(app).get(
            "/api/v1/lunar/eclipses",
            params={
                "start_date": "2026-08-01",
                "end_date": "2026-08-31",
                "latitude": 50.0755,
            },
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 422
