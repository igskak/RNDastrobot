import pytest

from app.services.composite_service import CompositeService, circular_midpoint


def test_circular_midpoint_simple():
    assert circular_midpoint(10.0, 50.0) == pytest.approx(30.0)


def test_circular_midpoint_takes_short_arc_across_zero():
    # 350° and 10° → short arc midpoint is 0°, not 180°.
    assert circular_midpoint(350.0, 10.0) == pytest.approx(0.0)
    assert circular_midpoint(10.0, 350.0) == pytest.approx(0.0)


def test_circular_midpoint_is_symmetric():
    assert circular_midpoint(100.0, 200.0) == pytest.approx(circular_midpoint(200.0, 100.0))


def _chart(planets, angles=None):
    return {"planets": planets, "angles": angles or {}}


def test_midpoint_composite_matches_common_planets_only():
    primary = _chart(
        [{"name": "Sun", "longitude": 10.0}, {"name": "Moon", "longitude": 100.0}],
        {"ASC": {"longitude": 0.0}, "MC": {"longitude": 270.0}},
    )
    partner = _chart(
        [{"name": "Sun", "longitude": 50.0}, {"name": "Mars", "longitude": 200.0}],
        {"ASC": {"longitude": 20.0}, "MC": {"longitude": 290.0}},
    )
    comp = CompositeService.midpoint_composite(primary, partner)
    by_name = {p["name"]: p for p in comp["planets"]}
    assert comp["method"] == "midpoint"
    # Only Sun is common.
    assert set(by_name) == {"Sun"}
    assert by_name["Sun"]["longitude"] == pytest.approx(30.0)
    assert by_name["Sun"]["sign"] == "Taurus"  # 30° = Aries/Taurus boundary → Taurus
    assert comp["angles"]["ASC"]["longitude"] == pytest.approx(10.0)
    assert comp["angles"]["MC"]["longitude"] == pytest.approx(280.0)


def test_davison_requires_engine():
    svc = CompositeService(engine=None)
    with pytest.raises(ValueError):
        svc.davison({"birth_data": {}}, {"birth_data": {}})


def test_davison_with_real_engine_returns_midpoint_time():
    swe = pytest.importorskip("swisseph")
    from app.services.swisseph_engine import SwissEphemerisEngine

    svc = CompositeService(engine=SwissEphemerisEngine())
    jd1 = swe.julday(1990, 6, 26, 12.0, swe.GREG_CAL)
    jd2 = swe.julday(1988, 1, 17, 6.0, swe.GREG_CAL)
    primary = {"birth_data": {"julian_day": jd1, "latitude": 50.0, "longitude": 30.0}}
    partner = {"birth_data": {"julian_day": jd2, "latitude": 40.0, "longitude": 10.0}}
    result = svc.davison(primary, partner)
    assert result["method"] == "davison"
    assert result["midpoint_time"]["julian_day"] == pytest.approx((jd1 + jd2) / 2.0)
    assert result["midpoint_time"]["latitude"] == pytest.approx(45.0)
    assert result["midpoint_time"]["longitude"] == pytest.approx(20.0)
    assert len(result["planets"]) > 0
    assert any(p["name"] == "Sun" for p in result["planets"])
