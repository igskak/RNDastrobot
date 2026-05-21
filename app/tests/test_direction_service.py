from datetime import date

import pytest

from app.services.direction_service import (
    DirectionService,
    NAIBOD_KEY,
    TROPICAL_YEAR_DAYS,
)


def test_zodiacal_direction_matches_zet_screenshot_arc_date_only():
    days_elapsed = (date(2026, 5, 20) - date(1968, 10, 27)).days
    age_years = days_elapsed / TROPICAL_YEAR_DAYS

    arc = DirectionService.__new__(DirectionService)._calculate_arc(
        direction_type="zodiacal",
        birth_jd=0,
        age_years=age_years,
    )

    assert arc == pytest.approx(age_years)
    zet_screenshot_arc = 57 + 33 / 60 + 44 / 3600
    assert abs(arc - zet_screenshot_arc) < 2 / 3600


def test_symbolic_is_legacy_alias_for_zodiacal():
    assert DirectionService.normalize_direction_type("symbolic") == "zodiacal"

    service = DirectionService.__new__(DirectionService)
    assert service._calculate_arc("symbolic", birth_jd=0, age_years=12.5) == pytest.approx(12.5)


def test_equatorial_naibod_uses_annual_key_once():
    age_years = 57.56180581785621

    arc = DirectionService.__new__(DirectionService)._calculate_arc(
        direction_type="equatorial",
        birth_jd=0,
        age_years=age_years,
    )

    assert arc == pytest.approx(age_years * NAIBOD_KEY)
    assert arc < age_years
