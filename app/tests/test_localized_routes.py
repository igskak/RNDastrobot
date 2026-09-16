"""Routing contract for the locale-prefixed public pages (/de/, /ru/, /uk/)."""
import os

import pytest
from fastapi.testclient import TestClient

# Prevent connection bootstrap failures in test env.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_localized_routes_test.db")

from app.api.main import PREFIXED_LOCALES, app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_every_prefixed_locale_serves_its_own_landing_page(client):
    assert set(PREFIXED_LOCALES) == {"de", "ru", "uk"}

    for locale in PREFIXED_LOCALES:
        response = client.get(f"/{locale}/")

        assert response.status_code == 200, locale
        assert f'<html lang="{locale}">' in response.text, locale
        assert f'rel="canonical" href="https://www.steliara.com/{locale}/"' in response.text, locale


def test_german_landing_page_is_actually_german(client):
    response = client.get("/de/")

    assert "Astrologiesoftware" in response.text
    assert "Astrology Software for Your Whole Practice" not in response.text


def test_localized_page_without_trailing_slash_redirects_once(client):
    response = client.get("/de", follow_redirects=False)

    assert response.status_code == 308
    assert response.headers["location"] == "/de/"


def test_localized_documents_are_never_cached(client):
    response = client.get("/de/pricing.html")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store, max-age=0"


@pytest.mark.parametrize(
    "path",
    [
        "/fr/",
        "/fr/pricing.html",
        "/de/clients.html",
        "/de/does-not-exist.html",
        "/de/nested/page.html",
        "/de/index",
    ],
)
def test_unknown_locales_and_pages_404_instead_of_falling_back_to_english(client, path):
    assert client.get(path).status_code == 404


def test_page_name_cannot_escape_the_locale_directory(client):
    response = client.get("/de/..%2f..%2fapi%2fmain.py")

    assert response.status_code == 404


def test_legacy_lang_query_redirects_to_the_prefixed_url(client):
    response = client.get("/pricing.html?lang=de", follow_redirects=False)

    assert response.status_code == 301
    assert response.headers["location"] == "/de/pricing.html"


def test_legacy_redirect_keeps_ad_tracking_and_mode_parameters(client):
    response = client.get(
        "/login.html?mode=register&lang=de&gclid=abc123&utm_source=google",
        follow_redirects=False,
    )

    assert response.status_code == 301
    location = response.headers["location"]
    assert location.startswith("/de/login.html?")
    assert "mode=register" in location
    assert "gclid=abc123" in location
    assert "utm_source=google" in location
    assert "lang=" not in location


def test_english_pages_keep_their_bare_urls(client):
    assert client.get("/pricing.html?lang=en", follow_redirects=False).status_code == 200

    root = client.get("/")
    assert root.status_code == 200
    assert '<html lang="en">' in root.text


def test_solo_hostname_stays_out_of_localized_commercial_pages(client, monkeypatch):
    monkeypatch.setenv("SOLO_REGISTRATION_HOSTS", "testserver")

    response = client.get("/de/pricing.html", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/"


def test_signed_in_visitor_on_a_localized_landing_page_gets_the_workspace(client):
    client.cookies.set("astrobot_session", "whatever")
    response = client.get("/de/")

    assert response.status_code == 200
    assert "clients-page" in response.text


def test_sitemap_lists_every_translation_with_reciprocal_hreflang(client):
    body = client.get("/sitemap.xml").text

    for locale in PREFIXED_LOCALES:
        assert f"<loc>https://www.steliara.com/{locale}/</loc>" in body
        assert f"<loc>https://www.steliara.com/{locale}/pricing.html</loc>" in body
        assert f'hreflang="{locale}" href="https://www.steliara.com/{locale}/"' in body

    assert 'hreflang="x-default" href="https://www.steliara.com/"' in body
    assert 'xmlns:xhtml="http://www.w3.org/1999/xhtml"' in body


def test_sitemap_leaves_untranslated_pages_alone(client):
    body = client.get("/sitemap.xml").text

    assert "<loc>https://www.steliara.com/astrologer-workspace</loc>" in body
    # The conquest pages carry no data-i18n markup, so claiming a German version would
    # point search engines at an English page.
    assert "/de/astrologer-workspace" not in body


def test_sitemap_does_not_advertise_the_login_page(client):
    assert "login.html" not in client.get("/sitemap.xml").text
