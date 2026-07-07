import pytest

swe = pytest.importorskip("swisseph")

from app.services.fixed_stars_service import FixedStarsService, STAR_CATALOG


def _jd():
    return swe.julday(1990, 6, 26, 9.0, swe.GREG_CAL)


@pytest.fixture(scope="module")
def svc():
    return FixedStarsService()


def test_all_catalog_stars_resolve(svc):
    pos = svc.star_positions(_jd())
    assert len(pos) == len(STAR_CATALOG)
    for p in pos:
        assert 0.0 <= p["longitude"] < 360.0
        assert p["sign"]
        assert p["nature"]


def test_regulus_in_leo_virgo_region(svc):
    pos = {p["name"]: p for p in svc.star_positions(_jd())}
    # Regulus sits at ~29-30° Leo in this era.
    assert pos["Regulus"]["sign"] in ("Leo", "Virgo")


def test_named_catalog_filter_includes_achernar(svc):
    names = {p["name"] for p in svc.star_positions(_jd(), filter_mode="named", max_magnitude=0.6)}
    assert "Achernar" in names


def test_conjunction_detected_within_orb(svc):
    jd = _jd()
    regulus = next(p for p in svc.star_positions(jd) if p["name"] == "Regulus")
    objs = [{"name": "Sun", "longitude": regulus["longitude"] + 0.3}]
    contacts = svc.conjunctions(jd, objs, orb=1.0)
    assert any(c["star"] == "Regulus" and c["object"] == "Sun" for c in contacts)
    contact = next(c for c in contacts if c["star"] == "Regulus" and c["object"] == "Sun")
    assert contact["star_info"]["name"] == "Regulus"
    assert contact["object_position"]


def test_orb_respected(svc):
    jd = _jd()
    regulus = next(p for p in svc.star_positions(jd) if p["name"] == "Regulus")
    objs = [{"name": "Sun", "longitude": regulus["longitude"] + 2.5}]
    assert svc.conjunctions(jd, objs, orb=1.0) == []
    assert len(svc.conjunctions(jd, objs, orb=3.0)) >= 1


def test_empty_objects(svc):
    assert svc.conjunctions(_jd(), [], orb=1.0) == []
