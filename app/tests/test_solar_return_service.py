"""Тесты момента соляра (Solar Return).

Фокус — корректность поиска момента возвращения Солнца на натальную позицию,
включая граничный случай рождённых в самом начале января (см.
SolarReturnService.find_solar_return_moment).
"""
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
import swisseph as swe

from app.services.solar_return_service import SolarReturnService
from app.utils.ephemeris import get_ephemeris_path


@pytest.fixture(scope="module")
def service() -> SolarReturnService:
    return SolarReturnService(db_session=MagicMock(), ephe_path=get_ephemeris_path())


def _sun_longitude(service: SolarReturnService, jd: float) -> float:
    sun = next(p for p in service.swisseph_engine.calculate_planets(jd) if p["name"] == "Sun")
    return sun["longitude"]


def _ymd(jd: float):
    y, m, d, _ = swe.revjul(jd)
    return y, m, d


def test_solar_moment_returns_sun_to_natal_longitude(service):
    # Контроль: для середины года момент соляра попадает на долготу натального Солнца.
    natal_sun = _sun_longitude(service, swe.julday(2000, 6, 15, 12.0))
    jd_sr = service.find_solar_return_moment(natal_sun, 2025, birth_month=6, birth_day=15)
    assert _sun_longitude(service, jd_sr) == pytest.approx(natal_sun, abs=1e-4)
    assert _ymd(jd_sr) == (2025, 6, 15)


def test_january_first_native_is_not_off_by_a_year(service):
    # Рождённый 1 января: на 1 янв целевого года Солнце уже прошло натальную
    # долготу, поэтому старт с 1 января цеплял декабрьский возврат (соляр уезжал
    # на год вперёд). Якорь на дне рождения возвращает корректный момент.
    natal_jd = swe.julday(2000, 1, 1, 0.5)
    natal_sun = _sun_longitude(service, natal_jd)

    anchored = service.find_solar_return_moment(natal_sun, 2024, birth_month=1, birth_day=1)
    # Истинный возврат к дню рождения 2024 года приходится на конец дек. 2023 (UT).
    assert _ymd(anchored) == (2023, 12, 31)
    assert _sun_longitude(service, anchored) == pytest.approx(natal_sun, abs=1e-4)

    # Прежнее поведение (старт с 1 января) — для контраста: уезжает на год вперёд.
    legacy = service.find_solar_return_moment(natal_sun, 2024)
    assert _ymd(legacy)[0] == 2024 and _ymd(legacy)[1] == 12


def test_consecutive_years_advance_by_about_one_year(service):
    # Соседние соляры идут монотонно и отстоят примерно на тропический год.
    natal_sun = _sun_longitude(service, swe.julday(1990, 3, 21, 8.0))
    prev = service.find_solar_return_moment(natal_sun, 2024, birth_month=3, birth_day=21)
    cur = service.find_solar_return_moment(natal_sun, 2025, birth_month=3, birth_day=21)
    assert 360.0 < (cur - prev) < 370.0


def test_birth_month_day_resolved_from_context_date_string():
    # Без типизированного birth_date месяц/день берутся из ISO-строки birth_data.
    ctx = SimpleNamespace(birth_date=None, birth_data={"date": "2000-01-01"})
    assert SolarReturnService._birth_month_day(ctx) == (1, 1)

    ctx_typed = SimpleNamespace(birth_date=date(1985, 7, 9), birth_data={})
    assert SolarReturnService._birth_month_day(ctx_typed) == (7, 9)

    ctx_empty = SimpleNamespace(birth_date=None, birth_data={})
    assert SolarReturnService._birth_month_day(ctx_empty) == (None, None)
