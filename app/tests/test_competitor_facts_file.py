"""The file behind every claim a public page makes about a competitor.

Written after Solar Fire X turned out to ship natively on a Mac while six pages, the product
context and the backlog still said it did not (2026-10-28), and again on 2026-11-03 when the
first run of the source check showed Astrologer had published prices and auto-transcribed
sessions that two of our pages said it had not. Nothing here touches the network: the live
check is app/scripts/check_competitor_facts.py, which is deliberately not a test, so CI
never goes red because a vendor was down.
"""
import importlib.util
import re
from datetime import date
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
FRONTEND = REPO / "app" / "frontend"
FACTS_FILE = REPO / "docs" / "marketing" / "competitor-facts.json"
CHECKER = REPO / "app" / "scripts" / "check_competitor_facts.py"

REQUIRED_FIELDS = ("id", "competitor", "claim", "pages", "source", "phrase", "page_text", "checked")


def _load_checker():
    spec = importlib.util.spec_from_file_location("check_competitor_facts", CHECKER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = _load_checker()
FACTS = checker.load_facts(FACTS_FILE)


def _visible_text(page: str) -> str:
    source = (FRONTEND / page).read_text(encoding="utf-8")
    source = re.sub(r"<(script|style)\b.*?</\1>", " ", source, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", source)
    for entity, char in (("&nbsp;", " "), ("&amp;", "&"), ("&#39;", "'")):
        text = text.replace(entity, char)
    return re.sub(r"\s+", " ", text)


def test_the_file_is_not_empty_and_ids_are_unique():
    ids = [fact["id"] for fact in FACTS]
    assert len(ids) >= 20
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("fact", FACTS, ids=[fact["id"] for fact in FACTS])
def test_every_entry_has_its_fields(fact):
    for field in REQUIRED_FIELDS:
        assert fact.get(field), f"{fact['id']}: missing {field}"
    assert fact["source"].startswith("https://")
    assert isinstance(fact["pages"], list) and fact["pages"]
    date.fromisoformat(fact["checked"])


@pytest.mark.parametrize("fact", FACTS, ids=[fact["id"] for fact in FACTS])
def test_every_page_named_exists_and_carries_the_claim(fact):
    for page in fact["pages"]:
        assert (FRONTEND / page).is_file(), f"{fact['id']}: no such page {page}"
        assert fact["page_text"] in _visible_text(page), (
            f"{fact['id']}: {page} no longer says {fact['page_text']!r}. "
            "Either the page changed (update the entry) or the claim was dropped (remove the page)."
        )


def test_the_checker_ignores_inline_images_and_reads_the_text_around_them():
    blob = "data:image/png;base64," + "A" * 5000
    page = f'<html><body><img src="{blob}"><p>Solar Fire 9   is no\n longer sold.</p></body></html>'
    assert checker.phrase_held(page, "Solar Fire 9 is no longer sold")
    assert not checker.phrase_held(page, "native Mac app")


def test_the_checker_reads_prices_that_live_in_markup():
    page = '<td><b>$179.00</b><a href="/buy">Buy Now</a></td>'
    assert checker.phrase_held(page, "$179.00")


def test_a_failed_fetch_is_reported_and_never_a_pass(monkeypatch):
    def boom(url):
        raise OSError("vendor is down")

    monkeypatch.setattr(checker, "fetch", boom)
    results = checker.check([FACTS[0]])
    assert results[0]["status"] == "fetch failed"


def test_a_missing_phrase_gives_a_non_zero_exit(monkeypatch):
    monkeypatch.setattr(checker, "load_facts", lambda *args, **kwargs: [FACTS[0]])
    monkeypatch.setattr(checker, "fetch", lambda url: "<p>nothing relevant</p>")
    assert checker.main([]) == 1


def test_no_public_page_claims_to_be_the_only_product_that_records_sessions():
    """Astrologer lists auto-transcribed live sessions (read 2026-11-03), so "only" is false."""
    stale = (
        "Steliara is the one that does",
        "No competitor ships this",
        "no other tool records",
        "the only astrology software that records",
    )
    offenders = []
    for page in sorted(FRONTEND.rglob("*.html")):
        text = page.read_text(encoding="utf-8")
        offenders += [f"{page.relative_to(FRONTEND)}: {phrase}" for phrase in stale if phrase in text]
    assert not offenders, offenders
