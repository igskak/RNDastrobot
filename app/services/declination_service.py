"""
Declination service — деклинационные аспекты (параллели / контрпараллели).

Параллель: два тела с близкими склонениями одного знака (|d1 - d2| <= орб).
Контрпараллель: близкие по модулю склонения разных знаков (|d1 + d2| <= орб).
Чистая геометрия над склонениями (поле declination на планетах).
"""
from __future__ import annotations

from typing import Dict, List, Optional

DEFAULT_DECLINATION_ORB = 1.0  # классический орб для параллелей — узкий


def declination_aspect(d1: Optional[float], d2: Optional[float], orb: float) -> Optional[str]:
    """Тип деклинационного аспекта между двумя склонениями, либо None."""
    if d1 is None or d2 is None:
        return None
    if abs(d1 - d2) <= orb:
        return "parallel"
    if abs(d1 + d2) <= orb:
        return "contra_parallel"
    return None


class DeclinationService:
    """Расчёт параллелей/контрпараллелей среди тел с известным склонением."""

    @staticmethod
    def find_declination_aspects(
        planets: List[Dict],
        orb: float = DEFAULT_DECLINATION_ORB,
    ) -> List[Dict]:
        """
        Все деклинационные аспекты между планетами (по полю 'declination').
        Каждая пара возвращается один раз; результат отсортирован по орбу.
        """
        bodies = [
            p for p in (planets or [])
            if p.get("name") and p.get("declination") is not None
        ]
        out: List[Dict] = []
        for i in range(len(bodies)):
            for j in range(i + 1, len(bodies)):
                a, b = bodies[i], bodies[j]
                d1, d2 = float(a["declination"]), float(b["declination"])
                kind = declination_aspect(d1, d2, orb)
                if not kind:
                    continue
                gap = abs(d1 - d2) if kind == "parallel" else abs(d1 + d2)
                out.append({
                    "planet_1": a["name"],
                    "planet_2": b["name"],
                    "type": kind,
                    "declination_1": round(d1, 4),
                    "declination_2": round(d2, 4),
                    "orb": round(gap, 4),
                })
        out.sort(key=lambda c: c["orb"])
        return out
