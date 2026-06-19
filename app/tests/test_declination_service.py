import pytest

from app.services.declination_service import DeclinationService


def test_compute_for_objects_shapes_positions():
    objs = [
        {"name": "Sun", "declination": 20.0, "out_of_bounds": False},
        {"name": "Moon", "declination": -24.5, "out_of_bounds": True},
    ]
    res = DeclinationService.compute_for_objects(objs)
    assert res[0]["hemisphere"] == "north"
    assert res[0]["out_of_bounds"] is False
    assert res[1]["hemisphere"] == "south"
    assert res[1]["out_of_bounds"] is True


def test_parallel_same_hemisphere_within_orb():
    objs = [
        {"name": "Sun", "declination": 20.0},
        {"name": "Mars", "declination": 20.5},  # 0.5° apart, both north
    ]
    contacts = DeclinationService.find_contacts(objs, orb=1.0)
    assert len(contacts) == 1
    assert contacts[0]["kind"] == "parallel"
    assert {contacts[0]["from"], contacts[0]["to"]} == {"Sun", "Mars"}
    assert contacts[0]["orb"] == pytest.approx(0.5)


def test_contra_parallel_opposite_hemisphere_equal_magnitude():
    objs = [
        {"name": "Venus", "declination": 18.0},
        {"name": "Saturn", "declination": -18.3},  # opposite hemisphere, |Δ| ~ 0.3
    ]
    contacts = DeclinationService.find_contacts(objs, orb=1.0)
    assert len(contacts) == 1
    assert contacts[0]["kind"] == "contra_parallel"
    assert contacts[0]["orb"] == pytest.approx(0.3, abs=1e-6)


def test_no_contact_when_outside_orb():
    objs = [
        {"name": "Sun", "declination": 20.0},
        {"name": "Mars", "declination": 23.0},   # 3° apart, same hemisphere
        {"name": "Moon", "declination": -15.0},  # contra |Δ| = 5°
    ]
    assert DeclinationService.find_contacts(objs, orb=1.0) == []


def test_each_pair_reported_once():
    objs = [
        {"name": "Sun", "declination": 10.0},
        {"name": "Moon", "declination": 10.2},
        {"name": "Mars", "declination": 10.4},
    ]
    contacts = DeclinationService.find_contacts(objs, orb=1.0)
    keys = [(frozenset((c["from"], c["to"])), c["kind"]) for c in contacts]
    assert len(keys) == len(set(keys))
    # Sun-Moon, Sun-Mars, Moon-Mars all parallel within 1°.
    assert len(contacts) == 3


def test_objects_without_declination_skipped():
    objs = [
        {"name": "Sun", "declination": 12.0},
        {"name": "Vertex"},  # no declination
    ]
    res = DeclinationService.compute_for_objects(objs)
    assert [r["name"] for r in res] == ["Sun"]
    assert DeclinationService.find_contacts(objs, orb=1.0) == []
