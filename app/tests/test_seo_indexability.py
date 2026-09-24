"""Which URLs search engines are allowed to index, and which they must drop.

Written after finding /login.html, /calendar and /account-settings.html in Bing's index
on 2026-09-17 — the last one with a snippet lifted off its own settings form. A
robots.txt Disallow had been in place the whole time and did nothing, because a crawl
block is not an index block.
"""
import os

import pytest
from fastapi.testclient import TestClient

# Prevent connection bootstrap failures in test env.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_seo_indexability_test.db")

from app.api.main import PREFIXED_LOCALES, app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


PUBLIC_PATHS = [
    "/",
    "/index.html",
    "/pricing.html",
    "/terms.html",
    "/astrology-practice-management",
    "/astrology-practice-management.html",
    "/astrologer-workspace",
    "/astrologer-workspace.html",
    "/cloud-astrology-software",
    "/cloud-astrology-software.html",
]

APP_PATHS = [
    "/login.html",
    "/calendar",
    "/account-settings.html",
    "/natal-full.html",
    "/forecast-new.html",
    "/forecast-tables.html",
    "/forecast-timeline.html",
    "/styleguide.html",
    "/new",
]


@pytest.mark.parametrize("path", PUBLIC_PATHS)
def test_public_pages_are_indexable(client, path):
    response = client.get(path)

    assert response.status_code == 200, path
    assert "x-robots-tag" not in response.headers, path


@pytest.mark.parametrize("path", APP_PATHS)
def test_application_screens_are_noindex(client, path):
    response = client.get(path)

    assert response.status_code == 200, path
    assert response.headers["x-robots-tag"] == "noindex, follow", path


def test_localized_public_pages_are_indexable_and_their_login_is_not(client):
    for locale in PREFIXED_LOCALES:
        for path in (f"/{locale}/", f"/{locale}/index.html", f"/{locale}/pricing.html", f"/{locale}/terms.html"):
            assert "x-robots-tag" not in client.get(path).headers, path

        assert client.get(f"/{locale}/login.html").headers["x-robots-tag"] == "noindex, follow"


def test_a_screen_nobody_thought_about_is_private_anyway(client):
    """The allow-list is derived from the sitemap, so unlisted paths start out noindex.

    /consultation-call.html and /login were never on anyone's exclusion list; they are
    covered because the rule is "indexable if advertised", not "indexable unless named".
    """
    for path in ("/consultation-call.html", "/calendar.html", "/login"):
        response = client.get(path)

        assert response.status_code == 200, path
        assert response.headers["x-robots-tag"] == "noindex, follow", path


def test_noindex_pages_stay_crawlable_or_the_header_is_never_read(client):
    robots = client.get("/robots.txt").text

    # Disallowing these would hide the noindex header that removes them.
    assert "Disallow: /account-settings" not in robots
    assert "Disallow: /login" not in robots
    assert "Disallow: /calendar" not in robots

    # Someone else's data stays blocked from crawling outright.
    assert "Disallow: /api/" in robots
    assert "Disallow: /client/" in robots
    assert "Disallow: /consultation/" in robots
    assert "Disallow: /call/" in robots


def test_every_sitemap_url_is_actually_indexable(client):
    """The two lists are generated from one source; this proves they stayed in sync."""
    import re

    body = client.get("/sitemap.xml").text
    locs = re.findall(r"<loc>https://www\.steliara\.com([^<]*)</loc>", body)

    assert locs, "sitemap advertises nothing"
    for path in locs:
        response = client.get(path)
        assert response.status_code == 200, path
        assert "x-robots-tag" not in response.headers, f"{path} is advertised and noindexed"


def test_indexnow_key_file_is_off_until_a_key_is_configured(client, monkeypatch):
    monkeypatch.delenv("INDEXNOW_KEY", raising=False)

    assert client.get("/indexnow-anything.txt").status_code == 404


def test_indexnow_key_file_serves_only_the_configured_key(client, monkeypatch):
    monkeypatch.setenv("INDEXNOW_KEY", "a1b2c3d4e5f6a7b8")

    served = client.get("/indexnow-a1b2c3d4e5f6a7b8.txt")
    assert served.status_code == 200
    assert served.text == "a1b2c3d4e5f6a7b8"

    # A guessed filename must not confirm that any key exists.
    assert client.get("/indexnow-deadbeef.txt").status_code == 404


def test_assets_are_not_given_a_robots_header(client):
    """The header belongs on documents; tagging every static file is noise."""
    response = client.get("/robots.txt")

    assert response.status_code == 200
    assert "x-robots-tag" not in response.headers


def test_favicon_is_served_at_the_root(client):
    """/favicon.ico returned a JSON 404 on prod, so every tab and search result
    showed a blank icon."""
    response = client.get("/favicon.ico")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/x-icon"
    assert response.content[:4] == b"\x00\x00\x01\x00"


@pytest.mark.parametrize("path", ["/", "/pricing.html", "/cloud-astrology-software", "/de/"])
def test_shared_links_get_a_preview_image(client, path):
    """Pages declared a large Twitter card with no image behind it."""
    html = client.get(path).text

    assert 'property="og:image" content="https://www.steliara.com/assets/brand/og-image.png"' in html
    assert 'name="twitter:image"' in html
    assert client.get("/assets/brand/og-image.png").status_code == 200
