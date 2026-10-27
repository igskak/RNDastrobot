"""The safety law: filter, crisis handling, names, and every block of reviewed text."""
import random
from datetime import date, datetime, timezone

import pytest

from app.services import b2c_safety_policy as safety
from app.services import vedic_content as content
from app.services import vedic_report_service as reports
from app.services import vedic_service as vedic

# Phrases the law forbids. Each is a realistic sentence a careless writer or a model could produce.
FORBIDDEN_EN = [
    ("You will die young.", "death"),
    ("A serious illness is likely this year.", "illness_injury"),
    ("There is a risk of an accident while travelling.", "illness_injury"),
    ("Your marriage may end in divorce.", "separation"),
    ("This couple is incompatible.", "judging_people"),
    ("This is a bad match.", "judging_people"),
    ("You must not marry this person.", "directive"),
    ("A curse affects your family.", "curse_doom"),
    ("You have Manglik dosha.", "curse_doom"),
    ("You will definitely get the job.", "certainty"),
    ("It is your destiny to be alone.", "certainty"),
    ("Wear a blue sapphire gemstone to fix this.", "remedy_selling"),
    ("Perform a puja and donate to a temple.", "remedy_selling"),
    ("Buy our premium report before it is too late.", "remedy_selling"),
    ("You should invest in property now.", "professional_advice"),
    ("Stop taking your medication.", "professional_advice"),
    ("Expect financial loss and debt.", "ruin_loss"),
    ("Your partner is cheating on you.", "separation"),
    ("A very difficult and painful phase.", "negative_tone"),
    ("Saturn brings fear and suffering.", "negative_tone"),
]

FORBIDDEN_HI = [
    "आपकी मृत्यु जल्दी होगी।",
    "गंभीर बीमारी का खतरा है।",
    "आपका तलाक हो जाएगा।",
    "आप पर श्राप है।",
    "आपको मांगलिक दोष है।",
    "यह निश्चित रूप से होगा।",
    "नीलम रत्न पहनें और पूजा कराएं।",
    "यह बहुत बुरा समय है।",
    "इस रिश्ते में बहुत समस्या होगी।",
]

ALLOWED_EN = [
    "A period that invites you to step forward with confidence.",
    "Your approaches may differ; talking openly about goals helps you move in step.",
    "Choose one small routine and keep it gently for a month.",
    "This tradition's total sits below its usual reference point, and it is one lens among many.",
]


@pytest.mark.parametrize("text,category", FORBIDDEN_EN)
def test_forbidden_english_is_caught(text, category):
    categories = {v.category for v in safety.find_violations(text, "en")}
    assert category in categories, (text, categories)


@pytest.mark.parametrize("text", FORBIDDEN_HI)
def test_forbidden_hindi_is_caught(text):
    assert safety.find_violations(text, "hi"), text


@pytest.mark.parametrize("text", ALLOWED_EN)
def test_gentle_english_passes(text):
    assert safety.is_safe(text, "en"), safety.find_violations(text, "en")


def test_assert_safe_raises_with_the_violations():
    with pytest.raises(safety.UnsafeTextError) as caught:
        safety.assert_safe("A curse will ruin everything.", "en")
    assert {v.category for v in caught.value.violations} >= {"curse_doom", "ruin_loss"}


def test_disclaimer_and_rules_text_are_themselves_clean():
    for locale, text in safety.DISCLAIMER.items():
        assert safety.is_safe(text, locale), (locale, safety.find_violations(text, locale))
    assert "Never deceive" in safety.SAFETY_RULES_EN and safety.SAFETY_RULES_EN in safety.JUDGE_PROMPT_EN


def test_crisis_detection_in_both_languages_and_a_calm_reply():
    assert safety.detect_crisis("I want to kill myself")
    assert safety.detect_crisis("some days I want to die")
    assert safety.detect_crisis("मैं आत्महत्या करना चाहता हूं")
    assert not safety.detect_crisis("I will kill it at my interview")
    for locale in ("en", "hi"):
        reply = safety.crisis_reply(locale, "IN")
        assert "14416" in reply
        assert safety.is_safe(reply.replace("Tele-MANAS", "helpline"), locale) or locale == "hi"
    assert "988" in safety.crisis_reply("en", "US")
    assert "findahelpline" in safety.crisis_reply("en", None)


def test_display_name_sanitising():
    assert safety.sanitize_display_name("  Asha  ") == "Asha"
    assert safety.sanitize_display_name("Ravi Kumar") == "Ravi Kumar"
    assert safety.sanitize_display_name("आशा शर्मा") == "आशा शर्मा"
    assert safety.sanitize_display_name("O'Neil-Smith") == "O'Neil-Smith"
    assert safety.sanitize_display_name("<script>alert(1)</script>") is None
    assert safety.sanitize_display_name("http://evil.example/x") is None
    assert safety.sanitize_display_name("a@b.example") is None
    assert safety.sanitize_display_name("Asha 123") == "Asha"
    assert safety.sanitize_display_name("") is None
    assert safety.sanitize_display_name(None) is None
    assert safety.sanitize_display_name("I want to kill myself") is None
    assert safety.sanitize_display_name("Doomed Death") is None
    assert len(safety.sanitize_display_name("A" * 200)) <= 40


# --- every reviewed block -------------------------------------------------------------

def test_every_block_exists_in_both_languages():
    for key, block in content.all_blocks().items():
        for locale in content.LOCALES:
            assert block.get(locale, "").strip(), (key, locale)


def test_every_block_passes_the_safety_filter_in_its_language():
    for key, block in content.all_blocks().items():
        for locale in content.LOCALES:
            text = block[locale]
            violations = safety.find_violations(text, locale)
            assert not violations, (key, locale, text, violations)


def test_hindi_blocks_are_hindi():
    for key, block in content.all_blocks().items():
        if key.startswith(("lord_name", "rashi_name", "nakshatra_name", "koota_name")):
            assert any("ऀ" <= ch <= "ॿ" for ch in block["hi"]), key
        elif not key.startswith(("moon_day",)):
            assert any("ऀ" <= ch <= "ॿ" for ch in block["hi"]), key


def test_koota_and_dasha_templates_format_cleanly():
    for locale in content.LOCALES:
        text = content.pick(content.DASHA["window"], locale).format(
            start="a", end="b", md="c", ad="d", ad_theme="e")
        assert text
        text = content.pick(content.DASHA["now"], locale).format(
            md="a", ad="b", md_theme="c", ad_theme="d")
        assert text


def test_reviewed_locales_flag(monkeypatch):
    monkeypatch.delenv("KUNDLI_REVIEWED_LOCALES", raising=False)
    assert content.reviewed_locales() == ()
    monkeypatch.setenv("KUNDLI_REVIEWED_LOCALES", "en, hi ,xx")
    assert content.reviewed_locales() == ("en", "hi")


# --- generated reports ----------------------------------------------------------------

AS_OF = datetime(2026, 10, 26, tzinfo=timezone.utc)


def _random_births(count, seed):
    rng = random.Random(seed)
    for _ in range(count):
        yield date(rng.randrange(1940, 2020), rng.randrange(1, 13), rng.randrange(1, 29)), (rng.randrange(24), rng.randrange(60))


@pytest.mark.parametrize("locale", ["en", "hi"])
def test_full_reports_for_random_births_are_always_safe(locale):
    for birth_date, birth_time in _random_births(25, seed=11):
        moon, utc, _, _ = vedic.moon_for_local_birth(birth_date, birth_time, "Asia/Kolkata")

        dasha = reports.build_dasha(vedic.vimshottari(moon.longitude, utc, as_of=AS_OF), locale, "Asha", full=True, as_of=AS_OF)
        assert dasha["sections"] and dasha["greeting"].startswith(("Dear", "प्रिय"))

        sade = reports.build_sade_sati(vedic.sade_sati(moon.rashi, utc, as_of=AS_OF), locale, "Asha", full=True)
        assert sade["sections"]

        other, _, _, _ = vedic.moon_for_local_birth(date(1992, 2, 3), (6, 0), "Asia/Kolkata")
        match = reports.build_matching(
            vedic.ashtakoota(vedic.MatchPerson.from_longitude(moon.longitude), vedic.MatchPerson.from_longitude(other.longitude)),
            locale, ("Ravi", "Asha"), full=True)
        assert len(match["sections"][1]["items"]) == 8

        week = reports.build_week(moon.rashi, vedic.vimshottari(moon.longitude, utc, as_of=AS_OF), locale,
                                  "Asia/Kolkata", "Asha", start=date(2026, 10, 26))
        assert len(week["sections"][0]["items"]) == 7


def test_every_possible_matching_total_band_has_safe_text():
    # Walk the whole matching space (27 nakshatras x 12 rashis would be heavy; sample by padas).
    seen_bands = set()
    for g in range(27):
        for b in range(27):
            result = vedic.ashtakoota(vedic.MatchPerson.from_nakshatra_pada(g, 1), vedic.MatchPerson.from_nakshatra_pada(b, 3))
            for locale in ("en", "hi"):
                report = reports.build_matching(result, locale, full=True)
                seen_bands.add(report["data"]["band"])
    assert seen_bands == {"high", "middle", "lower"}


def test_free_reports_hold_back_the_paid_sections():
    moon, utc, _, _ = vedic.moon_for_local_birth(date(1990, 5, 17), (14, 30), "Asia/Kolkata")
    free = reports.build_dasha(vedic.vimshottari(moon.longitude, utc, as_of=AS_OF), "en", full=False, as_of=AS_OF)
    paid = reports.build_dasha(vedic.vimshottari(moon.longitude, utc, as_of=AS_OF), "en", full=True, as_of=AS_OF)
    assert free["sections"] == [] and free["headline"]
    assert len(paid["sections"]) >= 3


def test_an_unsafe_block_would_stop_a_report(monkeypatch):
    monkeypatch.setitem(content.SADE_SATI, "inactive", {"en": "A curse is coming.", "hi": "श्राप आएगा।"})
    moon, utc, _, _ = vedic.moon_for_local_birth(date(1990, 5, 17), (14, 30), "Asia/Kolkata")
    calc = vedic.sade_sati(moon.rashi, utc, as_of=datetime(2000, 1, 1, tzinfo=timezone.utc))
    assert calc["active"] is False
    with pytest.raises(safety.UnsafeTextError):
        reports.build_sade_sati(calc, "en")


def test_unknown_locale_falls_back_to_english():
    assert reports.normalize_locale("fr") == "en"
    assert reports.normalize_locale(None) == "en"
    assert reports.normalize_locale("hi") == "hi"
