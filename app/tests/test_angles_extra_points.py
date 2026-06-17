import pytest

swe = pytest.importorskip("swisseph")

from app.services.swisseph_engine import SwissEphemerisEngine


def test_houses_expose_eastpoint_and_antivertex():
    engine = SwissEphemerisEngine()
    jd = swe.julday(1990, 6, 26, 9.0, swe.GREG_CAL)
    _, angles = engine.calculate_houses(jd, 50.45, 30.52, "P")  # Kyiv
    assert "EastPoint" in angles
    assert "AntiVertex" in angles
    for key in ("EastPoint", "AntiVertex"):
        a = angles[key]
        assert 0.0 <= a["longitude"] < 360.0
        assert a["sign"]
        assert a["degree_in_sign_formatted"]


def test_antivertex_opposes_vertex():
    engine = SwissEphemerisEngine()
    jd = swe.julday(1985, 3, 15, 14.0, swe.GREG_CAL)
    _, angles = engine.calculate_houses(jd, 40.0, -74.0, "P")
    vertex = angles["Vertex"]["longitude"]
    antivertex = angles["AntiVertex"]["longitude"]
    assert abs(((antivertex - vertex) % 360) - 180.0) < 1e-6
