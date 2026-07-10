import os

from fastapi.testclient import TestClient

# Prevent connection bootstrap failures in test env.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_e2e_smoke.db")

from app.api.main import app  # noqa: E402


def test_health_endpoint_smoke() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_html_entrypoints_smoke() -> None:
    # chart.html / solar.html / synastry.html were retired; forecast-new is the
    # single workspace. Solar/synastry now live as ring layers inside it.
    with TestClient(app) as client:
        root_response = client.get("/")
        index_response = client.get("/index.html")
        forecast_response = client.get("/forecast-new.html")

    assert root_response.status_code == 200
    assert index_response.status_code == 200
    assert forecast_response.status_code == 200
    assert "text/html" in root_response.headers.get("content-type", "")
    assert "text/html" in index_response.headers.get("content-type", "")
    assert "text/html" in forecast_response.headers.get("content-type", "")


def test_retired_pages_return_404() -> None:
    # Regression guard: the old chart pages must no longer be served.
    with TestClient(app) as client:
        assert client.get("/chart.html").status_code == 404
        assert client.get("/solar.html").status_code == 404
        assert client.get("/synastry.html").status_code == 404


def test_runtime_config_exposes_safe_onboarding_rollout(monkeypatch) -> None:
    monkeypatch.setenv("ONBOARDING_V1_ENABLED", "true")
    monkeypatch.setenv("ONBOARDING_V1_LAUNCHED_AT", "2026-07-10T00:00:00Z")

    with TestClient(app) as client:
        response = client.get("/runtime-config.js")

    assert response.status_code == 200
    assert '"onboardingV1Enabled": true' in response.text
    assert '"onboardingV1LaunchedAt": "2026-07-10T00:00:00Z"' in response.text
