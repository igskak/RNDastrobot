import os
from datetime import date, time
from types import SimpleNamespace

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_forecast_aux_api_test.db")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.api.main import app  # noqa: E402
from app.auth.dependencies import AuthContext, require_auth  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import Angle, Astrologer, NatalHouse, NatalPlanet, NatalSpecialPoint, User  # noqa: E402
from app.services.forecast_aux_service import ForecastAuxService  # noqa: E402
from app.services.natal_context_read_service import NatalContextReadService  # noqa: E402
from app.tests.api_test_db import create_sqlite_test_session_factory, make_get_db_override, reset_sqlite_schema  # noqa: E402


engine, TestingSessionLocal = create_sqlite_test_session_factory("./_forecast_aux_api_test.sqlite3")


def _create_astrologer(email="owner@example.com"):
    db = TestingSessionLocal()
    try:
        astrologer = Astrologer(
            email=email,
            auth_provider="local",
            password_hash="hash",
            plan_code="pro",
        )
        db.add(astrologer)
        db.commit()
        db.refresh(astrologer)
        return astrologer.id
    finally:
        db.close()


def _create_chart(astrologer_id):
    db = TestingSessionLocal()
    try:
        user = User(
            astrologer_id=astrologer_id,
            first_name="Ada",
            last_name="Lovelace",
            title="Ada natal",
            chart_kind="birth",
            birth_date=date(1990, 6, 26),
            birth_time=time(14, 35),
            timezone="Europe/Kiev",
            birth_place="Kyiv",
            lat=50.4501,
            lon=30.5234,
            julian_day=2448068.1,
            house_system="P",
            zodiac="tropical",
            tags=[],
        )
        db.add(user)
        db.flush()
        db.add_all([
            NatalPlanet(user_id=user.user_id, planet="Sun", sign="Cancer", degree=94.5, house_number=9, retrograde=False, strength_score=3.0),
            NatalPlanet(user_id=user.user_id, planet="Moon", sign="Aries", degree=12.5, house_number=1, retrograde=False, strength_score=2.0),
            NatalPlanet(user_id=user.user_id, planet="Mars", sign="Leo", degree=130.0, house_number=10, retrograde=False, strength_score=2.5),
            Angle(
                user_id=user.user_id,
                asc_sign="Aries",
                asc_degree=10.0,
                mc_sign="Capricorn",
                mc_degree=280.0,
                ic_sign="Cancer",
                ic_degree=100.0,
                dsc_sign="Libra",
                dsc_degree=190.0,
            ),
            NatalSpecialPoint(user_id=user.user_id, point="Vertex", sign="Virgo", degree=170.0, house_number=6),
        ])
        for house in range(1, 13):
            db.add(NatalHouse(
                user_id=user.user_id,
                house_number=house,
                sign_on_cusp="Aries",
                cusp_degree=(house - 1) * 30,
            ))
        db.commit()
        db.refresh(user)
        return user.user_id
    finally:
        db.close()


def _auth_override(astrologer_id):
    db = TestingSessionLocal()
    try:
        astrologer = db.query(Astrologer).filter(Astrologer.id == astrologer_id).first()
        return AuthContext(astrologer=astrologer, session=SimpleNamespace(session_id="test"))
    finally:
        db.close()


def setup_function(_):
    reset_sqlite_schema(engine)
    NatalContextReadService.clear_cache()
    ForecastAuxService.clear_result_cache()
    app.dependency_overrides[get_db] = make_get_db_override(TestingSessionLocal)


def teardown_function(_):
    app.dependency_overrides.clear()


def test_forecast_aux_matches_legacy_blocks():
    owner_id = _create_astrologer()
    chart_id = _create_chart(owner_id)
    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)

    with TestClient(app) as client:
        aux = client.post(
            "/api/v1/forecast/aux",
            json={
                "source": {"user_id": str(chart_id)},
                "target_date": "2026-07-02",
                "blocks": ["profections", "antiscia", "dominants"],
            },
        )
        profections = client.get("/api/v1/profections", params={"user_id": str(chart_id), "at": "2026-07-02"})
        antiscia = client.get("/api/v1/antiscia", params={"user_id": str(chart_id)})
        dominants = client.get("/api/v1/dominants", params={"user_id": str(chart_id)})

    assert aux.status_code == 200
    payload = aux.json()
    assert payload["errors"] == {}
    assert payload["blocks"]["profections"] == profections.json()
    assert payload["blocks"]["antiscia"] == antiscia.json()
    assert payload["blocks"]["dominants"] == dominants.json()


def test_forecast_aux_rejects_foreign_chart():
    owner_id = _create_astrologer("owner@example.com")
    other_id = _create_astrologer("other@example.com")
    foreign_chart_id = _create_chart(other_id)
    app.dependency_overrides[require_auth] = lambda: _auth_override(owner_id)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/forecast/aux",
            json={"source": {"user_id": str(foreign_chart_id)}, "blocks": ["dominants"]},
        )

    assert response.status_code == 403
