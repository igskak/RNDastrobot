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
    with TestClient(app) as client:
        root_response = client.get("/")
        index_response = client.get("/index.html")
        chart_response = client.get("/chart.html")
        solar_response = client.get("/solar.html")

    assert root_response.status_code == 200
    assert index_response.status_code == 200
    assert chart_response.status_code == 200
    assert solar_response.status_code == 200
    assert "text/html" in root_response.headers.get("content-type", "")
    assert "text/html" in index_response.headers.get("content-type", "")
    assert "text/html" in chart_response.headers.get("content-type", "")
    assert "text/html" in solar_response.headers.get("content-type", "")
