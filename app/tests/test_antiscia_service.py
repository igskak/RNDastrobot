import pytest

from app.services.antiscia_service import (
    AntisciaService,
    antiscion,
    contra_antiscion,
)


def test_antiscion_mirrors_about_cancer_capricorn_axis():
    # 0° Cancer (90°) and 0° Capricorn (270°) are on the axis → map to themselves.
    assert antiscion(90.0) == pytest.approx(90.0)
    assert antiscion(270.0) == pytest.approx(270.0)
    # Gemini 15° (75°) ↔ Cancer 15° (105°).
    assert antiscion(75.0) == pytest.approx(105.0)
    # Aries 10° (10°) ↔ Virgo 20° (170°).
    assert antiscion(10.0) == pytest.approx(170.0)


def test_contra_antiscion_is_antiscion_plus_180():
    for lon in (0.0, 10.0, 75.0, 200.0, 359.0):
        assert contra_antiscion(lon) == pytest.approx((antiscion(lon) + 180.0) % 360.0)


def test_antiscion_is_involution():
    for lon in (10.0, 75.0, 123.4, 300.0):
        assert antiscion(antiscion(lon)) == pytest.approx(lon)


def test_compute_for_objects_shapes_positions():
    objs = [{"name": "Sun", "longitude": 75.0}]
    res = AntisciaService.compute_for_objects(objs)
    assert len(res) == 1
    assert res[0]["antiscion"]["sign"] == "Cancer"
    assert res[0]["antiscion"]["longitude"] == pytest.approx(105.0)
    assert res[0]["contra_antiscion"]["longitude"] == pytest.approx(285.0)


def test_find_contacts_detects_antiscion_conjunction():
    # Sun at 75°, Moon at 105.5° → Sun's antiscion (105°) conjuncts Moon within orb.
    objs = [
        {"name": "Sun", "longitude": 75.0},
        {"name": "Moon", "longitude": 105.5},
        {"name": "Mars", "longitude": 200.0},
    ]
    contacts = AntisciaService.find_contacts(objs, orb=1.0)
    assert any(
        c["kind"] == "antiscion" and {c["from"], c["to"]} == {"Sun", "Moon"}
        for c in contacts
    )
    # Each pair/kind only once.
    keys = [(frozenset((c["from"], c["to"])), c["kind"]) for c in contacts]
    assert len(keys) == len(set(keys))


def test_find_contacts_respects_orb():
    objs = [
        {"name": "Sun", "longitude": 75.0},
        {"name": "Moon", "longitude": 108.0},  # 3° from Sun's antiscion
    ]
    assert AntisciaService.find_contacts(objs, orb=1.0) == []
    assert len(AntisciaService.find_contacts(objs, orb=3.5)) == 1
