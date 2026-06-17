from datetime import datetime, timezone

import pytest

swe = pytest.importorskip("swisseph")

from app.services.electional_service import ElectionalService


@pytest.fixture(scope="module")
def svc():
    return ElectionalService()


LONDON = (51.5, -0.13)


def test_planetary_hours_available_and_shaped(svc):
    r = svc.planetary_hours(datetime(2026, 6, 17, 12, 0, tzinfo=timezone.utc), *LONDON)
    assert r["available"] is True
    assert len(r["hours"]) == 24
    assert r["current_hour"] is not None


def test_first_day_hour_is_day_ruler(svc):
    # 2026-06-17 is a Wednesday → day ruler Mercury; the first hour after
    # sunrise is always ruled by the day's planet.
    r = svc.planetary_hours(datetime(2026, 6, 17, 12, 0, tzinfo=timezone.utc), *LONDON)
    assert r["day_ruler"] == "Mercury"
    assert r["hours"][0]["ruler"] == "Mercury"
    assert r["hours"][0]["is_day"] is True


def test_hours_follow_chaldean_order(svc):
    r = svc.planetary_hours(datetime(2026, 6, 17, 12, 0, tzinfo=timezone.utc), *LONDON)
    chaldean = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"]
    start = chaldean.index(r["hours"][0]["ruler"])
    expected = [chaldean[(start + i) % 7] for i in range(24)]
    assert [h["ruler"] for h in r["hours"]] == expected


def test_twelve_day_then_twelve_night_hours(svc):
    r = svc.planetary_hours(datetime(2026, 6, 17, 12, 0, tzinfo=timezone.utc), *LONDON)
    assert [h["is_day"] for h in r["hours"]] == [True] * 12 + [False] * 12


def test_lunar_day_after_recent_new_moon(svc):
    # New moon ~2026-06-15 → 2026-06-17 is an early lunar day.
    jd = swe.julday(2026, 6, 17, 12.0, swe.GREG_CAL)
    assert svc.lunar_day(jd) in (2, 3, 4)
