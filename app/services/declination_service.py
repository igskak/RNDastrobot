"""
Declination service: out-of-bounds points and declination contacts.

Parallel: two bodies have close declinations in the same hemisphere.
Contra-parallel: two bodies have close declination magnitudes in opposite hemispheres.
"""
from __future__ import annotations

from typing import Dict, List, Optional

DEFAULT_DECLINATION_ORB = 1.0


def _hemisphere(declination: float) -> str:
    return "north" if declination >= 0.0 else "south"


def declination_aspect(d1: Optional[float], d2: Optional[float], orb: float) -> Optional[str]:
    """Return declination aspect type for two declinations, or None."""
    if d1 is None or d2 is None:
        return None
    a = float(d1)
    b = float(d2)
    same_hemisphere = (a >= 0.0) == (b >= 0.0)
    if same_hemisphere and abs(a - b) <= orb:
        return "parallel"
    if not same_hemisphere and abs(a + b) <= orb:
        return "contra_parallel"
    return None


class DeclinationService:
    """Compute declination points and contacts for chart objects."""

    @staticmethod
    def compute_for_objects(objects: List[Dict]) -> List[Dict]:
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
        contacts: List[Dict] = []
        items = [obj for obj in (objects or []) if obj.get("declination") is not None]
        seen = set()
        for i, a in enumerate(items):
            a_decl = float(a["declination"])
            for b in items[i + 1:]:
                if b.get("name") == a.get("name"):
                    continue
                b_decl = float(b["declination"])
                kind = declination_aspect(a_decl, b_decl, orb)
                if not kind:
                    continue
                sep = abs(a_decl - b_decl) if kind == "parallel" else abs(a_decl + b_decl)
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
        contacts.sort(key=lambda contact: contact["orb"])
        return contacts

    @classmethod
    def find_declination_aspects(
        cls,
        planets: List[Dict],
        orb: float = DEFAULT_DECLINATION_ORB,
    ) -> List[Dict]:
        """Compatibility shape used by older declination tests."""
        contacts = cls.find_contacts(planets, orb=orb)
        lookup = {
            obj.get("name"): float(obj["declination"])
            for obj in (planets or [])
            if obj.get("name") and obj.get("declination") is not None
        }
        return [
            {
                "planet_1": contact["from"],
                "planet_2": contact["to"],
                "type": contact["kind"],
                "declination_1": round(lookup[contact["from"]], 4),
                "declination_2": round(lookup[contact["to"]], 4),
                "orb": contact["orb"],
            }
            for contact in contacts
        ]
