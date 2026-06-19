import pytest

from app.services.declination_service import (
    DeclinationService,
    declination_aspect,
)


def test_declination_aspect_parallel_same_hemisphere_within_orb():
    assert declination_aspect(23.1, 23.6, 1.0) == "parallel"


def test_declination_aspect_contra_parallel_opposite_hemisphere_within_orb():
    assert declination_aspect(23.1, -23.6, 1.0) == "contra_parallel"


def test_declination_aspect_none_when_out_of_orb_or_missing():
    assert declination_aspect(23.0, 10.0, 1.0) is None
    assert declination_aspect(None, 10.0, 1.0) is None


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


def test_find_contacts_parallel_same_hemisphere_within_orb():
    objs = [
        {"name": "Sun", "declination": 20.0},
        {"name": "Mars", "declination": 20.5},
    ]
    contacts = DeclinationService.find_contacts(objs, orb=1.0)
    assert len(contacts) == 1
    assert contacts[0]["kind"] == "parallel"
    assert {contacts[0]["from"], contacts[0]["to"]} == {"Sun", "Mars"}
    assert contacts[0]["orb"] == pytest.approx(0.5)


def test_find_contacts_contra_parallel_opposite_hemisphere_equal_magnitude():
    objs = [
        {"name": "Venus", "declination": 18.0},
        {"name": "Saturn", "declination": -18.3},
    ]
    contacts = DeclinationService.find_contacts(objs, orb=1.0)
    assert len(contacts) == 1
    assert contacts[0]["kind"] == "contra_parallel"
    assert contacts[0]["orb"] == pytest.approx(0.3, abs=1e-6)


def test_find_contacts_pairs_once_and_sorted():
    objs = [
        {"name": "Sun", "declination": 23.0},
        {"name": "Mars", "declination": 23.4},
        {"name": "Venus", "declination": -23.1},
        {"name": "Moon", "declination": 5.0},
    ]
    contacts = DeclinationService.find_contacts(objs, orb=1.0)
    keys = [(frozenset((c["from"], c["to"])), c["kind"]) for c in contacts]
    assert len(keys) == len(set(keys))
    assert [c["orb"] for c in contacts] == sorted(c["orb"] for c in contacts)
    assert len(contacts) == 3


def test_find_declination_aspects_compatibility_shape():
    planets = [
        {"name": "Sun", "declination": 23.0},
        {"name": "Mars", "declination": 23.4},
        {"name": "Venus", "declination": -23.1},
        {"name": "Moon", "declination": 5.0},
    ]
    res = DeclinationService.find_declination_aspects(planets, orb=1.0)
    keys = {(c["planet_1"], c["planet_2"], c["type"]) for c in res}
    assert ("Sun", "Mars", "parallel") in keys
    assert ("Sun", "Venus", "contra_parallel") in keys
    assert ("Mars", "Venus", "contra_parallel") in keys


def test_objects_without_declination_skipped():
    objs = [
        {"name": "Sun", "declination": 12.0},
        {"name": "Vertex"},
    ]
    assert [r["name"] for r in DeclinationService.compute_for_objects(objs)] == ["Sun"]
    assert DeclinationService.find_contacts(objs, orb=1.0) == []
    assert DeclinationService.find_declination_aspects(objs, orb=1.0) == []
