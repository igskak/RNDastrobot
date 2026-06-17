from datetime import date, time

import pytest

swe = pytest.importorskip("swisseph")

from app.services.natal_chart_service import NatalChartService


def _service():
    return NatalChartService()


KYIV = dict(latitude=50.45, longitude=30.52)


def _by_name(items):
    return {p["name"]: p for p in items}


def test_natal_chart_defaults_to_tropical():
    svc = _service()
    chart = svc.calculate_natal_chart(
        birth_date=date(1990, 6, 26), birth_time=time(9, 0), timezone="Europe/Kyiv",
        **KYIV,
    )
    assert chart["birth_data"]["zodiac"] == "tropical"
    assert chart["birth_data"]["ayanamsha"] is None


def test_sidereal_natal_chart_shifts_planets_and_nodes_by_ayanamsha():
    svc = _service()
    common = dict(
        birth_date=date(1990, 6, 26), birth_time=time(9, 0), timezone="Europe/Kyiv", **KYIV,
    )
    trop = svc.calculate_natal_chart(**common)
    sid = svc.calculate_natal_chart(zodiac="sidereal", ayanamsha="lahiri", **common)

    assert sid["birth_data"]["zodiac"] == "sidereal"
    assert sid["birth_data"]["ayanamsha"] == "lahiri"

    ayan = svc.swisseph_engine.get_ayanamsha(trop["birth_data"]["julian_day"], "lahiri")

    tp, sp = _by_name(trop["planets"]), _by_name(sid["planets"])
    for name in ("Sun", "Moon", "Saturn"):
        diff = (tp[name]["longitude"] - sp[name]["longitude"]) % 360.0
        assert diff == pytest.approx(ayan, abs=0.02)

    # Nodes (computed tropically) must also be shifted in the sidereal chart.
    t_node = trop["special_points"]["TrueNorthNode"]["longitude"]
    s_node = sid["special_points"]["TrueNorthNode"]["longitude"]
    assert ((t_node - s_node) % 360.0) == pytest.approx(ayan, abs=0.02)


def test_sidereal_angles_shifted():
    svc = _service()
    common = dict(
        birth_date=date(1985, 3, 15), birth_time=time(14, 0), timezone="Europe/Kyiv", **KYIV,
    )
    trop = svc.calculate_natal_chart(**common)
    sid = svc.calculate_natal_chart(zodiac="sidereal", **common)
    ayan = svc.swisseph_engine.get_ayanamsha(trop["birth_data"]["julian_day"], "lahiri")
    diff = (trop["angles"]["ASC"]["longitude"] - sid["angles"]["ASC"]["longitude"]) % 360.0
    assert diff == pytest.approx(ayan, abs=0.02)
