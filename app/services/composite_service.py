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


def _jd_to_utc(jd: float) -> Dict:
    """Julian Day → human UTC date/time for the Davison mean moment.

    Returns {date_utc: 'YYYY-MM-DD', time_utc: 'HH:MM'}. Best-effort: if
    swisseph is unavailable we return an empty dict so the caller degrades.
    """
    try:
        import swisseph as swe
    except ImportError:  # pragma: no cover - swisseph present in all runtimes
        return {}
    year, month, day, hour = swe.revjul(jd, swe.GREG_CAL)
    h = int(hour)
    m = int(round((hour - h) * 60.0))
    if m == 60:  # rounding spillover
        h, m = (h + 1) % 24, 0
    return {
        "date_utc": f"{int(year):04d}-{int(month):02d}-{int(day):02d}",
        "time_utc": f"{h:02d}:{m:02d}",
    }


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

    @staticmethod
    def _index_houses_by_number(items: List[Dict]) -> Dict[int, Dict]:
        out: Dict[int, Dict] = {}
        for it in items or []:
            try:
                number = int(it.get("number"))
            except (TypeError, ValueError):
                continue
            if 1 <= number <= 12 and it.get("longitude") is not None:
                out[number] = it
        return out

    @classmethod
    def midpoint_composite(cls, primary_chart: Dict, partner_chart: Dict) -> Dict:
        """
        Midpoint-композит: круговые средние долгот общих планет, домов и углов.

        Дома midpoint-композита считаются по одноимённым куспидам 1..12 уже
        рассчитанных исходных карт. Поэтому выбранная система домов применяется
        к исходным картам до вызова этого метода.
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

        p_houses = cls._index_houses_by_number(primary_chart.get("houses"))
        q_houses = cls._index_houses_by_number(partner_chart.get("houses"))
        houses: List[Dict] = []
        for number in range(1, 13):
            ph = p_houses.get(number) or {}
            qh = q_houses.get(number) or {}
            if ph.get("longitude") is None or qh.get("longitude") is None:
                continue
            mid = circular_midpoint(float(ph["longitude"]), float(qh["longitude"]))
            house = _position_payload(f"House {number}", mid, type_="house")
            house["number"] = number
            houses.append(house)

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

        if angles.get("ASC") and "DSC" not in angles:
            angles["DSC"] = _position_payload(
                "DSC", (float(angles["ASC"]["longitude"]) + 180.0) % 360.0, type_="angle"
            )
        if angles.get("MC") and "IC" not in angles:
            angles["IC"] = _position_payload(
                "IC", (float(angles["MC"]["longitude"]) + 180.0) % 360.0, type_="angle"
            )

        return {"method": "midpoint", "planets": planets, "houses": houses, "angles": angles}

    # --- aspects --------------------------------------------------------

    @staticmethod
    def _aspect_objects(composite: Dict) -> List[Dict]:
        """Flatten a composite dict into the {name,longitude,type,speed?} objects
        the aspect engine expects. Midpoint planets carry no speed; Davison do."""
        objs: List[Dict] = []
        for p in composite.get("planets") or []:
            if p.get("longitude") is None:
                continue
            obj = {
                "name": p.get("name"),
                "longitude": float(p["longitude"]),
                "type": p.get("type", "planet"),
            }
            if p.get("speed") is not None:
                obj["speed"] = float(p["speed"])
            objs.append(obj)
        for key, angle in (composite.get("angles") or {}).items():
            if not angle or angle.get("longitude") is None:
                continue
            objs.append({
                "name": angle.get("name", key),
                "longitude": float(angle["longitude"]),
                "type": "angle",
            })
        return objs

    @classmethod
    def attach_aspects(
        cls,
        composite: Optional[Dict],
        aspect_service,
        *,
        with_phase: bool,
        astrologer_id=None,
    ) -> Optional[Dict]:
        """Compute in-composite aspects and attach them as composite["aspects"].

        with_phase: Davison has real planet speeds, so applying/separating is
        meaningful. Midpoint has no speeds, so we omit the phase entirely rather
        than emit a fabricated one (see D5).
        """
        if not composite:
            return composite
        objects = cls._aspect_objects(composite)
        aspects = aspect_service.calculate_aspects_for_objects(
            objects, astrologer_id=astrologer_id
        )
        if with_phase:
            aspects = aspect_service.annotate_aspects_with_phase(aspects, objects)
        composite["aspects"] = aspects
        return composite

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
                "latitude": round(mean_lat, 4),
                "longitude": round(mean_lon, 4),
                **_jd_to_utc(mean_jd),
            },
            "planets": planets,
            "houses": houses,
            "angles": angles,
        }
