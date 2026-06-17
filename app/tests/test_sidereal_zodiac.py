import pytest

swe = pytest.importorskip("swisseph")

from app.services.swisseph_engine import SwissEphemerisEngine, AYANAMSHA_MODES


def _jd():
    return swe.julday(1990, 6, 26, 9.0, swe.GREG_CAL)


def _by_name(planets):
    return {p["name"]: p for p in planets}


def test_tropical_is_default_and_unchanged():
    engine = SwissEphemerisEngine()
    jd = _jd()
    default = _by_name(engine.calculate_planets(jd))
    explicit = _by_name(engine.calculate_planets(jd, zodiac="tropical"))
    for name in default:
        assert default[name]["longitude"] == pytest.approx(explicit[name]["longitude"])


def test_sidereal_lahiri_is_uniform_shift_near_ayanamsha():
    engine = SwissEphemerisEngine()
    jd = _jd()
    ayan = engine.get_ayanamsha(jd, "lahiri")
    assert 23.0 < ayan < 25.0  # Lahiri ayanamsha ~23.7° around 1990

    trop = _by_name(engine.calculate_planets(jd, zodiac="tropical"))
    sid = _by_name(engine.calculate_planets(jd, zodiac="sidereal", ayanamsha="lahiri"))

    offsets = []
    for name in ("Sun", "Moon", "Mars", "Jupiter", "Saturn"):
        offsets.append((trop[name]["longitude"] - sid[name]["longitude"]) % 360.0)
    # The sidereal shift must be the SAME for every body (uniform rotation)...
    for off in offsets:
        assert off == pytest.approx(offsets[0], abs=1e-6)
    # ...and equal to the ayanamsha (small nutation residual ~14").
    assert offsets[0] == pytest.approx(ayan, abs=0.02)


def test_sidereal_houses_shift_by_ayanamsha():
    engine = SwissEphemerisEngine()
    jd = _jd()
    ayan = engine.get_ayanamsha(jd, "lahiri")
    _, trop_angles = engine.calculate_houses(jd, 50.45, 30.52, "P", zodiac="tropical")
    _, sid_angles = engine.calculate_houses(jd, 50.45, 30.52, "P", zodiac="sidereal", ayanamsha="lahiri")
    diff = (trop_angles["ASC"]["longitude"] - sid_angles["ASC"]["longitude"]) % 360.0
    assert diff == pytest.approx(ayan, abs=0.02)


def test_single_longitude_respects_sidereal():
    engine = SwissEphemerisEngine()
    jd = _jd()
    ayan = engine.get_ayanamsha(jd, "lahiri")
    trop = engine.calculate_planet_longitude(jd, "Sun", zodiac="tropical")
    sid = engine.calculate_planet_longitude(jd, "Sun", zodiac="sidereal", ayanamsha="lahiri")
    assert ((trop - sid) % 360.0) == pytest.approx(ayan, abs=0.02)


def test_all_ayanamsha_modes_resolve():
    engine = SwissEphemerisEngine()
    jd = _jd()
    for name in AYANAMSHA_MODES:
        val = engine.get_ayanamsha(jd, name)
        assert isinstance(val, float)
