import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_natal_karmic_api_test.db")

from app.api.main import app  # noqa: E402
from app.api.routes import natal  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.services.karmic_analysis_service import KarmicAnalysisService  # noqa: E402


class _DummySession:
    pass


def _override_get_db():
    yield _DummySession()


def _chart_payload(user_id=None):
    chart = {
        "user_id": user_id,
        "birth_data": {
            "first_name": "Test",
            "last_name": "User",
            "date": "1990-01-15",
            "time": "12:30:00",
            "timezone": "Europe/Kiev",
            "utc_time": "1990-01-15 10:30:00",
            "julian_day": 2447906.9375,
            "latitude": 50.4501,
            "longitude": 30.5234,
            "place": "Kyiv, Ukraine",
        },
        "planets": [
            {"name": "Sun", "longitude": 10.0, "sign": "Aries", "degree_in_sign": 10.0, "house": 1, "retrograde": False},
            {"name": "Moon", "longitude": 220.0, "sign": "Scorpio", "degree_in_sign": 10.0, "house": 8, "retrograde": False},
            {"name": "Saturn", "longitude": 185.0, "sign": "Libra", "degree_in_sign": 5.0, "house": 7, "retrograde": False},
        ],
        "houses": [
            {"number": i, "longitude": float((i - 1) * 30), "sign": "Aries", "degree_in_sign": 0.0}
            for i in range(1, 13)
        ],
        "angles": {
            "ASC": {"name": "ASC", "longitude": 0.0, "sign": "Aries", "degree_in_sign": 0.0},
            "MC": {"name": "MC", "longitude": 90.0, "sign": "Cancer", "degree_in_sign": 0.0},
        },
        "special_points": {
            "TrueNorthNode": {"name": "TrueNorthNode", "longitude": 15.0, "sign": "Aries", "degree_in_sign": 15.0, "house": 1},
            "TrueSouthNode": {"name": "TrueSouthNode", "longitude": 195.0, "sign": "Libra", "degree_in_sign": 15.0, "house": 7},
            "BlackMoon": {"name": "BlackMoon", "longitude": 225.0, "sign": "Scorpio", "degree_in_sign": 15.0, "house": 8},
            "WhiteMoon": {"name": "WhiteMoon", "longitude": 330.0, "sign": "Pisces", "degree_in_sign": 0.0, "house": 12},
        },
        "configurations": {},
        "aspects": [
            {"planet_1": "Sun", "planet_2": "TrueNorthNode", "aspect_type": "Conjunction", "orb": 1.0, "is_major": True, "harmonic_type": "neutral"},
            {"planet_1": "Moon", "planet_2": "Saturn", "aspect_type": "Trine", "orb": 2.0, "is_major": True, "harmonic_type": "harmonious"},
        ],
        "aspect_configurations": [],
        "stelliums": [],
        "planet_distribution": None,
        "cosmogram_pattern": {"pattern_type": "Bucket", "empty_arc_degree": 120.0, "leading_planet": "Sun", "handle_planet": "Moon"},
        "balances": None,
    }
    chart["karmic_analysis"] = KarmicAnalysisService().build(chart)
    return chart


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_post_natal_calculate_includes_karmic_analysis(client, monkeypatch):
    monkeypatch.setattr(natal.natal_service, "calculate_natal_chart", lambda **_: _chart_payload(user_id=None))

    response = client.post(
        "/api/v1/natal/calculate?save_to_db=false",
        json={
            "date": "1990-01-15",
            "time": "12:30:00",
            "timezone": "Europe/Kiev",
            "latitude": 50.4501,
            "longitude": 30.5234,
            "house_system": "P",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "karmic_analysis" in payload
    assert set(payload["karmic_analysis"].keys()) == {
        "nodes",
        "saturn_analysis",
        "lunar_points_analysis",
        "karmic_status",
        "karmic_support",
        "karmic_development",
        "jones_pattern",
    }


def test_get_natal_by_user_id_includes_karmic_analysis(client, monkeypatch):
    user_id = str(uuid4())
    monkeypatch.setattr(
        natal.natal_service,
        "get_natal_chart_from_db",
        lambda _user_id, _db: _chart_payload(user_id=user_id),
    )

    response = client.get(f"/api/v1/natal/{user_id}")

    assert response.status_code == 200
    payload = response.json()
    assert "karmic_analysis" in payload
    assert "north_node" in payload["karmic_analysis"]["nodes"]
    assert "south_node" in payload["karmic_analysis"]["nodes"]
    assert isinstance(payload["karmic_analysis"]["karmic_support"]["harmonic_trines"], list)
