"""Regenerate app/tests/fixtures/vedic_oracle.json from PyJHora.

PyJHora (AGPL-3.0) is used here ONLY as an independent reference: its output is recorded as
plain numbers and compared with app/services/vedic_service.py in tests. It is never imported
by the application and must not be added to app/requirements.txt.

Run in a throwaway virtualenv that has PyJHora, pyswisseph, pytz, numpy, geocoder,
timezonefinder, geopy, pandas and python-dateutil installed:

    python app/scripts/vedic_oracle_fixture.py app/tests/fixtures/vedic_oracle.json
"""
import json
import random
import sys

from jhora import const, utils
from jhora.horoscope.dhasa.graha import vimsottari
from jhora.horoscope.match import compatibility
from jhora.panchanga import drik

# PyJHora's planet index -> our lord keys.
LORD_BY_INDEX = {0: "sun", 1: "moon", 2: "mars", 3: "mercury", 4: "jupiter",
                 5: "venus", 6: "saturn", 7: "rahu", 8: "ketu"}


def koota_rows(rng: random.Random):
    pairs = {(g, 1, b, 1) for g in range(27) for b in range(27)}
    while len(pairs) < 2400:
        pairs.add((rng.randrange(27), rng.randrange(1, 5), rng.randrange(27), rng.randrange(1, 5)))
    rows = []
    for g, gp, b, bp in sorted(pairs):
        # PyJHora arguments are 1-based and ordered (boy, girl).
        match = compatibility.Ashtakoota(g + 1, gp, b + 1, bp, method="North")
        score = match.compatibility_score()
        # Its list order: varna, vashya, gana, tara, yoni, maitri, bhakoot, nadi.
        # Vashya is recorded with the AstroYogi table, which is the variant we adopt.
        score[1] = match.vasiya_porutham(use_astroyogi_method=True)[0]
        rows.append([g, gp, b, bp] + [float(x) for x in score[:8]])
    return rows


def birth_rows(rng: random.Random, count: int = 60):
    drik.set_ayanamsa_mode("LAHIRI")
    rows = []
    for _ in range(count):
        year = rng.randrange(1940, 2021)
        month, day = rng.randrange(1, 13), rng.randrange(1, 29)
        hour, minute = rng.randrange(0, 24), rng.randrange(0, 60)
        lat, lon = rng.uniform(8.0, 30.0), rng.uniform(70.0, 88.0)
        place = drik.Place("p", lat, lon, 5.5)
        jd = utils.julian_day_number((year, month, day), (hour, minute, 0))
        nak = drik.nakshatra(jd, place)
        dasha = vimsottari.get_vimsottari_dhasa_bhukthi(
            jd, place, dhasa_level_index=const.MAHA_DHASA_DEPTH.MAHA_DHASA_ONLY)[1]
        rows.append({
            "date": [year, month, day], "time": [hour, minute], "timezone": "Asia/Kolkata",
            "nakshatra": nak[0] - 1, "pada": nak[1],
            "mahadashas": [
                {"lord": LORD_BY_INDEX[row[0][0]], "start": list(row[1][:3]), "years": row[2]}
                for row in dasha
            ],
        })
    return rows


if __name__ == "__main__":
    rng = random.Random(20261026)
    out = {
        "source": "PyJHora (AGPL-3.0), recorded as numbers only; see app/scripts/vedic_oracle_fixture.py",
        "koota_columns": ["groom_nakshatra", "groom_pada", "bride_nakshatra", "bride_pada",
                          "varna", "vashya", "gana", "tara", "yoni", "graha_maitri", "bhakoot", "nadi"],
        "koota": koota_rows(rng),
        "births": birth_rows(rng),
    }
    with open(sys.argv[1], "w", encoding="utf-8") as handle:
        json.dump(out, handle, separators=(",", ":"))
    print("wrote", sys.argv[1], len(out["koota"]), "koota rows", len(out["births"]), "births")
