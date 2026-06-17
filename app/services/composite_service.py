"""
Composite service — композитные карты двух людей (P3).

Две техники:
- Midpoint composite: для каждой общей точки берём круговую среднюю (по короткой
  дуге) долгот двух карт. Чистая геометрия, БД не нужна.
- Davison (relationship chart): реальная карта на среднее время и среднюю
  географию рождения двух людей (через Swiss Ephemeris).

Работает на dict-картах формы calculate_natal_chart / get_natal_chart_from_db.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds


def circular_midpoint(a: float, b: float) -> float:
    """Средняя точка двух долгот по короткой дуге, нормализованная в [0, 360)."""
    diff = ((b - a + 180.0) % 360.0) - 180.0  # знаковая кратчайшая дуга a→b
    return (a + diff / 2.0) % 360.0


def _position_payload(name: str, longitude: float, *, type_: str) -> Dict:
    deg = get_degree_in_sign(longitude)
    return {
        "name": name,
        "type": type_,
        "longitude": round(longitude, 6),
        "sign": get_zodiac_sign(longitude),
        "degree_in_sign": round(deg, 6),
        "degree_in_sign_formatted": format_degree_minutes_seconds(deg),
    }


class CompositeService:
    """Midpoint-композит (геометрия) и Davison (через движок эфемерид)."""

    def __init__(self, engine=None):
        # engine: SwissEphemerisEngine — нужен только для Davison.
        self._engine = engine

    # --- midpoint composite --------------------------------------------

    @staticmethod
    def _index_by_name(items: List[Dict]) -> Dict[str, Dict]:
        out: Dict[str, Dict] = {}
        for it in items or []:
            name = it.get("name")
            if name and it.get("longitude") is not None:
                out[name] = it
        return out

    @classmethod
    def midpoint_composite(cls, primary_chart: Dict, partner_chart: Dict) -> Dict:
        """
        Midpoint-композит: круговые средние долгот общих планет и углов (ASC/MC).
        """
        p_planets = cls._index_by_name(primary_chart.get("planets"))
        q_planets = cls._index_by_name(partner_chart.get("planets"))
        planets: List[Dict] = []
        for name in p_planets:
            if name not in q_planets:
                continue
            mid = circular_midpoint(
                float(p_planets[name]["longitude"]),
                float(q_planets[name]["longitude"]),
            )
            planets.append(_position_payload(name, mid, type_="planet"))

        p_angles = primary_chart.get("angles") or {}
        q_angles = partner_chart.get("angles") or {}
        angles: Dict[str, Dict] = {}
        for key in ("ASC", "MC"):
            pa = p_angles.get(key) or {}
            qa = q_angles.get(key) or {}
            if pa.get("longitude") is None or qa.get("longitude") is None:
                continue
            mid = circular_midpoint(float(pa["longitude"]), float(qa["longitude"]))
            angles[key] = _position_payload(key, mid, type_="angle")

        return {"method": "midpoint", "planets": planets, "angles": angles}

    # --- Davison --------------------------------------------------------

    def davison(
        self,
        primary_chart: Dict,
        partner_chart: Dict,
        house_system: str = "P",
    ) -> Dict:
        """
        Davison: карта на среднее время (среднее JD) и среднюю географию рождения.

        Замечание: средняя долгота берётся простым арифметическим средним —
        для пар по разные стороны антимеридиана (±180°) это приближение.
        """
        if self._engine is None:
            raise ValueError("Davison requires a Swiss Ephemeris engine instance")

        pb = primary_chart.get("birth_data") or {}
        qb = partner_chart.get("birth_data") or {}
        for src in (pb, qb):
            if src.get("julian_day") is None or src.get("latitude") is None or src.get("longitude") is None:
                raise ValueError("Both charts need birth_data with julian_day/latitude/longitude")

        mean_jd = (float(pb["julian_day"]) + float(qb["julian_day"])) / 2.0
        mean_lat = (float(pb["latitude"]) + float(qb["latitude"])) / 2.0
        mean_lon = (float(pb["longitude"]) + float(qb["longitude"])) / 2.0

        planets = self._engine.calculate_planets(mean_jd)
        houses, angles = self._engine.calculate_houses(mean_jd, mean_lat, mean_lon, house_system)

        return {
            "method": "davison",
            "midpoint_time": {
                "julian_day": mean_jd,
                "latitude": mean_lat,
                "longitude": mean_lon,
            },
            "planets": planets,
            "houses": houses,
            "angles": angles,
        }
