"""
Antiscia service — антисы и контрантисы (P3).

Антис (antiscion) — точка, симметричная долготе относительно оси солнцестояний
(0° Рака / 0° Козерога): antiscion = (180 - L) mod 360.
Контрантис (contra-antiscion) — симметрия относительно оси равноденствий
(0° Овна / 0° Весов): contra = (360 - L) mod 360 = antiscion + 180.

Чистая геометрия (БД не нужна). Также детектирует контакты: соединение антиса/
контрантиса одного объекта с долготой другого в пределах орба.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from app.utils.constants import get_zodiac_sign, get_degree_in_sign, format_degree_minutes_seconds

DEFAULT_ANTISCIA_ORB = 1.0  # классический орб для антисов — узкий


def antiscion(longitude: float) -> float:
    """Антис: зеркало относительно оси Рак/Козерог."""
    return (180.0 - longitude) % 360.0


def contra_antiscion(longitude: float) -> float:
    """Контрантис: зеркало относительно оси Овен/Весы."""
    return (360.0 - longitude) % 360.0


def _point(longitude: float) -> Dict:
    deg = get_degree_in_sign(longitude)
    return {
        "longitude": round(longitude, 6),
        "sign": get_zodiac_sign(longitude),
        "degree_in_sign": round(deg, 6),
        "degree_in_sign_formatted": format_degree_minutes_seconds(deg),
    }


def _sep(a: float, b: float) -> float:
    """Кратчайшее угловое расстояние между двумя долготами (0..180)."""
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


class AntisciaService:
    """Расчёт антисов/контрантисов и их контактов с объектами карты."""

    @staticmethod
    def compute_for_objects(objects: List[Dict]) -> List[Dict]:
        """
        Для каждого объекта (с полями name/longitude) возвращает его антис и
        контрантис как позиции (sign/degree).
        """
        out: List[Dict] = []
        for obj in objects or []:
            lon = obj.get("longitude")
            if lon is None:
                continue
            lon = float(lon)
            out.append({
                "name": obj.get("name"),
                "longitude": round(lon, 6),
                "antiscion": _point(antiscion(lon)),
                "contra_antiscion": _point(contra_antiscion(lon)),
            })
        return out

    @classmethod
    def find_contacts(
        cls,
        objects: List[Dict],
        orb: float = DEFAULT_ANTISCIA_ORB,
    ) -> List[Dict]:
        """
        Контакты антисов: соединение антиса/контрантиса объекта A с долготой
        объекта B (A != B) в пределах орба. Каждая пара возвращается один раз.
        """
        items = [o for o in (objects or []) if o.get("longitude") is not None]
        contacts: List[Dict] = []
        seen = set()
        for a in items:
            a_lon = float(a["longitude"])
            anti = antiscion(a_lon)
            contra = contra_antiscion(a_lon)
            for b in items:
                if b is a or b.get("name") == a.get("name"):
                    continue
                b_lon = float(b["longitude"])
                for kind, point_lon in (("antiscion", anti), ("contra_antiscion", contra)):
                    sep = _sep(point_lon, b_lon)
                    if sep <= orb:
                        key = frozenset((a.get("name"), b.get("name"))) , kind
                        if key in seen:
                            continue
                        seen.add(key)
                        contacts.append({
                            "kind": kind,
                            "from": a.get("name"),
                            "to": b.get("name"),
                            "orb": round(sep, 4),
                        })
        return contacts
