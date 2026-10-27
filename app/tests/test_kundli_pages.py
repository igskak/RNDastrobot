"""The public kundli pages: routing, indexing, on-page SEO facts and the copy itself."""
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_kundli_pages_test.db")

from app.api import main as main_module  # noqa: E402
from app.api.main import app  # noqa: E402
from app.services import b2c_safety_policy as safety  # noqa: E402

FRONTEND = Path(__file__).resolve().parents[1] / "frontend"
CATALOGS = {loc: json.loads((FRONTEND / "kundli-src" / f"{loc}.json").read_text(encoding="utf-8")) for loc in ("en", "hi")}

INDEXABLE_EN = ["/kundli", "/kundli/dasha-calculator", "/kundli/sade-sati-calculator", "/kundli/kundli-matching"]
INDEXABLE_HI = ["/kundli/hi", "/kundli/hi/dasha-calculator", "/kundli/hi/sade-sati-calculator", "/kundli/hi/kundli-matching"]
PRIVATE = ["/kundli/report", "/kundli/thanks", "/kundli/hi/report", "/kundli/hi/thanks"]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


class Facts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.description = ""
        self.canonical = ""
        self.h1 = 0
        self.lang = ""
        self.alternates = {}
        self.ldjson = []
        self.links = []
        self.text = []
        self._in = None
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang", "")
        elif tag == "title":
            self._in = "title"
        elif tag == "meta" and a.get("name") == "description":
            self.description = a.get("content", "")
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href", "")
        elif tag == "link" and a.get("rel") == "alternate" and a.get("hreflang"):
            self.alternates[a["hreflang"]] = a["href"]
        elif tag == "h1":
            self.h1 += 1
        elif tag == "script":
            self._skip += 1
            self._in = "ld" if a.get("type") == "application/ld+json" else "script"
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])

    def handle_endtag(self, tag):
        if tag == "title":
            self._in = None
        elif tag == "script":
            self._skip -= 1
            self._in = None

    def handle_data(self, data):
        if self._in == "title":
            self.title += data
        elif self._in == "ld":
            self.ldjson.append(data)
        elif not self._skip:
            self.text.append(data)

    @property
    def words(self):
        return len(re.findall(r"\S+", " ".join(self.text)))


def _facts(client, path):
    response = client.get(path)
    assert response.status_code == 200, path
    parser = Facts()
    parser.feed(response.text)
    return response, parser


@pytest.mark.parametrize("path", INDEXABLE_EN + INDEXABLE_HI + PRIVATE)
def test_pages_are_served(client, path):
    response, facts = _facts(client, path)
    assert response.headers["content-type"].startswith("text/html")
    assert facts.lang == ("hi" if "/hi" in path else "en")
    assert facts.h1 == 1


@pytest.mark.parametrize("path", INDEXABLE_EN[1:] + INDEXABLE_HI[1:])
def test_html_spelling_serves_the_same_page(client, path):
    assert client.get(path + ".html").text == client.get(path).text


def test_unknown_kundli_page_is_a_404(client):
    assert client.get("/kundli/nonsense").status_code == 404
    assert client.get("/kundli/hi/nonsense").status_code == 404
    assert client.get("/kundli/../app.py").status_code in (404, 422)


@pytest.mark.parametrize("path", INDEXABLE_EN + INDEXABLE_HI)
def test_on_page_seo_facts(client, path):
    _, facts = _facts(client, path)
    assert 15 <= len(facts.title.strip()) <= 65, facts.title
    assert 70 <= len(facts.description) <= 165, (len(facts.description), facts.description)
    assert facts.canonical.startswith("https://www.steliara.com/kundli")
    assert facts.canonical == "https://www.steliara.com" + path
    assert facts.words >= 200, f"{path}: only {facts.words} words in the served HTML"
    for block in facts.ldjson:
        json.loads(block)
    assert set(facts.alternates) == {"en", "hi", "x-default"}


def test_hreflang_pairs_are_reciprocal(client):
    for en, hi in zip(INDEXABLE_EN, INDEXABLE_HI):
        _, en_facts = _facts(client, en)
        _, hi_facts = _facts(client, hi)
        assert en_facts.alternates["hi"].endswith(hi) and hi_facts.alternates["en"].endswith(en)
        assert en_facts.alternates == hi_facts.alternates


@pytest.mark.parametrize("path", PRIVATE)
def test_report_and_thanks_are_not_indexable(client, path):
    response, _ = _facts(client, path)
    assert "noindex" in response.headers.get("x-robots-tag", "")
    assert 'name="robots" content="noindex' in response.text


@pytest.mark.parametrize("path", INDEXABLE_EN)
def test_english_tool_pages_are_indexable(client, path):
    response, _ = _facts(client, path)
    assert "noindex" not in response.headers.get("x-robots-tag", "")


def test_hindi_pages_stay_noindexed_until_reviewed(client):
    # KUNDLI_REVIEWED_LOCALES is empty in the test environment, so Hindi is not advertised.
    assert "hi" not in main_module.kundli_reviewed_locales()
    for path in INDEXABLE_HI:
        response = client.get(path)
        assert "noindex" in response.headers.get("x-robots-tag", ""), path


def test_sitemap_lists_english_pages_and_holds_back_hindi(client):
    body = client.get("/sitemap.xml").text
    for path in INDEXABLE_EN:
        assert f"<loc>https://" in body and path + "</loc>" in body
    assert "/kundli/hi" not in body


def test_sitemap_adds_hindi_pairs_once_reviewed(monkeypatch):
    monkeypatch.setenv("KUNDLI_REVIEWED_LOCALES", "en,hi")
    pages = dict(main_module._kundli_sitemap_pages())
    assert set(INDEXABLE_EN + INDEXABLE_HI) == set(pages)


def test_internal_links_resolve(client):
    for path in INDEXABLE_EN + INDEXABLE_HI + PRIVATE:
        _, facts = _facts(client, path)
        for href in facts.links:
            if href.startswith("/kundli") or href in ("/", "/terms.html"):
                assert client.get(href.split("#")[0]).status_code == 200, (path, href)


def _strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for value in node.values():
            yield from _strings(value)
    elif isinstance(node, list):
        for value in node:
            yield from _strings(value)


@pytest.mark.parametrize("locale", ["en", "hi"])
def test_page_copy_obeys_the_safety_law(locale):
    """The words on these pages are held to the same filter as the reports."""
    for text in _strings(CATALOGS[locale]):
        assert safety.is_safe(text, locale), (locale, text, safety.find_violations(text, locale))


def test_catalogs_have_the_same_keys():
    def shape(node):
        if isinstance(node, dict):
            return {k: shape(v) for k, v in node.items()}
        if isinstance(node, list):
            return [shape(v) for v in node]
        return None

    assert shape(CATALOGS["en"]) == shape(CATALOGS["hi"])


def test_hindi_copy_is_hindi():
    for key in ("title", "description", "h1", "lead"):
        for slug, page in CATALOGS["hi"]["pages"].items():
            assert any("ऀ" <= ch <= "ॿ" for ch in page[key]), (slug, key)
