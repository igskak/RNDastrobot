"""Assemble kundli results and reports from calculations plus reviewed text blocks.

Nothing here generates free text. Every visible sentence is a block from ``vedic_content`` (or
a template over one), and the finished report passes the safety law in ``b2c_safety_policy``
before it leaves this module: a violation raises instead of being shown.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from app.services import b2c_safety_policy as safety
from app.services import vedic_content as content
from app.services import vedic_service as vedic
from app.services.vedic_content import pick

_MONTHS_EN = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def fmt_date(iso_day: Optional[str], locale: str) -> str:
    if not iso_day:
        return ""
    parsed = date.fromisoformat(iso_day)
    if locale == "hi":
        return f"{parsed.day:02d}.{parsed.month:02d}.{parsed.year}"
    return f"{parsed.day} {_MONTHS_EN[parsed.month - 1]} {parsed.year}"


def normalize_locale(locale: Optional[str]) -> str:
    return locale if locale in content.LOCALES else "en"


def moon_labels(moon: Dict[str, Any], locale: str) -> Dict[str, Any]:
    out = dict(moon)
    out["rashi_label"] = content.RASHI_NAMES[locale][moon["rashi_key"]]
    out["nakshatra_label"] = content.NAKSHATRA_NAMES[locale][moon["nakshatra_key"]]
    out["nakshatra_quality"] = content.NAKSHATRA_QUALITY[locale][moon["nakshatra_key"]]
    return out


def _lord(key: str, locale: str) -> str:
    return content.LORD_NAMES[locale][key]


def _theme(key: str, locale: str) -> str:
    return pick(content.LORD_BLOCKS[key]["theme"], locale)


def _greeting(name: Optional[str], locale: str) -> Optional[str]:
    return content.GREETING[locale].format(name=name) if name else None


def _section(section_id: str, title: str, paragraphs: Optional[List[str]] = None,
             items: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    return {"id": section_id, "title": title, "paragraphs": paragraphs or [], "items": items or []}


def _report(kind: str, locale: str, title: str, headline: str, intro: str, name: Optional[str],
            sections: List[Dict[str, Any]], data: Dict[str, Any]) -> Dict[str, Any]:
    return guard({
        "kind": kind,
        "locale": locale,
        "title": title,
        "greeting": _greeting(name, locale),
        "headline": headline,
        "intro": intro,
        "sections": sections,
        "disclaimer": safety.DISCLAIMER[locale],
        "data": data,
    }, locale)


def report_texts(report: Dict[str, Any]) -> Iterable[str]:
    """Every string a visitor can read in a report."""
    for key in ("title", "greeting", "headline", "intro", "disclaimer"):
        if report.get(key):
            yield report[key]
    for section in report.get("sections", []):
        yield section["title"]
        yield from section["paragraphs"]
        for item in section["items"]:
            yield item["label"]
            yield item["text"]


def guard(report: Dict[str, Any], locale: str) -> Dict[str, Any]:
    """Refuse to return a report containing anything the safety law forbids."""
    for text in report_texts(report):
        safety.assert_safe(text, locale)
    return report


# ---------------------------------------------------------------------------
# Dasha
# ---------------------------------------------------------------------------

def build_dasha(calc: Dict[str, Any], locale: str, name: Optional[str] = None, *, full: bool = False,
                as_of: Optional[datetime] = None) -> Dict[str, Any]:
    locale = normalize_locale(locale)
    as_of = (as_of or datetime.now(timezone.utc)).astimezone(timezone.utc)
    moon = moon_labels(calc["moon"], locale)
    current = calc["current"]

    moon_line = pick(content.DASHA["moon_line"], locale).format(
        rashi=moon["rashi_label"], nakshatra=moon["nakshatra_label"], pada=moon["pada"],
        quality=moon["nakshatra_quality"],
    )
    if current:
        now_line = pick(content.DASHA["now"], locale).format(
            md=_lord(current["mahadasha"], locale), ad=_lord(current["antardasha"], locale),
            md_theme=_theme(current["mahadasha"], locale), ad_theme=_theme(current["antardasha"], locale),
        )
    else:
        now_line = pick(content.DASHA["no_current"], locale)

    sections: List[Dict[str, Any]] = []
    if full:
        sections.append(_section("moon", pick(content.TITLES["moon"], locale), [moon_line]))
        if current:
            md = current["mahadasha"]
            sections.append(_section(
                "now", pick(content.TITLES["dasha"], locale),
                [now_line, pick(content.LORD_BLOCKS[md]["season"], locale)],
            ))
            horizon = as_of + timedelta(days=365)
            windows = []
            for row in calc["antardashas"]:
                start = datetime.fromisoformat(row["start"]).replace(tzinfo=timezone.utc)
                end = datetime.fromisoformat(row["end"]).replace(tzinfo=timezone.utc)
                if end >= as_of and start <= horizon:
                    windows.append({
                        "label": f"{fmt_date(row['start'], locale)} - {fmt_date(row['end'], locale)}",
                        "text": pick(content.DASHA["window"], locale).format(
                            start=fmt_date(row["start"], locale), end=fmt_date(row["end"], locale),
                            md=_lord(md, locale), ad=_lord(row["lord"], locale),
                            ad_theme=_theme(row["lord"], locale),
                        ),
                    })
            if windows:
                sections.append(_section("year", pick(content.TITLES["year"], locale), items=windows))
            sections.append(_section(
                "practice", pick(content.TITLES["practice"], locale),
                [pick(content.LORD_BLOCKS[current["antardasha"]]["practice"], locale)],
            ))

    labeled = dict(calc)
    labeled["moon"] = moon
    labeled["birth_balance"] = dict(calc["birth_balance"], lord_label=_lord(calc["birth_balance"]["lord"], locale))
    labeled["mahadashas"] = [dict(m, lord_label=_lord(m["lord"], locale), theme=_theme(m["lord"], locale))
                             for m in calc["mahadashas"]]
    labeled["antardashas"] = [dict(a, lord_label=_lord(a["lord"], locale)) for a in calc["antardashas"]]
    labeled["pratyantardashas"] = [dict(p, lord_label=_lord(p["lord"], locale)) for p in calc["pratyantardashas"]]
    if current:
        labeled["current_labels"] = {k: _lord(v, locale) for k, v in current.items()}
    return _report("dasha", locale, pick(content.TITLES["dasha"], locale), now_line,
                   pick(content.DASHA["intro"], locale), name, sections, labeled)


# ---------------------------------------------------------------------------
# Sade Sati
# ---------------------------------------------------------------------------

def build_sade_sati(calc: Dict[str, Any], locale: str, name: Optional[str] = None, *, full: bool = False) -> Dict[str, Any]:
    locale = normalize_locale(locale)
    phase = calc["phase"]
    status_line = pick(content.SADE_SATI[phase], locale) if phase else pick(content.SADE_SATI["inactive"], locale)

    sections: List[Dict[str, Any]] = []
    if full:
        paragraphs = [status_line]
        if not calc["active"] and calc.get("next_start"):
            paragraphs.append(pick(content.SADE_SATI["next"], locale).format(date=fmt_date(calc["next_start"], locale)))
        sections.append(_section("status", pick(content.TITLES["sade_sati"], locale), paragraphs))
        items = [{
            "label": f"{fmt_date(e['start'], locale)} - {fmt_date(e['end'], locale)}",
            "text": pick(content.SADE_SATI["episode"], locale).format(
                start=fmt_date(e["start"], locale), end=fmt_date(e["end"], locale)),
        } for e in calc["episodes"]]
        if items:
            sections.append(_section("episodes", pick(content.TITLES["sade_sati"], locale), items=items))
        sections.append(_section("practice", pick(content.TITLES["practice"], locale),
                                 [pick(content.SADE_SATI["practice"], locale)]))

    labeled = dict(calc)
    labeled["moon_rashi_label"] = content.RASHI_NAMES[locale][calc["moon_rashi_key"]]
    labeled["saturn_sign_label"] = content.RASHI_NAMES[locale][calc["saturn_sign_key"]]
    for episode in labeled["episodes"]:
        for ph in episode["phases"]:
            ph["sign_label"] = content.RASHI_NAMES[locale][ph["sign_key"]]
    return _report("sade_sati", locale, pick(content.TITLES["sade_sati"], locale), status_line,
                   pick(content.SADE_SATI["intro"], locale), name, sections, labeled)


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------

def _koota_band(points: float, maximum: float) -> int:
    """Index into KOOTA_TEXT tuples: 1 high, 2 middle, 3 lower."""
    share = points / maximum
    if share >= 0.75:
        return 1
    if share >= 0.4:
        return 2
    return 3


def _overall_band(total: float) -> str:
    if total >= 28:
        return "high"
    if total >= vedic.TRADITIONAL_THRESHOLD:
        return "middle"
    return "lower"


def build_matching(calc: Dict[str, Any], locale: str, names: tuple = (None, None), *, full: bool = False) -> Dict[str, Any]:
    locale = normalize_locale(locale)
    headline = pick(content.MATCH_OVERALL[_overall_band(calc["total"])], locale)

    items = []
    for row in calc["koota"]:
        looks_at, *texts = content.KOOTA_TEXT[locale][row["key"]]
        band = _koota_band(row["points"], row["max"])
        items.append({
            "label": f"{content.KOOTA_NAMES[locale][row['key']]}: {row['points']:g} / {row['max']}",
            "text": (f"{looks_at[:1].upper()}{looks_at[1:]}. " if locale == "en" else f"{looks_at}। ") + texts[band - 1],
        })

    sections: List[Dict[str, Any]] = []
    if full:
        sections.append(_section("overall", pick(content.TITLES["matching"], locale), [headline]))
        sections.append(_section("koota", pick(content.TITLES["matching"], locale), items=items))

    labeled = dict(calc)
    labeled["koota"] = [dict(k, label=content.KOOTA_NAMES[locale][k["key"]], text=item["text"],
                             band=_koota_band(k["points"], k["max"]))
                        for k, item in zip(calc["koota"], items)]
    labeled["band"] = _overall_band(calc["total"])
    labeled["groom"] = dict(calc["groom"], rashi_label=_rashi_label(calc["groom"]["rashi"], locale),
                            nakshatra_label=_nak_label(calc["groom"]["nakshatra"], locale))
    labeled["bride"] = dict(calc["bride"], rashi_label=_rashi_label(calc["bride"]["rashi"], locale),
                            nakshatra_label=_nak_label(calc["bride"]["nakshatra"], locale))
    greeting_name = " & ".join(n for n in names if n) or None
    return _report("matching", locale, pick(content.TITLES["matching"], locale), headline,
                   pick(content.MATCH_OVERALL["intro"], locale), greeting_name, sections, labeled)


def _rashi_label(index: int, locale: str) -> str:
    return content.RASHI_NAMES[locale][vedic.RASHI_KEYS[index]]


def _nak_label(index: int, locale: str) -> str:
    return content.NAKSHATRA_NAMES[locale][vedic.NAKSHATRA_KEYS[index]]


# ---------------------------------------------------------------------------
# Week ahead (the subscription deliverable)
# ---------------------------------------------------------------------------

def build_week(natal_moon_rashi: int, dasha_calc: Dict[str, Any], locale: str, timezone_name: str,
               name: Optional[str] = None, start: Optional[date] = None, days: int = 7) -> Dict[str, Any]:
    locale = normalize_locale(locale)
    start = start or datetime.now(timezone.utc).date()

    items: List[Dict[str, str]] = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        noon_utc = vedic.local_to_utc(datetime(day.year, day.month, day.day, 12, 0), timezone_name)
        transit = vedic.moon_position(vedic.julian_day_ut(noon_utc))
        house = (transit.rashi - natal_moon_rashi) % 12 + 1
        items.append({
            "label": f"{fmt_date(day.isoformat(), locale)} - {content.RASHI_NAMES[locale][vedic.RASHI_KEYS[transit.rashi]]}",
            "text": pick(content.MOON_DAY[house], locale),
        })

    current = dasha_calc.get("current") or {}
    paragraphs = [pick(content.WEEK["intro"], locale)]
    practice: List[str] = []
    if current:
        paragraphs.append(pick(content.DASHA["now"], locale).format(
            md=_lord(current["mahadasha"], locale), ad=_lord(current["antardasha"], locale),
            md_theme=_theme(current["mahadasha"], locale), ad_theme=_theme(current["antardasha"], locale),
        ))
        practice = [pick(content.LORD_BLOCKS[current["antardasha"]]["practice"], locale)]

    sections = [_section("days", pick(content.WEEK["title"], locale), paragraphs, items)]
    if practice:
        sections.append(_section("practice", pick(content.TITLES["practice"], locale), practice))
    headline = pick(content.WEEK["title"], locale)
    return _report("week", locale, headline, headline, pick(content.WEEK["intro"], locale), name, sections,
                   {"start": start.isoformat(), "days": days, "current": current})
