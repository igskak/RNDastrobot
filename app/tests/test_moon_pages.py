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

    def comparable(locale):
        result = shape(CATALOGS[locale])
        result["site"].pop("alsoFree", None)  # only the English pages point at the English-only kundli tools
        return result

    english = comparable("en")
    for locale in LOCALES:
        assert comparable(locale) == english, locale


# --- one page per lunation until mid-2027 --------------------------------------------------

MANIFEST = json.loads((SRC.parent / "moon" / "lunation-pages.json").read_text(encoding="utf-8"))
LUNATION_PAGES = [(page["utc"], locale, path) for page in MANIFEST["pages"] for locale, path in page["paths"].items()]


def test_manifest_covers_every_lunation_until_the_middle_of_2027():
    lunations = json.loads((SRC / "lunations.json").read_text(encoding="utf-8"))["lunations"]
    expected = [lun["utc"] for lun in lunations if lun["utc"] < "2027-07-01"]
    assert MANIFEST["before"] == "2027-07-01"
    assert [page["utc"] for page in MANIFEST["pages"]] == expected and len(expected) == 16
    everything = [path for _, _, path in LUNATION_PAGES]
    assert len(set(everything)) == len(everything) == 16 * len(LOCALES)
    for _, locale, path in LUNATION_PAGES:
        assert path.startswith(INDEX[locale] + "/") and path == path.lower() and path.isascii(), path


@pytest.mark.parametrize("locale", LOCALES)
def test_lunation_pages_are_indexable_and_complete(client, locale):
    pages = [(utc, path) for utc, loc, path in LUNATION_PAGES if loc == locale]
    by_utc = {page["utc"]: page["paths"] for page in MANIFEST["pages"]}
    for utc, path in pages:
        response, facts = _facts(client, path)
        assert facts.lang == CATALOGS[locale]["lang"] and facts.h1 == 1, path
        assert 15 <= len(facts.title.strip()) <= 65, facts.title
        assert 70 <= len(facts.description) <= 170, (len(facts.description), facts.description)
        assert facts.canonical == "https://www.steliara.com" + path
        assert facts.words >= 250, f"{path}: only {facts.words} words"
        assert "noindex" not in response.headers.get("x-robots-tag", "")
        assert 'name="robots"' not in response.text
        group = by_utc[utc]
        assert facts.alternates["x-default"].endswith(group["en"])
        for loc in LOCALES:
            assert facts.alternates[CATALOGS[loc]["hreflang"]] == "https://www.steliara.com" + group[loc]
        for block in facts.ldjson:
            json.loads(block)
        assert client.get(path + "/").status_code == 200 and client.get(path + ".html").text == response.text
        # Twelve rising signs, a way back to the calculator and no link to the professional site.
        assert response.text.count("<tr><th scope=\"row\">") == 12
        assert INDEX[locale] + "#moon-form" in facts.links and INDEX[locale] in facts.links
        assert "/" not in facts.links and not any(link.startswith(("/pricing", "/cloud-", "/astro")) for link in facts.links)


def test_lunation_pages_link_to_their_neighbours_and_every_other_lunation(client):
    for page in MANIFEST["pages"]:
        for locale, path in page["paths"].items():
            links = set(_facts(client, path)[1].links)
            others = {other["paths"][locale] for other in MANIFEST["pages"] if other is not page}
            assert others <= links, (path, others - links)


def test_the_calculator_pages_link_to_the_lunation_pages(client):
    for locale in LOCALES:
        links = set(_facts(client, INDEX[locale])[1].links)
        assert {page["paths"][locale] for page in MANIFEST["pages"]} <= links, locale


def test_lunation_pages_are_in_the_sitemap_with_the_whole_language_set(client):
    body = client.get("/sitemap.xml").text
    for page in MANIFEST["pages"]:
        for locale, path in page["paths"].items():
            assert f"<loc>https://www.steliara.com{path}</loc>" in body, path
        entry = body.split(f"<loc>https://www.steliara.com{page['paths']['pl']}</loc>")[1].split("</url>")[0]
        assert entry.count("<xhtml:link") == len(LOCALES) + 1
        assert f'hreflang="pt-BR" href="https://www.steliara.com{page["paths"]["pt"]}"' in entry


def test_lunation_slugs_belong_to_their_own_language(client):
    first = MANIFEST["pages"][0]["paths"]
    assert client.get(first["pl"].replace("/pl/", "/de/")).status_code == 404
    assert client.get("/moon/pl/" + first["en"].rsplit("/", 1)[1]).status_code == 404
    assert client.get("/moon/new-moon-december-9-1999").status_code == 404
    assert client.get(first["en"] + "x").status_code == 404


def test_moon_and_kundli_pages_do_not_link_to_the_professional_site(client):
    paths = [INDEX[locale] for locale in LOCALES] + [LETTER[locale] for locale in LOCALES]
    paths += ["/kundli", "/kundli/hi", "/kundli/dasha-calculator"]
    for path in paths:
        assert "/" not in _facts(client, path)[1].links, path
    # The English pages of the two free-tool sets point at each other.
    assert "/kundli" in _facts(client, "/moon")[1].links
    assert "/moon" in _facts(client, "/kundli")[1].links
