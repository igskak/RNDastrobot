"""The public moon pages: routing, indexing, hreflang, on-page SEO facts and the copy."""
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_moon_pages_test.db")

from app.api.main import app  # noqa: E402
from app.services import b2c_safety_policy as safety  # noqa: E402
from app.services.moon_journal_service import LOCALES  # noqa: E402
from app.tests.test_kundli_pages import Facts  # noqa: E402

SRC = Path(__file__).resolve().parents[1] / "frontend" / "moon-src"
CATALOGS = {loc: json.loads((SRC / f"{loc}.json").read_text(encoding="utf-8")) for loc in LOCALES}
INDEX = {loc: "/moon" if loc == "en" else f"/moon/{loc}" for loc in LOCALES}
LETTER = {loc: f"{INDEX[loc]}/letter" for loc in LOCALES}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def _facts(client, path):
    response = client.get(path)
    assert response.status_code == 200, path
    parser = Facts()
    parser.feed(response.text)
    return response, parser


@pytest.mark.parametrize("locale", LOCALES)
def test_calculator_pages(client, locale):
    path = INDEX[locale]
    response, facts = _facts(client, path)
    assert facts.lang == CATALOGS[locale]["lang"] and facts.h1 == 1
    assert 15 <= len(facts.title.strip()) <= 65, facts.title
    assert 70 <= len(facts.description) <= 170, (len(facts.description), facts.description)
    assert facts.canonical == "https://www.steliara.com" + path
    assert facts.words >= 300, f"{path}: only {facts.words} words"
    assert "noindex" not in response.headers.get("x-robots-tag", "")
    assert len(facts.alternates) == len(LOCALES) + 1 and facts.alternates["pt-BR"].endswith("/moon/pt")
    for block in facts.ldjson:
        json.loads(block)
    assert client.get(path + "/").status_code == 200


@pytest.mark.parametrize("locale", LOCALES)
def test_letter_pages_are_private(client, locale):
    response, facts = _facts(client, LETTER[locale])
    assert "noindex" in response.headers.get("x-robots-tag", "")
    assert 'name="robots" content="noindex' in response.text
    assert facts.alternates == {}
    assert client.get(LETTER[locale] + ".html").text == response.text


def test_unknown_moon_pages_are_404(client):
    for path in ("/moon/en", "/moon/xx", "/moon/nonsense", "/moon/pl/nonsense", "/moon/en/letter", "/moon/xx/letter"):
        assert client.get(path).status_code == 404, path


def test_sitemap_lists_every_language_with_the_whole_hreflang_set(client):
    body = client.get("/sitemap.xml").text
    for path in INDEX.values():
        assert f"{path}</loc>" in body
    assert "/letter" not in body
    assert 'hreflang="pt-BR"' in body and body.count('hreflang="pl" href="https://') >= len(LOCALES)


def test_english_copy_obeys_the_safety_law():
    def strings(node):
        if isinstance(node, str):
            yield node
        elif isinstance(node, dict):
            for value in node.values():
                yield from strings(value)
        elif isinstance(node, list):
            for value in node:
                yield from strings(value)

    for text in strings(CATALOGS["en"]):
        assert safety.is_safe(text, "en"), (text, safety.find_violations(text, "en"))


def test_catalogs_have_the_same_keys():
    def shape(node):
        if isinstance(node, dict):
            return {k: shape(v) for k, v in node.items()}
        if isinstance(node, list):
            return [shape(v) for v in node]
        return None

    english = shape(CATALOGS["en"])
    for locale in LOCALES:
        assert shape(CATALOGS[locale]) == english, locale
