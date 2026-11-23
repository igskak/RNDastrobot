"""Localized, deterministic assistant reply fragments."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from app.i18n.locale import DEFAULT_LOCALE, normalize_locale


@lru_cache(maxsize=1)
def _catalog():
    path = Path(__file__).resolve().parent.parent / "i18n" / "catalogs" / "assistant.json"
    return json.loads(path.read_text(encoding="utf-8"))


def reply_text(locale):
    return _catalog()[normalize_locale(locale) or DEFAULT_LOCALE]



@lru_cache(maxsize=4)
def _astro_labels(locale):
    path = Path(__file__).resolve().parent.parent / "frontend" / "locales" / f"{locale}.json"
    return json.loads(path.read_text(encoding="utf-8"))["astro"]


def render_natal_positions(tool_results, locale):
    """Render all returned positions independently of the model's summary."""
    result = next(
        (item["result"] for item in tool_results
         if item.get("name") == "get_chart_data"
         and item.get("result", {}).get("facet") == "natal_positions"
         and item["result"].get("status") == "ok"),
        {},
    )
    planets = result.get("data", {}).get("planets") or []
    if not planets:
        return ""

    locale = normalize_locale(locale) or DEFAULT_LOCALE
    copy = reply_text(locale)
    labels = _astro_labels(locale)
    lines = [f"**{copy['natal_positions']}**"]
    for planet in planets:
        name = labels["planet"].get(planet["name"], planet["name"])
        if planet.get("retrograde"):
            name += " R"
        sign = labels["sign"].get(planet.get("sign"), planet.get("sign"))
        position = " ".join(part for part in (sign, planet.get("degree")) if part)
        house = planet.get("house")
        house_text = copy["natal_house"].format(number=house) if house is not None else ""
        details = ", ".join(part for part in (position, house_text) if part)
        lines.append(f"- **{name}** — {details}" if details else f"- **{name}**")
    return "\n".join(lines)



def render_empty_transit_window(tool_results, locale):
    """Use engine data for an empty standalone survey, even if its prose is terse."""
    if len(tool_results) != 1 or tool_results[0].get("name") != "survey_transits":
        return ""
    result = tool_results[0].get("result") or {}
    nearby = (result.get("nearby_contacts") or {}).get("outside_orb") or []
    if result.get("status") != "ok" or result.get("events") or not nearby:
        return ""

    locale = normalize_locale(locale) or DEFAULT_LOCALE
    copy = reply_text(locale)
    labels = _astro_labels(locale)
    lines = [copy["transit_empty"], "", f"**{copy['transit_nearby']}**"]
    for phase in ("applying", "separating"):
        item = next((contact for contact in nearby if contact["phase"] == phase), None)
        if not item:
            return ""
        body = labels["planet"].get(item["transit_body"], item["transit_body"])
        target = labels["planet"].get(item["natal_body"], item["natal_body"])
        aspect = labels["aspect"].get(item["aspect_type"], item["aspect_type"])
        orb = f"{item['orb']:.2f}"
        if locale != "en":
            orb = orb.replace(".", ",")
        lines.append(f"- {copy[phase]} — {body} · {aspect} · {target} ({orb}°)")
    return "\n".join(lines)


READER_PROSE_RULES = """\
Use plain, calm language for people who practise astrology. For an overview
heading, use the local equivalent of "At a glance" or "Коротко". Describe the
actual planets and the person's forecast orb settings in ordinary words.
Keep methodology fingerprints, calculation versions, internal profile names,
diagnostic counters, and the term "AI" out of the reply. Mention counts only
when asked for or when they explain a concrete finding. An empty result needs
a sentence about the chosen period and the closest relevant contacts.
"""

# Older conversation history can still contain these diagnostic strings.
_FINGERPRINT = re.compile(
    r"(?:,\s*)?\bmethodology[ _-](?:version|hash)\s*:?\s*`?[0-9a-f]{12,64}\b`?",
    re.IGNORECASE,
)
_ZERO_COUNTERS = re.compile(
    r"\b0 contacts,\s*0 exact passes,\s*0 clusters,\s*0 simultaneous contacts\b\.?",
    re.IGNORECASE,
)
_NATAL_COUNTER = re.compile(
    r"^\s*(?:\*\*)?(?:Statistical summary:\s*)?Natal planets listed:\s*\d+\.?\s*(?:\*\*)?\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def strip_report_diagnostics(text):
    return _NATAL_COUNTER.sub("", _ZERO_COUNTERS.sub("", _FINGERPRINT.sub("", text))).strip()
