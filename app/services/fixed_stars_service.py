"""
Fixed stars service — фиксированные звёзды (P1).

Считает эклиптические долготы крупных неподвижных звёзд (через Swiss Ephemeris
fixstar2_ut, каталог sefstars.txt) и находит их соединения с планетами и углами
карты в пределах узкого орба. Природа звёзд (птолемеевы планетные эквиваленты) —
курированная таблица (Робсон).
"""
from __future__ import annotations

from typing import Dict, List, Optional

import swisseph as swe
from loguru import logger

from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds
from app.utils.ephemeris import get_ephemeris_path

# Узкий орб для соединений со звёздами (классически ~1°).
DEFAULT_STAR_ORB = 1.0

# Курированный каталог крупных звёзд: имя для Swiss Ephemeris -> природа.
STAR_CATALOG = {
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


def _sep(a: float, b: float) -> float:
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


class FixedStarsService:
    """Позиции неподвижных звёзд и их соединения с точками карты."""

    def __init__(self, ephe_path: Optional[str] = None):
        self.ephe_path = ephe_path or get_ephemeris_path()
        swe.set_ephe_path(self.ephe_path)

    def star_positions(self, jd: float) -> List[Dict]:
        """Эклиптические позиции звёзд каталога на момент jd."""
        swe.set_ephe_path(self.ephe_path)
        out: List[Dict] = []
        for name, nature in STAR_CATALOG.items():
            try:
                data, star_name, _ = swe.fixstar2_ut(name, jd, swe.FLG_SWIEPH)
            except Exception as exc:
                logger.warning("fixstar2_ut failed for {}: {}", name, str(exc))
                continue
            lon = float(data[0])
            try:
                mag = float(swe.fixstar2_mag(name)[0])
            except Exception:
                mag = None
            deg = get_degree_in_sign(lon)
            out.append({
                "name": name,
                "designation": star_name,
                "nature": nature,
                "magnitude": round(mag, 2) if mag is not None else None,
                "longitude": round(lon, 6),
                "sign": get_zodiac_sign(lon),
                "degree_in_sign": round(deg, 6),
                "degree_in_sign_formatted": format_degree_minutes_seconds(deg),
            })
        return out

    def conjunctions(
        self,
        jd: float,
        objects: List[Dict],
        orb: float = DEFAULT_STAR_ORB,
    ) -> List[Dict]:
        """
        Соединения звёзд с объектами карты (планеты/углы) в пределах орба.
        objects: список dict с полями name/longitude.
        """
        stars = self.star_positions(jd)
        targets = [o for o in (objects or []) if o.get("longitude") is not None]
        contacts: List[Dict] = []
        for star in stars:
            for obj in targets:
                sep = _sep(star["longitude"], float(obj["longitude"]))
                if sep <= orb:
                    contacts.append({
                        "star": star["name"],
                        "nature": star["nature"],
                        "magnitude": star["magnitude"],
                        "object": obj.get("name"),
                        "orb": round(sep, 4),
                        "star_position": star["degree_in_sign_formatted"] + " " + star["sign"],
                    })
        contacts.sort(key=lambda c: c["orb"])
        return contacts
