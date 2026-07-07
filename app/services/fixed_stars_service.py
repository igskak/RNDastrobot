"""
Fixed stars service — фиксированные звёзды (P1).

Считает эклиптические долготы крупных неподвижных звёзд (через Swiss Ephemeris
fixstar2_ut, каталог sefstars.txt) и находит их соединения с планетами и углами
карты в пределах узкого орба. Природа звёзд (птолемеевы планетные эквиваленты) —
курированная таблица (Робсон).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

import swisseph as swe
from loguru import logger

from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds
from app.utils.ephemeris import get_ephemeris_path

# Узкий орб для соединений со звёздами (классически ~1°).
DEFAULT_STAR_ORB = 1.0

# Курированный каталог крупных звёзд: имя для Swiss Ephemeris -> природа.
STAR_CATALOG = {
    "Achernar": "Jupiter",
    "Algol": "Saturn/Jupiter",
    "Alcyone": "Moon/Mars",
    "Aldebaran": "Mars",
    "Rigel": "Jupiter/Saturn",
    "Capella": "Mars/Mercury",
    "Betelgeuse": "Mars/Mercury",
    "Sirius": "Jupiter/Mars",
    "Castor": "Mercury",
    "Pollux": "Mars",
    "Procyon": "Mercury/Mars",
    "Regulus": "Mars/Jupiter",
    "Alphard": "Saturn/Venus",
    "Zosma": "Saturn/Venus",
    "Denebola": "Saturn/Venus",
    "Spica": "Venus/Mars",
    "Arcturus": "Mars/Jupiter",
    "Vindemiatrix": "Saturn/Mercury",
    "Antares": "Mars/Jupiter",
    "Vega": "Venus/Mercury",
    "Altair": "Mars/Jupiter",
    "Fomalhaut": "Venus/Mercury",
    "DenebAdige": "Venus/Mercury",
    "Markab": "Mars/Mercury",
    "Scheat": "Mars/Mercury",
    "Bellatrix": "Mars/Mercury",
    "Alphecca": "Venus/Mercury",
}

NEBULA_KEYWORDS = (
    "cluster",
    "nebula",
    "galaxy",
    "messier",
    "ngc",
    "m6",
    "m7",
    "m22",
    "m31",
    "m42",
    "m44",
    "m87",
    "galactic",
    "attractor",
)


def _catalog_key(name: str) -> str:
    return "".join(ch for ch in str(name or "").lower() if ch.isalnum())


STAR_NATURE_BY_KEY = {_catalog_key(name): nature for name, nature in STAR_CATALOG.items()}


def _sep(a: float, b: float) -> float:
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


@lru_cache(maxsize=4)
def _load_star_catalog_entries(ephe_path: str) -> tuple[Dict, ...]:
    """
    Parse sefstars.txt into queryable named entries.

    Swiss Ephemeris can resolve traditional names directly. It does not resolve
    bare nomenclature codes such as ``alEri``, so unnamed catalogue rows are not
    useful as API queries and are intentionally skipped.
    """
    path = Path(ephe_path) / "sefstars.txt"
    if not path.exists():
        return tuple()

    entries: list[Dict] = []
    seen_designations: set[str] = set()
    seen_names: set[str] = set()
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return tuple()

    for raw in lines:
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = [part.strip() for part in raw.split(",")]
        if len(parts) < 14:
            continue
        name = parts[0].strip()
        designation = parts[1].strip() if len(parts) > 1 else ""
        if not name:
            continue
        name_key = _catalog_key(name)
        designation_key = _catalog_key(designation)
        if name_key in seen_names:
            continue
        # Many bright stars are duplicated near the top as preferred entries and
        # later in constellation order. Keep the first preferred display name.
        if designation_key and designation_key in seen_designations:
            continue

        magnitude = None
        try:
            magnitude = float(parts[13])
        except (TypeError, ValueError):
            pass

        label_key = f"{name} {designation}".lower()
        entries.append({
            "name": name,
            "designation": designation,
            "magnitude": magnitude,
            "is_highlighted": name_key in STAR_NATURE_BY_KEY,
            "is_nebula": any(keyword in label_key for keyword in NEBULA_KEYWORDS),
        })
        seen_names.add(name_key)
        if designation_key:
            seen_designations.add(designation_key)
    return tuple(entries)


class FixedStarsService:
    """Позиции неподвижных звёзд и их соединения с точками карты."""

    def __init__(self, ephe_path: Optional[str] = None):
        self.ephe_path = ephe_path or get_ephemeris_path()
        swe.set_ephe_path(self.ephe_path)

    def _catalog_entries_by_name(self) -> Dict[str, Dict]:
        return {
            _catalog_key(entry["name"]): dict(entry)
            for entry in _load_star_catalog_entries(self.ephe_path)
        }

    def _entry_for_name(self, name: str) -> Optional[Dict]:
        return self._catalog_entries_by_name().get(_catalog_key(name))

    def _candidate_entries(
        self,
        filter_mode: str,
        max_magnitude: Optional[float],
    ) -> List[Dict]:
        mode = str(filter_mode or "highlighted").strip().lower()
        entries_by_name = self._catalog_entries_by_name()

        if mode == "highlighted":
            entries = []
            for name in STAR_CATALOG:
                entries.append(entries_by_name.get(_catalog_key(name)) or {
                    "name": name,
                    "designation": "",
                    "magnitude": None,
                    "is_highlighted": True,
                    "is_nebula": False,
                })
        else:
            entries = [dict(entry) for entry in _load_star_catalog_entries(self.ephe_path)]
            if mode == "nebulae":
                entries = [entry for entry in entries if entry.get("is_nebula")]
            elif mode == "brightness":
                # Brightness filtering is applied below via max_magnitude.
                pass
            elif mode not in {"all", "named"}:
                entries = [entry for entry in entries if entry.get("is_highlighted")]

        if max_magnitude is not None:
            entries = [
                entry for entry in entries
                if entry.get("magnitude") is not None and float(entry["magnitude"]) <= max_magnitude
            ]
        return entries

    def _resolve_star(self, jd: float, entry: Dict) -> Optional[Dict]:
        name = entry["name"]
        try:
            data, star_name, _ = swe.fixstar2_ut(name, jd, swe.FLG_SWIEPH)
        except Exception as exc:
            logger.warning("fixstar2_ut failed for {}: {}", name, str(exc))
            return None

        lon = float(data[0])
        magnitude = entry.get("magnitude")
        if magnitude is None:
            try:
                magnitude = float(swe.fixstar2_mag(name)[0])
            except Exception:
                magnitude = None

        display_name, _, designation_from_swe = str(star_name or "").partition(",")
        display_name = display_name.strip() or name
        designation = (designation_from_swe or entry.get("designation") or "").strip()
        nature = STAR_NATURE_BY_KEY.get(_catalog_key(name)) or STAR_NATURE_BY_KEY.get(_catalog_key(display_name))
        deg = get_degree_in_sign(lon)
        return {
            "name": display_name,
            "query_name": name,
            "designation": designation,
            "nature": nature,
            "magnitude": round(float(magnitude), 2) if magnitude is not None else None,
            "longitude": round(lon, 6),
            "sign": get_zodiac_sign(lon),
            "degree_in_sign": round(deg, 6),
            "degree_in_sign_formatted": format_degree_minutes_seconds(deg),
            "is_highlighted": bool(entry.get("is_highlighted")) or nature is not None,
            "is_nebula": bool(entry.get("is_nebula")),
        }

    def star_positions(
        self,
        jd: float,
        *,
        filter_mode: str = "highlighted",
        max_magnitude: Optional[float] = None,
    ) -> List[Dict]:
        """Эклиптические позиции звёзд каталога на момент jd."""
        swe.set_ephe_path(self.ephe_path)
        out: List[Dict] = []
        for entry in self._candidate_entries(filter_mode, max_magnitude):
            resolved = self._resolve_star(jd, entry)
            if resolved:
                out.append(resolved)
        out.sort(key=lambda star: star["longitude"])
        return out

    def conjunctions(
        self,
        jd: float,
        objects: List[Dict],
        orb: float = DEFAULT_STAR_ORB,
        stars: Optional[List[Dict]] = None,
    ) -> List[Dict]:
        """
        Соединения звёзд с объектами карты (планеты/углы) в пределах орба.
        objects: список dict с полями name/longitude.
        """
        stars = stars if stars is not None else self.star_positions(jd)
        targets = [o for o in (objects or []) if o.get("longitude") is not None]
        contacts: List[Dict] = []
        for star in stars:
            for obj in targets:
                object_longitude = float(obj["longitude"])
                sep = _sep(star["longitude"], object_longitude)
                if sep <= orb:
                    object_degree = get_degree_in_sign(object_longitude)
                    object_sign = get_zodiac_sign(object_longitude)
                    contacts.append({
                        "star": star["name"],
                        "star_info": star,
                        "nature": star["nature"],
                        "magnitude": star["magnitude"],
                        "object": obj.get("name"),
                        "object_longitude": round(object_longitude, 6),
                        "object_sign": object_sign,
                        "object_degree_in_sign": round(object_degree, 6),
                        "object_degree_in_sign_formatted": format_degree_minutes_seconds(object_degree),
                        "object_position": format_degree_minutes_seconds(object_degree) + " " + object_sign,
                        "orb": round(sep, 4),
                        "star_position": star["degree_in_sign_formatted"] + " " + star["sign"],
                    })
        contacts.sort(key=lambda c: c["orb"])
        return contacts
