"""Localized, deterministic assistant reply fragments."""
from __future__ import annotations

import json
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
