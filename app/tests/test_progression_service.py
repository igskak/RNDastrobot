from datetime import date, time

import pytest
import swisseph as swe

from app.services.progression_service import ProgressionService, TROPICAL_YEAR_DAYS


def _julian_day(year, month, day, hour_decimal):
    return swe.julday(year, month, day, hour_decimal, swe.GREG_CAL)


def test_progressed_jd_preserves_legacy_date_only_behavior():
    birth_jd = _julian_day(1968, 10, 27, 18 + 49 / 60)
    service = ProgressionService.__new__(ProgressionService)

    progressed_jd = service.calculate_progressed_jd(
        birth_jd=birth_jd,
        birth_date=date(1968, 10, 27),
        target_date=date(2026, 5, 20),
    )

    expected_age_years = (date(2026, 5, 20) - date(1968, 10, 27)).days / TROPICAL_YEAR_DAYS
    assert progressed_jd == pytest.approx(birth_jd + expected_age_years)


def test_progressed_jd_uses_exact_target_time_for_zet_style_projection():
    birth_jd = _julian_day(1968, 10, 27, 18 + 49 / 60)
    service = ProgressionService.__new__(ProgressionService)

    progressed_jd = service.calculate_progressed_jd(
        birth_jd=birth_jd,
        birth_date=date(1968, 10, 27),
        target_date=date(2026, 5, 20),
        target_time=time(22, 41, 6),
        timezone="Etc/GMT-1",
    )

    year, month, day, hour_decimal = swe.revjul(progressed_jd, swe.GREG_CAL)
    assert (year, month, day) == (1968, 12, 24)
    assert hour_decimal == pytest.approx(8 + 18 / 60 + 28 / 3600, abs=1 / 3600)


def test_progressed_jd_requires_timezone_when_time_is_present():
    service = ProgressionService.__new__(ProgressionService)

    with pytest.raises(ValueError, match="timezone is required"):
        service.calculate_progressed_jd(
            birth_jd=2440157.2840277776,
            birth_date=date(1968, 10, 27),
            target_date=date(2026, 5, 20),
            target_time=time(22, 41, 6),
        )
