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


PRO_PAGE_PREFIXES = ("/pricing", "/cloud-", "/astro", "/record-", "/solar-fire", "/answers", "/zet-")


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
        result["tools"].pop("dataLink", None)  # the data page exists in English only
        result.pop("data", None)
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
        assert not any(link.startswith(PRO_PAGE_PREFIXES) for link in facts.links)


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


def test_moon_and_kundli_pages_reach_the_home_page_only_through_one_visible_footer_credit(client):
    """The free pages stay apart from the professional ones: nothing in the body or the nav points
    there. The single link is a plain, visible "Steliara" credit in the footer (never hidden)."""
    paths = [INDEX[locale] for locale in LOCALES] + [LETTER[locale] for locale in LOCALES]
    paths += ["/kundli", "/kundli/hi", "/kundli/dasha-calculator"]
    for path in paths:
        response, facts = _facts(client, path)
        assert facts.links.count("/") == 1, path
        assert not any(link.startswith(PRO_PAGE_PREFIXES) for link in facts.links), path
        footer = response.text.split("<footer", 1)[1]
        assert '<a href="/">Steliara</a>' in footer, path
        assert "display:none" not in response.text.replace(" ", "").lower().split("<footer", 1)[1], path
    # The English pages of the two free-tool sets point at each other.
    assert "/kundli" in _facts(client, "/moon")[1].links
    assert "/moon" in _facts(client, "/kundli")[1].links


@pytest.mark.parametrize("locale", LOCALES)
def test_every_lunation_page_hooks_the_visitor_to_the_hub_right_after_the_facts(client, locale):
    """The visitor came for the date. Right after the facts they see why the calendar is worth a
    click, and the link goes to that language's hub (a plain visible link, no tracking tricks)."""
    for _, loc, path in LUNATION_PAGES:
        if loc != locale:
            continue
        html = client.get(path).text
        hook = html.index('class="card hook"')
        assert html.index('id="facts-title"') < hook < html.index('id="theme-title"'), path
        block = html[hook : html.index("</section>", hook)]
        assert f'<a class="hook-link" href="{INDEX[locale]}">' in block, path
        assert CATALOGS[locale]["lunationPage"]["hookTitle"].split(" ")[0] in block, path


@pytest.mark.parametrize("locale", LOCALES)
def test_the_hub_opens_with_a_line_that_asks_for_the_action_it_wants(client, locale):
    html = client.get(INDEX[locale]).text
    line = CATALOGS[locale]["pages"]["index"]["formHook"]
    assert line.split(":")[0] in html and html.index('class="form-hook"') < html.index('id="moon-form"')


# --- free assets: calendar feed, data page, printable planner -------------------------------------

LUNATIONS = json.loads((SRC / "lunations.json").read_text(encoding="utf-8"))["lunations"]
ICS = {loc: f"{INDEX[loc]}/lunations.ics" for loc in LOCALES}


@pytest.mark.parametrize("locale", LOCALES)
def test_calendar_feed_is_valid_and_complete(client, locale):
    response = client.get(ICS[locale])
    assert response.status_code == 200 and response.headers["content-type"].startswith("text/calendar")
    text = response.content.decode("utf-8")
    assert text.startswith("BEGIN:VCALENDAR\r\n") and text.endswith("END:VCALENDAR\r\n")
    assert text.count("BEGIN:VEVENT") == text.count("END:VEVENT") == len(LUNATIONS)
    assert all(len(line.encode("utf-8")) <= 75 for line in text.split("\r\n"))
    uids = [line for line in text.split("\r\n") if line.startswith("UID:")]
    assert len(set(uids)) == len(LUNATIONS)
    first = LUNATIONS[0]["utc"].replace("-", "").replace(":", "")
    assert f"DTSTART:{first}" in text
    assert "/moon" in text and "https://www.steliara.com" in text


def test_data_downloads_match_the_lunation_table(client):
    rows = client.get("/moon/lunations.csv")
    assert rows.status_code == 200 and rows.headers["content-type"].startswith("text/csv")
    lines = rows.text.strip().split("\n")
    assert lines[0] == "utc,phase,longitude,sign,degree" and len(lines) == len(LUNATIONS) + 1
    assert lines[1].startswith(LUNATIONS[0]["utc"] + ",new_moon,")
    data = client.get("/moon/lunations.json").json()
    assert len(data["lunations"]) == len(LUNATIONS) and data["lunations"][0]["utc"] == LUNATIONS[0]["utc"]
    assert all(0 <= row["longitude"] < 360 for row in data["lunations"])
    for locale in LOCALES:
        if locale != "en":
            assert client.get(f"{INDEX[locale]}/lunations.csv").status_code == 404


def test_data_page_is_indexable_english_only_and_lists_every_lunation(client):
    response, facts = _facts(client, "/moon/data")
    assert facts.canonical == "https://www.steliara.com/moon/data" and facts.h1 == 1
    assert 15 <= len(facts.title.strip()) <= 70 and 70 <= len(facts.description) <= 170
    assert "noindex" not in response.headers.get("x-robots-tag", "")
    assert response.text.count("<time datetime=") == len(LUNATIONS)
    assert {"/moon/lunations.csv", "/moon/lunations.json", "/moon/lunations.ics"} <= set(facts.links)
    assert any(json.loads(block).get("@type") == "Dataset" for block in facts.ldjson)
    assert client.get("/moon/pl/data").status_code == 404
    assert "/moon/data" in client.get("/sitemap.xml").text


@pytest.mark.parametrize("locale", LOCALES)
def test_planner_pages_cover_2027_and_form_one_hreflang_set(client, locale):
    path = f"{INDEX[locale]}/planner"
    response, facts = _facts(client, path)
    assert facts.lang == CATALOGS[locale]["lang"] and facts.h1 == 1
    assert 15 <= len(facts.title.strip()) <= 70 and 70 <= len(facts.description) <= 170, (facts.title, len(facts.description))
    assert facts.canonical == "https://www.steliara.com" + path
    assert len(facts.alternates) == len(LOCALES) + 1 and facts.alternates["pt-BR"].endswith("/moon/pt/planner")
    in_2027 = [lun for lun in LUNATIONS if lun["utc"].startswith("2027")]
    assert response.text.count('class="planner-item"') == len(in_2027)
    assert f"{INDEX[locale]}#moon-form" in facts.links and f"{INDEX[locale]}/lunations.ics" not in facts.links
    assert f"webcal://www.steliara.com{ICS[locale]}" in response.text
    assert f"<loc>https://www.steliara.com{path}</loc>" in client.get("/sitemap.xml").text


@pytest.mark.parametrize("locale", LOCALES)
def test_the_hub_offers_the_calendar_and_the_planner(client, locale):
    html = client.get(INDEX[locale]).text
    assert f'href="{ICS[locale]}" download' in html and f'href="{INDEX[locale]}/planner"' in html
    assert ('href="/moon/data"' in html) == (locale == "en")
