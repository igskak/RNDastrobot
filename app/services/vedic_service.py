"""Vedic (Jyotish) calculations behind the public kundli tools.

Pure calculation, no interpretation and no I/O beyond Swiss Ephemeris: nakshatra and rashi
of the Moon, Vimshottari dasha, Sade Sati windows and Ashtakoota (36-point) matching.
Texts belong to ``vedic_content``; this module returns numbers, indexes and keys only.

Conventions (kept explicit because Jyotish sources disagree):
- Sidereal zodiac, Lahiri ayanamsha (the Indian government standard).
- A dasha year is 365.25 days.
- Rashi and nakshatra are 0-based indexes here (rashi 0 = Aries, nakshatra 0 = Ashwini);
  pada is 1-4.
- Ashtakoota follows the common Parashari tables. The Tara rule is the classical one
  (remainders 3, 5 and 7 are the unfavourable ones; each favourable direction earns 1.5).
  Varna runs by element (water Brahmin, fire Kshatriya, earth Vaishya, air Shudra).
  Vashya, Gana and Yoni cell values differ slightly between almanacs; these are the
  widely used ones and are pinned by tests against a reference implementation.
"""
from __future__ import annotations

import threading
from bisect import bisect_right
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import swisseph as swe

from app.utils.ephemeris import get_ephemeris_path
from app.utils.timezones import resolve_zoneinfo

NAKSHATRA_SPAN = 360.0 / 27.0
PADA_SPAN = NAKSHATRA_SPAN / 4.0
DASHA_YEAR_DAYS = 365.25
MIN_BIRTH_YEAR = 1900
MAX_BIRTH_YEAR = 2100

# Swiss Ephemeris keeps its sidereal mode in process-global state. Every sidereal read in
# this module sets the mode and calculates under one lock; the older engine does not take
# that lock, so the window is small but not zero.
_SWE_LOCK = threading.RLock()

# ---------------------------------------------------------------------------
# Static tables
# ---------------------------------------------------------------------------

RASHI_KEYS = (
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
)

NAKSHATRA_KEYS = (
    "ashwini", "bharani", "krittika", "rohini", "mrigashira", "ardra", "punarvasu",
    "pushya", "ashlesha", "magha", "purva_phalguni", "uttara_phalguni", "hasta",
    "chitra", "swati", "vishakha", "anuradha", "jyeshtha", "mula", "purva_ashadha",
    "uttara_ashadha", "shravana", "dhanishta", "shatabhisha", "purva_bhadrapada",
    "uttara_bhadrapada", "revati",
)

# Vimshottari order and years. The lord of nakshatra n is order[n % 9].
DASHA_ORDER = ("ketu", "venus", "sun", "moon", "mars", "rahu", "jupiter", "saturn", "mercury")
DASHA_YEARS = {
    "ketu": 7, "venus": 20, "sun": 6, "moon": 10, "mars": 7,
    "rahu": 18, "jupiter": 16, "saturn": 19, "mercury": 17,
}
DASHA_TOTAL_YEARS = 120

# Rashi lords (0 = Aries).
RASHI_LORD = (
    "mars", "venus", "mercury", "moon", "sun", "mercury",
    "venus", "mars", "jupiter", "saturn", "saturn", "jupiter",
)

# Natural friendship (Parashari): lord -> (friends, enemies); everything else is neutral.
_FRIENDSHIP: Dict[str, Tuple[Tuple[str, ...], Tuple[str, ...]]] = {
    "sun": (("moon", "mars", "jupiter"), ("venus", "saturn")),
    "moon": (("sun", "mercury"), ()),
    "mars": (("sun", "moon", "jupiter"), ("mercury",)),
    "mercury": (("sun", "venus"), ("moon",)),
    "jupiter": (("sun", "moon", "mars"), ("mercury", "venus")),
    "venus": (("mercury", "saturn"), ("sun", "moon")),
    "saturn": (("mercury", "venus"), ("sun", "moon", "mars")),
}

# Varna by rashi element: 3 Brahmin, 2 Kshatriya, 1 Vaishya, 0 Shudra (rank, higher = more).
_VARNA_RANK_BY_RASHI = (2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 3)

_VASHYA_GROUPS = ("chatushpada", "manava", "jalachara", "vanachara", "keeta")
# Rashi -> Vashya group. Sagittarius and Capricorn are split by degree (see _vashya_group).
_VASHYA_BY_RASHI = (
    "chatushpada", "chatushpada", "manava", "jalachara", "vanachara", "manava",
    "manava", "keeta", "manava", "chatushpada", "manava", "jalachara",
)
# VASHYA_POINTS[bride_group][groom_group]
VASHYA_POINTS: Dict[str, Dict[str, float]] = {
    "chatushpada": {"chatushpada": 2.0, "manava": 1.0, "jalachara": 1.0, "vanachara": 1.5, "keeta": 1.0},
    "manava": {"chatushpada": 1.0, "manava": 2.0, "jalachara": 1.5, "vanachara": 0.0, "keeta": 1.0},
    "jalachara": {"chatushpada": 1.0, "manava": 1.5, "jalachara": 2.0, "vanachara": 1.0, "keeta": 1.0},
    "vanachara": {"chatushpada": 0.0, "manava": 0.0, "jalachara": 0.0, "vanachara": 2.0, "keeta": 0.0},
    "keeta": {"chatushpada": 1.0, "manava": 1.0, "jalachara": 1.0, "vanachara": 0.0, "keeta": 2.0},
}

# Gana by nakshatra: 0 Deva, 1 Manushya, 2 Rakshasa.
_GANA_BY_NAKSHATRA = (
    0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0,
)
# GANA_POINTS[bride_gana][groom_gana]
GANA_POINTS = (
    (6, 6, 0),
    (5, 6, 0),
    (1, 0, 6),
)

# Nadi by nakshatra: 0 Aadi, 1 Madhya, 2 Antya.
_NADI_BY_NAKSHATRA = (
    0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2,
)

# Yoni animal by nakshatra and the 14x14 points matrix.
_YONI_ANIMALS = (
    "horse", "elephant", "sheep", "serpent", "dog", "cat", "rat",
    "cow", "buffalo", "tiger", "deer", "monkey", "mongoose", "lion",
)
_YONI_BY_NAKSHATRA = (
    "horse", "elephant", "sheep", "serpent", "serpent", "dog", "cat",
    "sheep", "cat", "rat", "rat", "cow", "buffalo", "tiger",
    "buffalo", "tiger", "deer", "deer", "dog", "monkey", "mongoose",
    "monkey", "lion", "horse", "lion", "cow", "elephant",
)
_YONI_MATRIX = (
    (4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 1, 3, 2, 1),
    (2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0),
    (2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1),
    (3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2),
    (2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1),
    (2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1),
    (2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2),
    (1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1),
    (0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1),
    (1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1),
    (1, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1),
    (3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2),
    (2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2),
    (1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4),
)

KOOTA_MAX = {
    "varna": 1, "vashya": 2, "tara": 3, "yoni": 4,
    "graha_maitri": 5, "gana": 6, "bhakoot": 7, "nadi": 8,
}
KOOTA_ORDER = tuple(KOOTA_MAX)
TOTAL_GUNAS = 36
TRADITIONAL_THRESHOLD = 18


class VedicInputError(ValueError):
    """Raised for impossible or out-of-range input; the message is safe to show."""


# ---------------------------------------------------------------------------
# Time and Moon
# ---------------------------------------------------------------------------

def _ensure_ephemeris() -> None:
    swe.set_ephe_path(get_ephemeris_path())


def local_to_utc(local_dt: datetime, timezone_name: str) -> datetime:
    """Interpret a naive wall-clock time in an IANA zone (or fixed offset) as UTC."""
    if local_dt.tzinfo is not None:
        return local_dt.astimezone(timezone.utc)
    try:
        tz = resolve_zoneinfo(timezone_name)
    except Exception as exc:  # unknown zone name
        raise VedicInputError("Unknown timezone") from exc
    return local_dt.replace(tzinfo=tz).astimezone(timezone.utc)


def julian_day_ut(utc_dt: datetime) -> float:
    utc_dt = utc_dt.astimezone(timezone.utc)
    hour = utc_dt.hour + utc_dt.minute / 60.0 + utc_dt.second / 3600.0
    return swe.julday(utc_dt.year, utc_dt.month, utc_dt.day, hour)


def _check_year(year: int) -> None:
    if year < MIN_BIRTH_YEAR or year > MAX_BIRTH_YEAR:
        raise VedicInputError(f"Birth year must be between {MIN_BIRTH_YEAR} and {MAX_BIRTH_YEAR}")


def _sidereal_longitude(jd_ut: float, body: int) -> Tuple[float, float]:
    """Sidereal longitude and daily speed of a body, Lahiri ayanamsha."""
    with _SWE_LOCK:
        _ensure_ephemeris()
        swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
        data, _ = swe.calc_ut(jd_ut, body, swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED)
    return data[0] % 360.0, data[3]


@dataclass(frozen=True)
class MoonPosition:
    longitude: float
    rashi: int          # 0-11
    nakshatra: int      # 0-26
    pada: int           # 1-4
    nakshatra_fraction: float  # share of the nakshatra already traversed, 0..1

    def as_dict(self) -> Dict[str, Any]:
        return {
            "longitude": round(self.longitude, 4),
            "rashi": self.rashi,
            "rashi_key": RASHI_KEYS[self.rashi],
            "nakshatra": self.nakshatra,
            "nakshatra_key": NAKSHATRA_KEYS[self.nakshatra],
            "pada": self.pada,
            "nakshatra_fraction": round(self.nakshatra_fraction, 6),
        }


def position_from_longitude(longitude: float) -> MoonPosition:
    lon = longitude % 360.0
    nak = min(int(lon // NAKSHATRA_SPAN), 26)
    within = lon - nak * NAKSHATRA_SPAN
    pada = min(int(within // PADA_SPAN), 3) + 1
    return MoonPosition(
        longitude=lon,
        rashi=min(int(lon // 30.0), 11),
        nakshatra=nak,
        pada=pada,
        nakshatra_fraction=within / NAKSHATRA_SPAN,
    )


def moon_position(jd_ut: float) -> MoonPosition:
    lon, _ = _sidereal_longitude(jd_ut, swe.MOON)
    return position_from_longitude(lon)


def moon_for_local_birth(
    birth_date: date,
    birth_time: Optional[Tuple[int, int]],
    timezone_name: str,
) -> Tuple[MoonPosition, datetime, bool, Dict[str, Any]]:
    """Moon at a birth moment.

    ``birth_time`` is ``(hour, minute)`` or None when the time is unknown. With an unknown
    time the Moon is taken at local noon and the result reports whether the Moon changed
    nakshatra or rashi during that day, in which case the position is not reliable.

    Returns ``(moon, utc_datetime, time_known, uncertainty)``.
    """
    _check_year(birth_date.year)
    time_known = birth_time is not None
    hour, minute = birth_time if birth_time is not None else (12, 0)
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise VedicInputError("Invalid birth time")

    utc_dt = local_to_utc(datetime(birth_date.year, birth_date.month, birth_date.day, hour, minute), timezone_name)
    moon = moon_position(julian_day_ut(utc_dt))

    uncertainty = {"nakshatra_may_differ": False, "rashi_may_differ": False}
    if not time_known:
        start = local_to_utc(datetime(birth_date.year, birth_date.month, birth_date.day, 0, 0), timezone_name)
        end = start + timedelta(hours=24)
        first, last = moon_position(julian_day_ut(start)), moon_position(julian_day_ut(end))
        uncertainty["nakshatra_may_differ"] = first.nakshatra != last.nakshatra
        uncertainty["rashi_may_differ"] = first.rashi != last.rashi
    return moon, utc_dt, time_known, uncertainty


# ---------------------------------------------------------------------------
# Vimshottari dasha
# ---------------------------------------------------------------------------

def _d(value: datetime) -> str:
    return value.astimezone(timezone.utc).date().isoformat()


def _antardashas(md_lord: str, md_start: datetime, md_days: float) -> List[Dict[str, Any]]:
    start_index = DASHA_ORDER.index(md_lord)
    rows: List[Dict[str, Any]] = []
    cursor = md_start
    for step in range(9):
        lord = DASHA_ORDER[(start_index + step) % 9]
        days = md_days * DASHA_YEARS[lord] / DASHA_TOTAL_YEARS
        end = cursor + timedelta(days=days)
        rows.append({"lord": lord, "start": cursor, "end": end})
        cursor = end
    return rows


def vimshottari(
    moon_longitude: float,
    birth_utc: datetime,
    as_of: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Maha, antar and pratyantar dasha from the Moon's sidereal longitude.

    The first mahadasha is the one running at birth; its start precedes the birth date by
    the part of the period already elapsed (the dasha balance).
    """
    moon = position_from_longitude(moon_longitude)
    birth_utc = birth_utc.astimezone(timezone.utc)
    as_of = (as_of or datetime.now(timezone.utc)).astimezone(timezone.utc)

    first_lord = DASHA_ORDER[moon.nakshatra % 9]
    first_years = DASHA_YEARS[first_lord]
    elapsed_days = moon.nakshatra_fraction * first_years * DASHA_YEAR_DAYS
    cursor = birth_utc - timedelta(days=elapsed_days)

    mahadashas: List[Dict[str, Any]] = []
    first_index = DASHA_ORDER.index(first_lord)
    for step in range(9):
        lord = DASHA_ORDER[(first_index + step) % 9]
        days = DASHA_YEARS[lord] * DASHA_YEAR_DAYS
        end = cursor + timedelta(days=days)
        mahadashas.append({"lord": lord, "start": cursor, "end": end, "days": days})
        cursor = end

    current_md = next((m for m in mahadashas if m["start"] <= as_of < m["end"]), None)
    current: Dict[str, Any] = {}
    antardashas_out: List[Dict[str, Any]] = []
    pratyantardashas_out: List[Dict[str, Any]] = []
    if current_md is not None:
        ads = _antardashas(current_md["lord"], current_md["start"], current_md["days"])
        current_ad = next((a for a in ads if a["start"] <= as_of < a["end"]), ads[-1])
        pds = _antardashas(current_ad["lord"], current_ad["start"], (current_ad["end"] - current_ad["start"]).total_seconds() / 86400.0)
        current_pd = next((p for p in pds if p["start"] <= as_of < p["end"]), pds[-1])
        current = {
            "mahadasha": current_md["lord"],
            "antardasha": current_ad["lord"],
            "pratyantardasha": current_pd["lord"],
        }
        antardashas_out = [
            {"lord": a["lord"], "start": _d(a["start"]), "end": _d(a["end"]), "current": a is current_ad}
            for a in ads
        ]
        pratyantardashas_out = [
            {"lord": p["lord"], "start": _d(p["start"]), "end": _d(p["end"]), "current": p is current_pd}
            for p in pds
        ]

    return {
        "moon": moon.as_dict(),
        "year_length_days": DASHA_YEAR_DAYS,
        "birth_balance": {
            "lord": first_lord,
            "years_total": first_years,
            "years_remaining": round(first_years * (1.0 - moon.nakshatra_fraction), 2),
        },
        "mahadashas": [
            {
                "lord": m["lord"],
                "years": DASHA_YEARS[m["lord"]],
                "start": _d(m["start"]),
                "end": _d(m["end"]),
                "current": m is current_md,
                "before_birth": m["end"] <= birth_utc,
            }
            for m in mahadashas
        ],
        "current": current,
        "antardashas": antardashas_out,
        "pratyantardashas": pratyantardashas_out,
    }


# ---------------------------------------------------------------------------
# Sade Sati
# ---------------------------------------------------------------------------

_SATURN_STEP_DAYS = 4.0
_SATURN_RANGE_START = datetime(1897, 1, 1, tzinfo=timezone.utc)
_SATURN_RANGE_END = datetime(2150, 1, 1, tzinfo=timezone.utc)
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
# Retrograde dips that leave and re-enter a sign are one Sade Sati; episodes are ~22 years apart.
_EPISODE_MERGE_GAP_DAYS = 3 * 365.25


def _sat_sign(jd: float) -> int:
    lon, _ = _sidereal_longitude(jd, swe.SATURN)
    return int(lon // 30.0) % 12


def _find_ingress(jd_a: float, jd_b: float, sign_a: int) -> float:
    """Bisect the moment Saturn leaves ``sign_a`` between two samples (about 1 minute)."""
    lo, hi = jd_a, jd_b
    for _ in range(18):
        mid = (lo + hi) / 2.0
        if _sat_sign(mid) == sign_a:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


@lru_cache(maxsize=1)
def _saturn_sign_intervals() -> Tuple[Tuple[float, float, int], ...]:
    """(start_jd, end_jd, sidereal sign index) for Saturn over the supported years."""
    start = julian_day_ut(_SATURN_RANGE_START)
    end = julian_day_ut(_SATURN_RANGE_END)
    intervals: List[Tuple[float, float, int]] = []
    jd = start
    sign = _sat_sign(jd)
    interval_start = start
    while jd < end:
        nxt = min(jd + _SATURN_STEP_DAYS, end)
        nxt_sign = _sat_sign(nxt)
        if nxt_sign != sign:
            ingress = _find_ingress(jd, nxt, sign)
            intervals.append((interval_start, ingress, sign))
            interval_start = ingress
            sign = _sat_sign(ingress + 1.0 / 1440.0)
        jd = nxt
    intervals.append((interval_start, end, sign))
    return tuple(intervals)


def warm_up() -> None:
    """Build the cached Saturn table so the first visitor does not wait for it (a few seconds)."""
    try:
        _saturn_sign_intervals()
    except Exception:  # never take the app down over a cache
        pass


def _jd_to_dt(jd: float) -> datetime:
    return _EPOCH + timedelta(days=jd - 2440587.5)


def _dt_to_jd(value: datetime) -> float:
    return (value.astimezone(timezone.utc) - _EPOCH).total_seconds() / 86400.0 + 2440587.5


def saturn_sign_at(when: datetime) -> int:
    """Sidereal sign (0-11) Saturn occupies at ``when``."""
    return _sat_sign(_dt_to_jd(when))


def sade_sati(
    moon_rashi: int,
    birth_utc: datetime,
    as_of: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Sade Sati episodes (Saturn in the 12th, 1st and 2nd sign from the natal Moon).

    Phases are named by the sign Saturn is in: ``rising`` (12th from the Moon), ``peak``
    (the Moon's sign) and ``setting`` (2nd from the Moon).
    """
    if not 0 <= moon_rashi <= 11:
        raise VedicInputError("Invalid moon sign")
    birth_utc = birth_utc.astimezone(timezone.utc)
    as_of = (as_of or datetime.now(timezone.utc)).astimezone(timezone.utc)
    _check_year(birth_utc.year)

    phase_signs = {
        "rising": (moon_rashi - 1) % 12,
        "peak": moon_rashi,
        "setting": (moon_rashi + 1) % 12,
    }
    sign_to_phase = {sign: phase for phase, sign in phase_signs.items()}
    intervals = _saturn_sign_intervals()

    # Merge consecutive in-window intervals into episodes.
    episodes: List[List[Tuple[float, float, int]]] = []
    for start_jd, end_jd, sign in intervals:
        if sign not in sign_to_phase:
            continue
        if episodes and start_jd - episodes[-1][-1][1] <= _EPISODE_MERGE_GAP_DAYS:
            episodes[-1].append((start_jd, end_jd, sign))
        else:
            episodes.append([(start_jd, end_jd, sign)])

    birth_jd = _dt_to_jd(birth_utc)
    as_of_jd = _dt_to_jd(as_of)
    out_episodes: List[Dict[str, Any]] = []
    for pieces in episodes:
        start_jd, end_jd = pieces[0][0], pieces[-1][1]
        if end_jd < birth_jd:
            continue
        phases = []
        for phase in ("rising", "peak", "setting"):
            sign = phase_signs[phase]
            spans = [p for p in pieces if p[2] == sign]
            if not spans:
                continue
            phases.append({
                "phase": phase,
                "sign": sign,
                "sign_key": RASHI_KEYS[sign],
                "start": _d(_jd_to_dt(spans[0][0])),
                "end": _d(_jd_to_dt(spans[-1][1])),
            })
        out_episodes.append({
            "start": _d(_jd_to_dt(start_jd)),
            "end": _d(_jd_to_dt(end_jd)),
            "began_before_birth": start_jd < birth_jd,
            "active": start_jd <= as_of_jd < end_jd,
            "phases": phases,
        })

    saturn_now = saturn_sign_at(as_of)
    phase_now = sign_to_phase.get(saturn_now)
    upcoming = next((e for e in out_episodes if _iso_to_jd(e["start"]) > as_of_jd), None)
    return {
        "moon_rashi": moon_rashi,
        "moon_rashi_key": RASHI_KEYS[moon_rashi],
        "saturn_sign": saturn_now,
        "saturn_sign_key": RASHI_KEYS[saturn_now],
        "active": phase_now is not None,
        "phase": phase_now,
        "episodes": out_episodes,
        "next_start": upcoming["start"] if upcoming else None,
    }


def _iso_to_jd(iso_day: str) -> float:
    return _dt_to_jd(datetime.fromisoformat(iso_day).replace(tzinfo=timezone.utc))


# ---------------------------------------------------------------------------
# Ashtakoota
# ---------------------------------------------------------------------------

def _vashya_group(rashi: int, degree_in_rashi: Optional[float]) -> str:
    """Sagittarius second half is four-footed, Capricorn second half is water."""
    if degree_in_rashi is not None:
        if rashi == 8 and degree_in_rashi >= 15.0:
            return "chatushpada"
        if rashi == 9 and degree_in_rashi >= 15.0:
            return "jalachara"
    return _VASHYA_BY_RASHI[rashi]


def _friendship(a: str, b: str) -> int:
    """+1 friend, 0 neutral, -1 enemy: how planet ``a`` regards planet ``b``."""
    friends, enemies = _FRIENDSHIP[a]
    if b in friends:
        return 1
    if b in enemies:
        return -1
    return 0


def _maitri_points(lord_a: str, lord_b: str) -> float:
    if lord_a == lord_b:
        return 5.0
    pair = tuple(sorted((_friendship(lord_a, lord_b), _friendship(lord_b, lord_a))))
    return {
        (1, 1): 5.0,
        (0, 1): 4.0,
        (0, 0): 3.0,
        (-1, 1): 1.0,
        (-1, 0): 0.5,
        (-1, -1): 0.0,
    }[pair]


def _tara_points(groom_nak: int, bride_nak: int) -> float:
    points = 0.0
    for origin, target in ((bride_nak, groom_nak), (groom_nak, bride_nak)):
        remainder = (((target - origin) % 27) + 1) % 9
        if remainder not in (3, 5, 7):
            points += 1.5
    return points


def _bhakoot_points(groom_rashi: int, bride_rashi: int) -> float:
    distance = ((groom_rashi - bride_rashi) % 12) + 1
    return 0.0 if distance in (2, 12, 5, 9, 6, 8) else 7.0


@dataclass(frozen=True)
class MatchPerson:
    """Moon placement of one partner. ``degree_in_rashi`` refines Vashya when known."""
    nakshatra: int
    rashi: int
    degree_in_rashi: Optional[float] = None

    @classmethod
    def from_longitude(cls, longitude: float) -> "MatchPerson":
        pos = position_from_longitude(longitude)
        return cls(pos.nakshatra, pos.rashi, pos.longitude - pos.rashi * 30.0)

    @classmethod
    def from_nakshatra_pada(cls, nakshatra: int, pada: int) -> "MatchPerson":
        """Rashi from nakshatra and pada (each nakshatra covers 13 deg 20 min = 4 padas)."""
        if not (0 <= nakshatra <= 26 and 1 <= pada <= 4):
            raise VedicInputError("Invalid nakshatra or pada")
        lon = nakshatra * NAKSHATRA_SPAN + (pada - 1) * PADA_SPAN + PADA_SPAN / 2.0
        return cls.from_longitude(lon)


def ashtakoota(groom: MatchPerson, bride: MatchPerson) -> Dict[str, Any]:
    """Eight-koota score out of 36 from the two Moon placements."""
    g_group = _vashya_group(groom.rashi, groom.degree_in_rashi)
    b_group = _vashya_group(bride.rashi, bride.degree_in_rashi)

    koota = {
        "varna": 1.0 if _VARNA_RANK_BY_RASHI[groom.rashi] >= _VARNA_RANK_BY_RASHI[bride.rashi] else 0.0,
        "vashya": VASHYA_POINTS[b_group][g_group],
        "tara": _tara_points(groom.nakshatra, bride.nakshatra),
        "yoni": float(_YONI_MATRIX[_YONI_ANIMALS.index(_YONI_BY_NAKSHATRA[bride.nakshatra])][_YONI_ANIMALS.index(_YONI_BY_NAKSHATRA[groom.nakshatra])]),
        "graha_maitri": _maitri_points(RASHI_LORD[bride.rashi], RASHI_LORD[groom.rashi]),
        "gana": float(GANA_POINTS[_GANA_BY_NAKSHATRA[bride.nakshatra]][_GANA_BY_NAKSHATRA[groom.nakshatra]]),
        "bhakoot": _bhakoot_points(groom.rashi, bride.rashi),
        "nadi": 0.0 if _NADI_BY_NAKSHATRA[groom.nakshatra] == _NADI_BY_NAKSHATRA[bride.nakshatra] else 8.0,
    }
    total = sum(koota.values())
    return {
        "koota": [
            {"key": key, "points": koota[key], "max": KOOTA_MAX[key]}
            for key in KOOTA_ORDER
        ],
        "total": total,
        "max": TOTAL_GUNAS,
        "traditional_threshold": TRADITIONAL_THRESHOLD,
        "meets_threshold": total >= TRADITIONAL_THRESHOLD,
        "groom": {"nakshatra": groom.nakshatra, "rashi": groom.rashi},
        "bride": {"nakshatra": bride.nakshatra, "rashi": bride.rashi},
    }


# Sorted nakshatra boundaries, exposed for tests and UI helpers.
_NAKSHATRA_STARTS = [i * NAKSHATRA_SPAN for i in range(27)]


def nakshatra_index(longitude: float) -> int:
    return min(bisect_right(_NAKSHATRA_STARTS, longitude % 360.0) - 1, 26)
