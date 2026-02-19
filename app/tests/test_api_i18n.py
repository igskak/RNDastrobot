import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

# Prevent connection bootstrap failures in test env.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_api_i18n_test.db")

from app.api.main import app  # noqa: E402
from app.api.routes import natal  # noqa: E402
from app.database.connection import get_db  # noqa: E402
import app.api.locale_dependency as locale_dependency  # noqa: E402
import app.i18n.errors as i18n_errors  # noqa: E402


class _DummySession:
    pass


def _override_get_db():
    yield _DummySession()


@pytest.fixture
def client(monkeypatch):
    app.dependency_overrides[get_db] = _override_get_db
    monkeypatch.setattr(
        natal.natal_service,
        "get_natal_chart_from_db",
        lambda user_id, db: None,
    )

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_locale_priority_user_preference_over_explicit_and_accept(client, monkeypatch):
    monkeypatch.setattr(locale_dependency, "resolve_user_preference_locale", lambda _user_id: "uk")

    user_id = uuid4()
    response = client.get(
        f"/api/v1/natal/{user_id}?locale=ru",
        headers={"Accept-Language": "en-US,en;q=0.9"},
    )

    assert response.status_code == 404
    payload = response.json()
    assert payload["error_code"] == "NATAL_CHART_NOT_FOUND"
    assert payload["message"] == "Натальну карту не знайдено."


def test_locale_priority_explicit_over_accept_language(client, monkeypatch):
    monkeypatch.setattr(locale_dependency, "resolve_user_preference_locale", lambda _user_id: None)

    user_id = uuid4()
    response = client.get(
        f"/api/v1/natal/{user_id}?locale=ru",
        headers={"Accept-Language": "uk-UA,uk;q=0.9"},
    )

    assert response.status_code == 404
    payload = response.json()
    assert payload["error_code"] == "NATAL_CHART_NOT_FOUND"
    assert payload["message"] == "Натальная карта не найдена."


def test_locale_priority_accept_language_when_no_explicit(client, monkeypatch):
    monkeypatch.setattr(locale_dependency, "resolve_user_preference_locale", lambda _user_id: None)

    user_id = uuid4()
    response = client.get(
        f"/api/v1/natal/{user_id}",
        headers={"Accept-Language": "uk-UA,ru;q=0.9"},
    )

    assert response.status_code == 404
    payload = response.json()
    assert payload["error_code"] == "NATAL_CHART_NOT_FOUND"
    assert payload["message"] == "Натальну карту не знайдено."


def test_fallback_to_en_when_translation_missing(client, monkeypatch):
    monkeypatch.setattr(locale_dependency, "resolve_user_preference_locale", lambda _user_id: "uk")

    original = dict(i18n_errors.ERROR_MESSAGES["NATAL_CHART_NOT_FOUND"])
    partial = dict(original)
    partial.pop("uk", None)
    monkeypatch.setitem(i18n_errors.ERROR_MESSAGES, "NATAL_CHART_NOT_FOUND", partial)

    user_id = uuid4()
    response = client.get(f"/api/v1/natal/{user_id}")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error_code"] == "NATAL_CHART_NOT_FOUND"
    assert payload["message"] == original["en"]


def test_error_contract_shape_for_validation_errors(client, monkeypatch):
    monkeypatch.setattr(locale_dependency, "resolve_user_preference_locale", lambda _user_id: None)

    response = client.post("/api/v1/natal/calculate?locale=ru", json={})

    assert response.status_code == 422
    payload = response.json()
    assert payload["error_code"] == "VALIDATION_ERROR"
    assert payload["message"] == "Ошибка валидации."
    assert isinstance(payload["detail"], list)
    assert payload["error"] == "VALIDATION_ERROR"


def test_legacy_endpoint_response_not_regressed(client, monkeypatch):
    monkeypatch.setattr(locale_dependency, "resolve_user_preference_locale", lambda _user_id: None)

    response = client.get("/health?locale=uk")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"


def test_frontend_locale_catalogs_are_served(client, monkeypatch):
    monkeypatch.setattr(locale_dependency, "resolve_user_preference_locale", lambda _user_id: None)

    response = client.get("/locales/en.json")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, dict)
    assert payload
