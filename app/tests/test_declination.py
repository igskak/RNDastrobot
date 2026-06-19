import pytest

swe = pytest.importorskip("swisseph")

from app.services.swisseph_engine import SwissEphemerisEngine


def _jd(y, mo, d, h=12.0):
    return swe.julday(y, mo, d, h, swe.GREG_CAL)


def test_every_planet_has_declination_and_oob_flag():
    engine = SwissEphemerisEngine()
    planets = engine.calculate_planets(_jd(1990, 6, 26, 9.0))
    assert planets
    for p in planets:
        assert "declination" in p
        assert "out_of_bounds" in p
        # Склонение в пределах физически возможного.
        assert -90.0 <= p["declination"] <= 90.0
        assert isinstance(p["out_of_bounds"], bool)


def test_sun_declination_matches_obliquity_at_solstice():
    engine = SwissEphemerisEngine()
    jd = _jd(2020, 6, 21, 0.0)  # летнее солнцестояние ~ макс. склонение Солнца
    planets = engine.calculate_planets(jd)
    sun = next(p for p in planets if p["name"] == "Sun")
    # На солнцестоянии склонение Солнца ≈ наклон эклиптики (~23.4°).
    assert sun["declination"] == pytest.approx(23.43, abs=0.1)
    # Солнце по определению на границе, но не за ней.
    assert sun["out_of_bounds"] is False


def test_declination_is_zodiac_independent():
    engine = SwissEphemerisEngine()
    jd = _jd(1990, 6, 26, 9.0)
    trop = {p["name"]: p["declination"] for p in engine.calculate_planets(jd, zodiac="tropical")}
    sid = {p["name"]: p["declination"]
           for p in engine.calculate_planets(jd, zodiac="sidereal", ayanamsha="lahiri")}
    for name in trop:
        # Склонение — экваториальная величина, не зависит от выбора зодиака.
        assert trop[name] == pytest.approx(sid[name], abs=1e-6)


def test_moon_can_go_out_of_bounds():
    engine = SwissEphemerisEngine()
    # Луна достигает экстремальных склонений (>23.5°) в эпохи большого
    # лунного стояния; 2006 — близко к major standstill.
    found_oob = False
    for d in range(1, 29):
        planets = engine.calculate_planets(_jd(2006, 9, d, 0.0))
        moon = next(p for p in planets if p["name"] == "Moon")
        if moon["out_of_bounds"]:
            assert abs(moon["declination"]) > 23.4
            found_oob = True
            break
    assert found_oob, "Moon expected to be out-of-bounds during 2006 standstill window"
