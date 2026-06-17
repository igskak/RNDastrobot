import pytest

swe = pytest.importorskip("swisseph")

from app.services.swisseph_engine import SwissEphemerisEngine, ASTEROIDS


def _jd():
    return swe.julday(1990, 6, 26, 9.0, swe.GREG_CAL)


def test_calculate_asteroids_returns_four_bodies():
    engine = SwissEphemerisEngine()
    res = engine.calculate_asteroids(_jd())
    names = {a["name"] for a in res}
    assert names == {"Ceres", "Pallas", "Juno", "Vesta"}
    for a in res:
        assert 0.0 <= a["longitude"] < 360.0
        assert a["sign"]
        assert a["degree_in_sign_formatted"]
        assert isinstance(a["retrograde"], bool)


def test_asteroids_not_in_always_on_planets():
    # Asteroids must stay out of the base PLANETS set so existing charts are
    # unchanged.
    from app.utils.constants import PLANETS
    assert not (set(ASTEROIDS.values()) & set(PLANETS.values()))


def test_asteroids_sidereal_shift():
    engine = SwissEphemerisEngine()
    jd = _jd()
    ayan = engine.get_ayanamsha(jd, "lahiri")
    trop = {a["name"]: a["longitude"] for a in engine.calculate_asteroids(jd, zodiac="tropical")}
    sid = {a["name"]: a["longitude"] for a in engine.calculate_asteroids(jd, zodiac="sidereal", ayanamsha="lahiri")}
    for name in trop:
        assert ((trop[name] - sid[name]) % 360.0) == pytest.approx(ayan, abs=0.02)
