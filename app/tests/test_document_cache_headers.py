"""HTML documents are never cached; versioned static assets are.

Written after a deploy on 2026-09-24: /forecast-new.html was missing from a
hand-kept list of document paths, went out with no Cache-Control at all, and
browsers kept serving the previous workspace (and its old bundles) for hours.
"""
import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_document_cache_headers_test.db")

from app.api.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


DOCUMENT_PATHS = [
    "/",
    "/new",
    "/login.html",
    "/pricing.html",
    "/cloud-astrology-software",
    "/forecast-new",
    "/forecast-new.html",
    "/forecast-tables.html",
    "/forecast-timeline.html",
    "/calendar",
    "/natal-full.html",
    "/client/73bf4358-e3ac-4b8d-8c0e-bb750318e830",
    "/de/",
    "/de/pricing.html",
]


@pytest.mark.parametrize("path", DOCUMENT_PATHS)
def test_every_html_document_is_refetched(client, path):
    response = client.get(path, follow_redirects=False)

    assert response.status_code == 200, path
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["cache-control"] == "no-store, max-age=0"


def test_versioned_assets_stay_long_cached_in_production(client, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    response = client.get("/js/chat-markdown.js")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_a_route_that_sets_its_own_cache_policy_keeps_it(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_SITE_VERIFICATION", "google0123abcd.html")
    response = client.get("/google0123abcd.html")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=86400"
