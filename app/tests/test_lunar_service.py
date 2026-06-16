import pytest

swe = pytest.importorskip("swisseph")

from app.services.lunar_service import LunarService


@pytest.fixture(scope="module")
def lunar():
    return LunarService()


def _jd(y, m, d, h=12.0):
    return swe.julday(y, m, d, h, swe.GREG_CAL)


def test_moon_phase_basic_shape(lunar):
    phase = lunar.moon_phase(_jd(2026, 6, 16))
    assert phase["phase_key"] in {
        "new", "waxing_crescent", "first_quarter", "waxing_gibbous",
        "full", "waning_gibbous", "last_quarter", "waning_crescent",
    }
    assert 0.0 <= phase["illumination"] <= 100.0
    assert 0.0 <= phase["elongation"] < 360.0
    assert phase["moon_sign"]


def test_full_moon_has_high_illumination(lunar):
    # Полнолуние 2026-06-29 ~23:54 UT — освещённость должна быть около 100%.
    phase = lunar.moon_phase(_jd(2026, 6, 30, 0.0))
    assert phase["illumination"] > 97.0
    assert phase["phase_key"] in {"full", "waning_gibbous", "waxing_gibbous"}


def test_upcoming_lunations_alternate_and_detect_known_eclipses(lunar):
    events = lunar.upcoming_lunations(_jd(2026, 6, 16), count=3)
    kinds = [e["kind"] for e in events]
    # Новолуния и полнолуния чередуются.
    for a, b in zip(kinds, kinds[1:]):
        assert a != b

    # Известные затмения августа 2026 должны быть помечены.
    solar = next(e for e in events if e["eclipse"] and e["eclipse"]["type"] == "solar")
    assert "total" in solar["eclipse"]["classes"]
    yy, mm, _, _ = swe.revjul(solar["jd"], swe.GREG_CAL)
    assert (yy, mm) == (2026, 8)

    lunar_ecl = next(e for e in events if e["eclipse"] and e["eclipse"]["type"] == "lunar")
    yy, mm, _, _ = swe.revjul(lunar_ecl["jd"], swe.GREG_CAL)
    assert (yy, mm) == (2026, 8)


def test_void_of_course_shape(lunar):
    voc = lunar.void_of_course(_jd(2026, 6, 16))
    assert isinstance(voc["is_void"], bool)
    assert voc["egress_jd"] > _jd(2026, 6, 16)
    # Когда Луна не VOC, должен быть ближайший аспект до выхода из знака.
    if not voc["is_void"]:
        assert voc["next_aspect"] is not None
        assert voc["next_aspect"]["body"]
