"""
Golden chart fixtures for the analysis-correctness eval.

A fixed, realistic-ish natal chart with KNOWN placements so analyze() outputs can
be asserted against hand-computed expectations. Deterministic — no LLM, no DB.
"""

# name, sign, house, dignity, speed (deg/day), retrograde(0/1)
GOLDEN_PLANETS = [
    {"name": "Sun", "sign": "Leo", "house": 5, "dignity": "domicile", "speed": 0.98, "retrograde": 0},
    {"name": "Moon", "sign": "Cancer", "house": 4, "dignity": "domicile", "speed": 13.2, "retrograde": 0},
    {"name": "Mercury", "sign": "Leo", "house": 5, "dignity": "neutral", "speed": 1.20, "retrograde": 0},
    {"name": "Venus", "sign": "Libra", "house": 7, "dignity": "domicile", "speed": 1.10, "retrograde": 0},
    {"name": "Mars", "sign": "Aries", "house": 1, "dignity": "domicile", "speed": 0.60, "retrograde": 0},
    {"name": "Jupiter", "sign": "Sagittarius", "house": 9, "dignity": "domicile", "speed": 0.08, "retrograde": 0},
    {"name": "Saturn", "sign": "Capricorn", "house": 10, "dignity": "domicile", "speed": 0.03, "retrograde": 0},
    {"name": "Pluto", "sign": "Scorpio", "house": 8, "dignity": "domicile", "speed": -0.01, "retrograde": 1},
]


class GoldenDataset:
    """Minimal ChartDataset stand-in: serves the golden planets table + a hash."""

    def table(self, name):
        return [dict(p) for p in GOLDEN_PLANETS] if name == "planets" else []

    def provenance_hash(self):
        return "golden"
