import os
from datetime import datetime
from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient

os.environ.setdefault(
    "DATABASE_URL", "sqlite+pysqlite:///./_chart_import_api_test.db"
)
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("CHART_IMPORT_ENABLED", "true")

from app.api.main import app  # noqa: E402
from app.auth.dependencies import AuthContext, require_auth  # noqa: E402
from app.database.connection import get_db  # noqa: E402
from app.database.models import (  # noqa: E402
    Astrologer,
    ChartImportBatch,
    ChartImportItem,
    Person,
    User,
)
from app.tests.api_test_db import (  # noqa: E402
    create_sqlite_test_session_factory,
    make_get_db_override,
    reset_sqlite_schema,
)


engine, TestingSessionLocal = create_sqlite_test_session_factory(
    "./_chart_import_api_test.sqlite3"
)


def _owner(email):
    db = TestingSessionLocal()
    try:
        owner = Astrologer(
            email=email,
            auth_provider="local",
            password_hash="hash",
            plan_code="pro",
        )
        db.add(owner)
        db.commit()
        db.refresh(owner)
        return owner.id
    finally:
        db.close()


def _auth(owner_id):
    db = TestingSessionLocal()
    try:
        owner = db.get(Astrologer, owner_id)
        return AuthContext(
            astrologer=owner, session=SimpleNamespace(session_id="test")
        )
    finally:
        db.close()


def _zet(*lines):
    rows = []
    for title, local_time in lines:
        rows.append(
            f"{title};20.04.2000;{local_time};+0:52:08;"
            "Braunau;48n15;13e02;;note"
        )
    return "\r\n".join(rows).encode("cp1251")


def setup_function(_):
    reset_sqlite_schema(engine)
    app.dependency_overrides[get_db] = make_get_db_override(
        TestingSessionLocal
    )


def teardown_function(_):
    app.dependency_overrides.clear()


def test_preview_is_owner_scoped_and_does_not_create_charts_or_profiles():
    owner_id = _owner("owner@example.com")
    other_id = _owner("other@example.com")
    app.dependency_overrides[require_auth] = lambda: _auth(owner_id)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chart-imports/preview",
            files={
                "file": (
                    "cards.zbs",
                    _zet(("One", "16:00"), ("Two", "16:10")),
                    "application/octet-stream",
                )
            },
        )
        assert response.status_code == 201, response.text
        batch_id = response.json()["id"]
        assert response.json()["total"] == 2
        assert all(
            item["record"]["timezone"] == "UTC+00:52:08"
            for item in response.json()["items"]
        )

        db = TestingSessionLocal()
        try:
            assert db.query(User).count() == 0
            assert db.query(Person).count() == 0
        finally:
            db.close()

        app.dependency_overrides[require_auth] = lambda: _auth(other_id)
        assert (
            client.get(f"/api/v1/chart-imports/{batch_id}").status_code == 404
        )


def test_expired_preview_removes_temporary_birth_data():
    owner_id = _owner("owner@example.com")
    app.dependency_overrides[require_auth] = lambda: _auth(owner_id)
    with TestClient(app) as client:
        preview = client.post(
            "/api/v1/chart-imports/preview",
            files={
                "file": (
                    "cards.zbs",
                    _zet(("One", "16:00")),
                    "application/octet-stream",
                )
            },
        ).json()
        db = TestingSessionLocal()
        try:
            batch = db.get(ChartImportBatch, UUID(preview["id"]))
            batch.expires_at = datetime(2000, 1, 1)
            db.commit()
        finally:
            db.close()

        response = client.get(f"/api/v1/chart-imports/{preview['id']}")
        assert response.status_code == 200
        assert response.json()["status"] == "expired"
        assert response.json()["items"][0]["record"] == {}


def test_confirm_library_and_commit_are_idempotent(monkeypatch):
    owner_id = _owner("owner@example.com")
    app.dependency_overrides[require_auth] = lambda: _auth(owner_id)

    class FakeNatalChartService:
        def __init__(self, **_kwargs):
            pass

        def calculate_natal_chart(
            self,
            *,
            db_session,
            astrologer_id,
            birth_date,
            birth_time,
            timezone,
            place,
            latitude,
            longitude,
            house_system,
            first_name,
            last_name,
            zodiac,
            ayanamsha,
            **_kwargs,
        ):
            chart = User(
                astrologer_id=astrologer_id,
                first_name=first_name,
                last_name=last_name,
                birth_date=birth_date,
                birth_time=birth_time,
                timezone=timezone,
                birth_place=place,
                lat=latitude,
                lon=longitude,
                julian_day=2451545.0,
                house_system=house_system,
                zodiac=zodiac,
                ayanamsha=ayanamsha,
                tags=[],
            )
            db_session.add(chart)
            db_session.flush()
            return {"user_id": str(chart.user_id)}

    monkeypatch.setattr(
        "app.services.chart_import.service.NatalChartService",
        FakeNatalChartService,
    )
    monkeypatch.setattr(
        "app.services.chart_import.service.TimeService.process_birth_time",
        lambda local_date, local_time, timezone_name: (
            __import__(
                "app.services.time_service", fromlist=["TimeService"]
            ).TimeService.to_utc(local_date, local_time, timezone_name),
            2451545.0,
        ),
    )

    with TestClient(app) as client:
        preview = client.post(
            "/api/v1/chart-imports/preview",
            files={
                "file": (
                    "cards.zbs",
                    _zet(("One", "16:00")),
                    "application/octet-stream",
                )
            },
        ).json()
        batch_id = preview["id"]
        item_id = preview["items"][0]["id"]
        confirmed = client.post(
            f"/api/v1/chart-imports/{batch_id}/confirm",
            json={
                "item_ids": [item_id],
                "placement": "library",
                "tags": ["Обучение", " Обучение "],
                "house_system": "P",
                "acknowledged_warning_item_ids": [item_id],
            },
        )
        assert confirmed.status_code == 200, confirmed.text

        first = client.post(
            f"/api/v1/chart-imports/{batch_id}/items/{item_id}/commit"
        )
        assert first.status_code == 200, first.text
        assert first.json()["status"] == "imported"
        chart_id = first.json()["resulting_chart_id"]
        second = client.post(
            f"/api/v1/chart-imports/{batch_id}/items/{item_id}/commit"
        )
        assert second.status_code == 200
        assert second.json()["resulting_chart_id"] == chart_id

        db = TestingSessionLocal()
        try:
            chart = db.query(User).one()
            assert chart.person_id is None
            assert chart.tags == ["Обучение"]
            assert db.query(Person).count() == 0
            assert (
                db.get(ChartImportBatch, UUID(batch_id)).status == "completed"
            )
            receipt = db.get(ChartImportItem, UUID(item_id))
            assert receipt.normalized_payload == {}
            assert receipt.fingerprint
        finally:
            db.close()


def test_profile_mode_creates_one_profile_on_first_success(monkeypatch):
    owner_id = _owner("owner@example.com")
    app.dependency_overrides[require_auth] = lambda: _auth(owner_id)

    class FakeNatalChartService:
        def __init__(self, **_kwargs):
            pass

        def calculate_natal_chart(
            self,
            *,
            db_session,
            astrologer_id,
            birth_date,
            birth_time,
            timezone,
            place,
            latitude,
            longitude,
            house_system,
            **kwargs,
        ):
            chart = User(
                astrologer_id=astrologer_id,
                birth_date=birth_date,
                birth_time=birth_time,
                timezone=timezone,
                birth_place=place,
                lat=latitude,
                lon=longitude,
                julian_day=2451545,
                house_system=house_system,
                tags=[],
            )
            db_session.add(chart)
            db_session.flush()
            return {"user_id": str(chart.user_id)}

    monkeypatch.setattr(
        "app.services.chart_import.service.NatalChartService",
        FakeNatalChartService,
    )
    monkeypatch.setattr(
        "app.services.chart_import.service.TimeService.process_birth_time",
        lambda local_date, local_time, timezone_name: (
            __import__(
                "app.services.time_service", fromlist=["TimeService"]
            ).TimeService.to_utc(local_date, local_time, timezone_name),
            2451545.0,
        ),
    )
    with TestClient(app) as client:
        preview = client.post(
            "/api/v1/chart-imports/preview",
            files={
                "file": (
                    "cards.zbs",
                    _zet(("One", "16:00"), ("Two", "16:10")),
                    "application/octet-stream",
                )
            },
        ).json()
        ids = [item["id"] for item in preview["items"]]
        confirmed = client.post(
            f"/api/v1/chart-imports/{preview['id']}/confirm",
            json={
                "item_ids": ids,
                "placement": "profile",
                "new_profile_name": "!текущий",
                "acknowledged_warning_item_ids": ids,
            },
        )
        assert confirmed.status_code == 200, confirmed.text
        for item_id in ids:
            saved = client.post(
                f"/api/v1/chart-imports/{preview['id']}/items/{item_id}/commit"
            )
            assert saved.json()["status"] == "imported", saved.text

        db = TestingSessionLocal()
        try:
            profile = db.query(Person).one()
            assert profile.display_name == "!текущий"
            assert (
                db.query(User)
                .filter(User.person_id == profile.person_id)
                .count()
                == 2
            )
        finally:
            db.close()
