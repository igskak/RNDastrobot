from datetime import date

import pytest

from app.services.profections_service import ProfectionsService


def test_age_zero_profects_first_house_to_ascendant():
    # Within the first year of life → 1st house, rising sign, its lord.
    r = ProfectionsService.profections("Aries", date(2020, 1, 1), date(2020, 6, 1))
    assert r["age"] == 0
    assert r["annual"]["house"] == 1
    assert r["annual"]["sign"] == "Aries"
    assert r["annual"]["lord"] == "Mars"


def test_annual_profection_advances_one_sign_per_year():
    # Age 3 with Aries rising → 4th house, Cancer, lord Moon.
    r = ProfectionsService.profections("Aries", date(2000, 1, 1), date(2003, 6, 1))
    assert r["age"] == 3
    assert r["annual"]["house"] == 4
    assert r["annual"]["sign"] == "Cancer"
    assert r["annual"]["lord"] == "Moon"


def test_twelfth_year_returns_to_first_house():
    r = ProfectionsService.profections("Leo", date(2000, 1, 1), date(2012, 6, 1))
    assert r["age"] == 12
    assert r["annual"]["house"] == 1
    assert r["annual"]["sign"] == "Leo"
    assert r["annual"]["lord"] == "Sun"


def test_birthday_boundary_counts_completed_years():
    # Target exactly on the birthday → that year is completed.
    r = ProfectionsService.profections("Aries", date(2000, 5, 10), date(2010, 5, 10))
    assert r["age"] == 10
    # Day before → one fewer year.
    r2 = ProfectionsService.profections("Aries", date(2000, 5, 10), date(2010, 5, 9))
    assert r2["age"] == 9


def test_monthly_profection_starts_on_annual_sign():
    # Just after the birthday → first profection month = the annual sign.
    r = ProfectionsService.profections("Aries", date(2000, 1, 1), date(2003, 1, 2))
    assert r["monthly"]["sign"] == r["annual"]["sign"]
    assert r["monthly"]["month_index"] == 1


def test_leap_day_birth_does_not_crash():
    r = ProfectionsService.profections("Pisces", date(2000, 2, 29), date(2023, 3, 1))
    assert r["annual"]["sign"]
    assert r["monthly"]["month_index"] in range(1, 13)
