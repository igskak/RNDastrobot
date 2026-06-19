"""
Declination service — параллели и контрпараллели (P3, от Ксении).

Аспекты по склонению (а не по долготе):
- Параллель (parallel): два тела с близким склонением в ОДНОМ полушарии
  (оба северные или оба южные). Аналог соединения.
- Контрпараллель (contra-parallel): близкое по модулю склонение в РАЗНЫХ
  полушариях. Аналог оппозиции.

Также отдаёт out-of-bounds (|δ| > наклон эклиптики) — флаг уже считается в
swisseph_engine, здесь только прокидывается, если есть.

Чистая геометрия по уже посчитанным склонениям (БД не нужна). Работает с любыми
объектами, у которых есть поля name/declination.
"""
from __future__ import annotations

from typing import Dict, List

DEFAULT_DECLINATION_ORB = 1.0  # классический орб для параллелей — узкий


def _hemisphere(decl: float) -> str:
    return "north" if decl >= 0.0 else "south"


class DeclinationService:
    """Расчёт параллелей/контрпараллелей по склонению объектов карты."""

    @staticmethod
    def compute_for_objects(objects: List[Dict]) -> List[Dict]:
        """
        Для каждого объекта (name/declination) возвращает склонение, полушарие
        и флаг out-of-bounds (если он есть во входных данных).
        """
        out: List[Dict] = []
        for obj in objects or []:
            decl = obj.get("declination")
            if decl is None:
                continue
            decl = float(decl)
            out.append({
                "name": obj.get("name"),
                "declination": round(decl, 6),
                "hemisphere": _hemisphere(decl),
                "out_of_bounds": bool(obj.get("out_of_bounds", False)),
            })
        return out

    @classmethod
    def find_contacts(
        cls,
        objects: List[Dict],
        orb: float = DEFAULT_DECLINATION_ORB,
    ) -> List[Dict]:
        """
        Контакты по склонению между парами объектов (A != B):
        - parallel: |δa − δb| ≤ orb и одно полушарие;
        - contra_parallel: |δa + δb| ≤ orb (равные по модулю, разные полушария).
        Каждая пара возвращается один раз.
        """
        items = [o for o in (objects or []) if o.get("declination") is not None]
        contacts: List[Dict] = []
        seen = set()
        for i, a in enumerate(items):
            a_decl = float(a["declination"])
            for b in items[i + 1:]:
                if b.get("name") == a.get("name"):
                    continue
                b_decl = float(b["declination"])
                same_hemisphere = (a_decl >= 0.0) == (b_decl >= 0.0)
                parallel_orb = abs(a_decl - b_decl)
                contra_orb = abs(a_decl + b_decl)
                if same_hemisphere and parallel_orb <= orb:
                    kind, sep = "parallel", parallel_orb
                elif (not same_hemisphere) and contra_orb <= orb:
                    kind, sep = "contra_parallel", contra_orb
                else:
                    continue
                key = (frozenset((a.get("name"), b.get("name"))), kind)
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
