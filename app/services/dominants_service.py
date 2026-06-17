"""
Dominants service — доминанты карты (P3).

Сводный рейтинг «что доминирует» в натальной карте: планеты, знаки, стихии,
кресты (модальности) и дома — по прозрачной балльной системе. Чистая агрегация
над dict-картой (planets + angles), БД не нужна.

Весовая система (классический подход «по важности тела»):
- светила (Sun/Moon) — 3, личные (Mercury/Venus/Mars) — 2, социальные
  (Jupiter/Saturn) — 1.5, высшие/прочие — 1;
- ASC и MC добавляют вес к своим знакам/стихиям/крестам;
- планета на угле (дома 1/4/7/10) получает бонус к «силе планеты».
"""
from __future__ import annotations

from typing import Dict, List, Optional

from app.utils.constants import ZODIAC_SIGNS

_PLANET_WEIGHTS = {
    "Sun": 3.0, "Moon": 3.0,
    "Mercury": 2.0, "Venus": 2.0, "Mars": 2.0,
    "Jupiter": 1.5, "Saturn": 1.5,
    "Uranus": 1.0, "Neptune": 1.0, "Pluto": 1.0, "Chiron": 1.0,
}
_DEFAULT_PLANET_WEIGHT = 1.0

_SIGN_ELEMENT = {
    "Aries": "fire", "Leo": "fire", "Sagittarius": "fire",
    "Taurus": "earth", "Virgo": "earth", "Capricorn": "earth",
    "Gemini": "air", "Libra": "air", "Aquarius": "air",
    "Cancer": "water", "Scorpio": "water", "Pisces": "water",
}
_SIGN_MODE = {
    "Aries": "cardinal", "Cancer": "cardinal", "Libra": "cardinal", "Capricorn": "cardinal",
    "Taurus": "fixed", "Leo": "fixed", "Scorpio": "fixed", "Aquarius": "fixed",
    "Gemini": "mutable", "Virgo": "mutable", "Sagittarius": "mutable", "Pisces": "mutable",
}
_ANGULAR_HOUSES = {1, 4, 7, 10}


def _planet_weight(name: str) -> float:
    return _PLANET_WEIGHTS.get(name, _DEFAULT_PLANET_WEIGHT)


def _ranked(scores: Dict[str, float]) -> List[Dict]:
    return [
        {"key": k, "score": round(v, 3)}
        for k, v in sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
        if v > 0
    ]


class DominantsService:
    """Сводка доминант карты из уже рассчитанных позиций."""

    @classmethod
    def compute(cls, chart: Dict, top_n: int = 5) -> Dict:
        planets = chart.get("planets") or []
        angles = chart.get("angles") or {}

        planet_scores: Dict[str, float] = {}
        sign_scores: Dict[str, float] = {}
        element_scores: Dict[str, float] = {}
        mode_scores: Dict[str, float] = {}
        house_scores: Dict[str, float] = {}

        for p in planets:
            name = p.get("name")
            sign = p.get("sign")
            if not name or not sign:
                continue
            weight = _planet_weight(name)

            # Бонус планете за угловое положение.
            house = p.get("house")
            strength = p.get("strength_score")
            if isinstance(strength, (int, float)):
                p_score = float(strength)
            else:
                p_score = weight
                if house in _ANGULAR_HOUSES:
                    p_score += 1.0
            planet_scores[name] = planet_scores.get(name, 0.0) + p_score

            sign_scores[sign] = sign_scores.get(sign, 0.0) + weight
            el = _SIGN_ELEMENT.get(sign)
            md = _SIGN_MODE.get(sign)
            if el:
                element_scores[el] = element_scores.get(el, 0.0) + weight
            if md:
                mode_scores[md] = mode_scores.get(md, 0.0) + weight
            if house:
                house_scores[str(house)] = house_scores.get(str(house), 0.0) + weight

        # ASC и MC усиливают свои знаки/стихии/кресты.
        for key, w in (("ASC", 2.0), ("MC", 1.5)):
            angle = angles.get(key) or {}
            sign = angle.get("sign")
            if not sign:
                continue
            sign_scores[sign] = sign_scores.get(sign, 0.0) + w
            el = _SIGN_ELEMENT.get(sign)
            md = _SIGN_MODE.get(sign)
            if el:
                element_scores[el] = element_scores.get(el, 0.0) + w
            if md:
                mode_scores[md] = mode_scores.get(md, 0.0) + w

        planets_ranked = _ranked(planet_scores)[:top_n]
        signs_ranked = _ranked(sign_scores)[:top_n]
        houses_ranked = _ranked(house_scores)[:top_n]
        elements_ranked = _ranked(element_scores)
        modes_ranked = _ranked(mode_scores)

        return {
            "planets": planets_ranked,
            "signs": signs_ranked,
            "elements": elements_ranked,
            "modes": modes_ranked,
            "houses": houses_ranked,
            "dominant": {
                "planet": planets_ranked[0]["key"] if planets_ranked else None,
                "sign": signs_ranked[0]["key"] if signs_ranked else None,
                "element": elements_ranked[0]["key"] if elements_ranked else None,
                "mode": modes_ranked[0]["key"] if modes_ranked else None,
            },
        }
