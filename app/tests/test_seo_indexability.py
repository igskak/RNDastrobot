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
    "/record-astrology-consultations",
    "/record-astrology-consultations.html",
    "/astrologer-workspace",
    "/astrologer-workspace.html",
    "/cloud-astrology-software",
    "/cloud-astrology-software.html",
    "/solar-fire-alternative",
    "/solar-fire-alternative.html",
    "/astroprocessor",
    "/astroprocessor.html",
    "/astroprocessor-uk",
    "/astroprocessor-uk.html",


    "/zet-online",
    "/zet-online.html",
    "/zet-online-uk",
    "/zet-online-uk.html",
    "/answers/what-software-do-professional-astrologers-use",
    "/answers/what-software-do-professional-astrologers-use.html",
    "/answers/best-astrology-software-for-professional-practice",
    "/answers/best-astrology-software-for-professional-practice.html",
    "/answers/how-astrologers-keep-client-notes",
    "/answers/how-astrologers-keep-client-notes.html",
    "/answers/best-astrology-software-for-mac",
    "/answers/best-astrology-software-for-mac.html",
]

# The answer pages exist to be quoted by an AI engine, so the properties that make them
# quotable are the ones worth pinning: a self-contained answer in the first 40 words, a
# visible review date, and competitors named by name.
ANSWER_PATHS = [path for path in PUBLIC_PATHS if path.startswith("/answers/") and not path.endswith(".html")]

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


@pytest.mark.parametrize("path", PUBLIC_PATHS)
def test_structured_data_parses(client, path):
    """A JSON-LD block with a stray comma is skipped in silence by search engines.

    The audit script counts the blocks on a page but cannot tell a valid one from a
    broken one, so a typo in a hand-written FAQPage would ship looking healthy.
    """
    import json
    import re

    blocks = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>',
        client.get(path).text,
        re.S,
    )

    for block in blocks:
        payload = json.loads(block)  # raises on malformed markup
        assert payload.get("@type"), f"{path}: JSON-LD block without an @type"


def test_the_astroprocessor_pair_links_both_ways(client):
    """The Russian and Ukrainian guides are a translated set with no English twin.

    seo_audit.py checks reciprocity only when both URLs come back from the same
    origin, so auditing localhost against production canonicals skips this pair
    entirely. Without reciprocal hreflang search engines read the two as duplicates
    competing with each other.
    """
    pair = {
        "/astroprocessor": ("ru", "/astroprocessor-uk", "uk"),
        "/astroprocessor-uk": ("uk", "/astroprocessor", "ru"),
    }
    for path, (own_lang, other_path, other_lang) in pair.items():
        html = client.get(path).text

        assert f'<html lang="{own_lang}">' in html, path
        for lang, target in ((own_lang, path), (other_lang, other_path)):
            link = f'<link rel="alternate" hreflang="{lang}" href="https://www.steliara.com{target}">'
            assert link in html, f"{path} is missing {link}"
        # No hreflang to an English page: there is no English version of this guide.
        assert 'hreflang="en"' not in html, path


def test_the_cloud_page_keeps_the_depth_it_was_rebuilt_for(client):
    """/cloud-astrology-software was 511 words and sat at position 7.9 for its head term.

    It was rebuilt on 2026-10-02 to beat lunaastrology.com, which holds the top two
    slots, and the backlog set 900 words as the floor. The audit script only refuses a
    page under 200, so nothing else would notice this page quietly sliding back to a
    bullet list.
    """
    import re

    html = client.get("/cloud-astrology-software").text
    body = html[html.find("<body") :]
    text = re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style|svg)\b.*?</\1>", " ", body))

    assert len(text.split()) >= 900
    # The comparison table is the point of the rebuild; a bullet list is what lost.
    assert '<table class="compare">' in html


# Titles and descriptions rewritten on 2026-10-28 for pages that sat at positions 5 to 6
# with 54 impressions and no clicks (backlog item ctr-title-meta-pass). Held here so a
# later edit cannot quietly put the generic wording back or push a title past the point
# where search engines cut it.
CTR_PAGES = {
    "/record-astrology-consultations": "Astrology Software That Records & Summarizes Sessions | Steliara",
    "/astrology-practice-management": "Astrology Practice Management Software for Astrologers | Steliara",
    "/astrologer-workspace": "Astrologer Workspace for Charts, People and Sessions | Steliara",
}


@pytest.mark.parametrize("path,title", sorted(CTR_PAGES.items()))
def test_the_ctr_pages_keep_their_rewritten_snippets(client, path, title):
    import html as htmllib
    import re

    page = client.get(path).text
    page_title = htmllib.unescape(re.search(r"<title>(.*?)</title>", page).group(1))
    description = htmllib.unescape(re.search(r'name="description" content="(.*?)"', page).group(1))

    assert page_title == title
    assert 15 <= len(page_title) <= 65
    assert 70 <= len(description) <= 165
    assert "\u2014" not in page_title + description  # house voice: no em dashes in English
    og_title = htmllib.unescape(re.search(r'property="og:title" content="(.*?)"', page).group(1))
    assert og_title == page_title


# Pages that exist to be found. Each needs at least two inbound links from other indexable
# pages, or search engines take months to discover it (backlog item
# internal-links-to-new-pages). Language twins link each other by design, so they count.
LINK_TARGETS = [
    "/astroprocessor",
    "/astroprocessor-uk",
    "/zet-online",
    "/zet-online-uk",
    "/solar-fire-alternative",
    "/answers/what-software-do-professional-astrologers-use",
    "/answers/best-astrology-software-for-professional-practice",
    "/answers/how-astrologers-keep-client-notes",
    "/answers/best-astrology-software-for-mac",
]


def _internal_links(client, path):
    import re

    html = client.get(path).text
    body = html[html.find("<body") :]
    return {m.group(1).rstrip("/").removesuffix(".html") for m in re.finditer(r'href="(/[^"#?]*)', body)}


@pytest.mark.parametrize("target", LINK_TARGETS)
def test_new_pages_have_inbound_links(client, target):
    sources = [p for p in PUBLIC_PATHS if not p.endswith(".html") and p != "/" and p != target]
    sources += ["/", "/pricing.html"]
    inbound = [src for src in sources if target in _internal_links(client, src)]

    assert len(inbound) >= 2, f"{target} is linked from {inbound}"


def test_the_notes_answer_is_linked_from_a_page_that_already_ranks(client):
    """/answers/how-astrologers-keep-client-notes was linked only from pages with no clicks.
    /cloud-astrology-software is off limits (it is the one page that converts), so the link
    comes from the practice-management page, which holds position 5."""
    target = "/answers/how-astrologers-keep-client-notes"

    assert target in _internal_links(client, "/astrology-practice-management")


def test_the_mac_answer_keeps_the_depth_and_the_solar_fire_x_fact(client):
    """The backlog set 900 words as the floor for /answers/best-astrology-software-for-mac.

    It also pins the fact that made the page worth rewriting on 2026-10-28: Solar Fire X is
    a native Mac app. Earlier pages said Solar Fire had no Mac version, which stopped being
    true, so this one must never say it again.
    """
    import re

    html = client.get("/answers/best-astrology-software-for-mac").text
    body = html[html.find("<body") :]
    text = re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style|svg)\b.*?</\1>", " ", body))

    assert len(text.split()) >= 900
    assert "Solar Fire X" in text and "native Mac" in text
    assert "no Mac version" not in text


# Solar Fire X shipped as a native Mac app (macOS 14+, US$360) and Solar Fire 9 stopped being
# sold. Several pages said "Solar Fire has no Mac version" until 2026-10-28. A competitor
# claim that goes stale is worse than none (agent brief, writing rules), so the phrases that
# made it are held out of every public page.
STALE_SOLAR_FIRE_PHRASES = [
    "Solar Fire has no Mac version",
    "no Mac version",
    "Solar Fire is Windows only",
    "does not officially support it on the Mac",
    "Solar Fire is the one to rule out",
    "Solar Fire V9",
    "Windows-only Solar Fire",
]


@pytest.mark.parametrize("path", sorted({p for p in PUBLIC_PATHS if not p.endswith(".html")}))
def test_no_page_says_solar_fire_has_no_mac_version(client, path):
    html = client.get(path).text

    for phrase in STALE_SOLAR_FIRE_PHRASES:
        assert phrase not in html, f"{path} still says: {phrase}"


PRICING_PATHS = ["/pricing.html"] + [f"/{locale}/pricing.html" for locale in sorted(PREFIXED_LOCALES)]


@pytest.mark.parametrize("path", PRICING_PATHS)
def test_the_pricing_page_names_the_price_and_declares_the_live_plans(client, path):
    """The pricing pages carried an 18-character title and no JSON-LD at all.

    An answer engine quotes the price it can read off a page, so the four amounts the
    billing toggle shows exist as structured offers in every language, each saying how
    many months it buys. Nothing else here would notice a plan price changing in the
    markup and not in the schema, or the title sliding back to just the word "Pricing".
    """
    import json
    import re

    html = client.get(path).text

    title = re.search(r"<title[^>]*>(.*?)</title>", html, re.S).group(1)
    # 15-65 is the window seo_audit.py warns outside of.
    assert 15 <= len(title) <= 65, f"{path}: title is {len(title)} chars"
    assert "$24" in title and "$39" in title, f"{path}: title hides the price point: {title}"

    products = [
        payload
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        for payload in (json.loads(block),)
        if payload.get("@type") == "Product"
    ]
    assert len(products) == 1, f"{path}: expected exactly one Product block, found {len(products)}"
    offers = products[0]["offers"]

    assert {
        (offer["name"], offer["price"], offer["priceSpecification"]["billingDuration"])
        for offer in offers
    } == {
        ("Practitioner", "24", 1),
        ("Practitioner", "20", 12),
        ("Studio", "39", 1),
        ("Studio", "32", 12),
    }, f"{path}: offers no longer match the plans on the page"

    for offer in offers:
        assert offer["priceCurrency"] == "USD", path
        # The offer must lead to the page the visitor is on, not to the English one.
        assert offer["url"] == f"https://www.steliara.com{path}", f"{path}: offer at {offer['url']}"


@pytest.mark.parametrize("path", ANSWER_PATHS)
def test_an_answer_page_answers_in_the_first_forty_words(client, path):
    """An engine lifts one passage, not a page. If the answer is not self-contained and
    up front, the page is a landing page wearing a question as a headline.

    40 words is the budget the backlog item set. The check allows a little slack for
    punctuation splitting oddly, and fails on a paragraph that has turned into a section.
    """
    import re

    html = client.get(path).text
    answer = re.search(r'<div class="answer">\s*<p>(.*?)</p>', html, re.S)

    assert answer, f"{path}: no .answer block leading the page"
    words = re.sub(r"<[^>]+>", " ", answer.group(1)).split()
    assert len(words) <= 45, f"{path}: the answer runs to {len(words)} words"


@pytest.mark.parametrize("path", ANSWER_PATHS)
def test_an_answer_page_is_dated_and_names_the_alternatives(client, path):
    """Engines weight recency, and an answer naming one product gets cited by nobody.

    Both of those are the backlog item's acceptance criteria rather than nice-to-haves,
    and neither the audit script nor the word-count floor would notice either going.
    """
    import re

    html = client.get(path).text
    body = html[html.find("<body") :]
    text = re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style|svg)\b.*?</\1>", " ", body))

    assert "Last reviewed" in text, f"{path}: no review date"
    assert len(text.split()) >= 400, f"{path}: {len(text.split())} words, floor is 400"
    # Named alternatives, not "other tools". Two is the minimum that reads as a comparison.
    named = [brand for brand in ("Solar Fire", "Astro Gold", "TimePassages", "Astrolium", "Chronos")
             if brand in text]
    assert len(named) >= 2, f"{path}: names only {named}"


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
