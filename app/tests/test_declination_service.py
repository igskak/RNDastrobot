import pytest

from app.services.declination_service import (
    DeclinationService,
    declination_aspect,
)


def test_parallel_same_sign_within_orb():
    assert declination_aspect(23.1, 23.6, 1.0) == "parallel"


def test_contra_parallel_opposite_sign_within_orb():
    assert declination_aspect(23.1, -23.6, 1.0) == "contra_parallel"


def test_none_when_out_of_orb():
    assert declination_aspect(23.0, 10.0, 1.0) is None


def test_none_when_missing():
    assert declination_aspect(None, 10.0, 1.0) is None


def test_find_aspects_pairs_once_and_sorted():
    planets = [
        {"name": "Sun", "declination": 23.0},
        {"name": "Mars", "declination": 23.4},     # parallel Sun (0.4)
        {"name": "Venus", "declination": -23.1},   # contra Sun (0.1), contra Mars (0.3)
        {"name": "Moon", "declination": 5.0},       # no aspect
    ]
    res = DeclinationService.find_declination_aspects(planets, orb=1.0)
    # pairs: Sun-Mars(parallel), Sun-Venus(contra), Mars-Venus(contra)
    keys = {(c["planet_1"], c["planet_2"], c["type"]) for c in res}
    assert ("Sun", "Mars", "parallel") in keys
    assert ("Sun", "Venus", "contra_parallel") in keys
    assert ("Mars", "Venus", "contra_parallel") in keys
    assert all(c["planet_1"] != c["planet_2"] for c in res)
    # sorted ascending by orb
    orbs = [c["orb"] for c in res]
    assert orbs == sorted(orbs)


def test_skips_bodies_without_declination():
    planets = [
        {"name": "Sun", "declination": 23.0},
        {"name": "Fortune"},  # no declination
    ]
    assert DeclinationService.find_declination_aspects(planets) == []
