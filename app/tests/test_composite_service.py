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


class _FakeAspectService:
    """Records calls so we can assert phase is only annotated for Davison."""

    def __init__(self):
        self.objects_seen = None
        self.annotate_called = False

    def calculate_aspects_for_objects(self, objects, astrologer_id=None):
        self.objects_seen = objects
        # One synthetic aspect between the first two objects, if present.
        if len(objects) >= 2:
            return [{"planet_1": objects[0]["name"], "planet_2": objects[1]["name"],
                     "aspect_type": "conjunction", "orb": 1.0}]
        return []

    def annotate_aspects_with_phase(self, aspects, objects):
        self.annotate_called = True
        return [{**a, "applying": True} for a in aspects]


def test_aspect_objects_flattens_planets_and_angles():
    comp = {
        "planets": [
            {"name": "Sun", "longitude": 10.0, "type": "planet"},
            {"name": "Moon", "longitude": 100.0, "type": "planet", "speed": 13.0},
            {"name": "Nil", "longitude": None, "type": "planet"},  # dropped
        ],
        "angles": {"ASC": {"name": "ASC", "longitude": 0.0}, "MC": {"longitude": None}},
    }
    objs = CompositeService._aspect_objects(comp)
    by_name = {o["name"]: o for o in objs}
    assert set(by_name) == {"Sun", "Moon", "ASC"}  # null-longitude entries dropped
    assert "speed" not in by_name["Sun"]            # midpoint planet, no speed
    assert by_name["Moon"]["speed"] == 13.0
    assert by_name["ASC"]["type"] == "angle"


def test_attach_aspects_midpoint_omits_phase():
    comp = {"method": "midpoint", "planets": [
        {"name": "Sun", "longitude": 10.0}, {"name": "Moon", "longitude": 12.0}], "angles": {}}
    fake = _FakeAspectService()
    CompositeService.attach_aspects(comp, fake, with_phase=False)
    assert fake.annotate_called is False
    assert comp["aspects"] and "applying" not in comp["aspects"][0]


def test_attach_aspects_davison_adds_phase():
    comp = {"method": "davison", "planets": [
        {"name": "Sun", "longitude": 10.0, "speed": 1.0},
        {"name": "Moon", "longitude": 12.0, "speed": 13.0}], "angles": {}}
    fake = _FakeAspectService()
    CompositeService.attach_aspects(comp, fake, with_phase=True)
    assert fake.annotate_called is True
    assert comp["aspects"][0]["applying"] is True


def test_attach_aspects_handles_none_composite():
    fake = _FakeAspectService()
    assert CompositeService.attach_aspects(None, fake, with_phase=True) is None


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
