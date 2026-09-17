"""Exact historical offsets must preserve the instant, including seconds."""
from datetime import date, datetime, time, timezone

import pytest
import pytz

from app.models.schemas import BirthDataInput
from app.services.time_service import TimeService
from app.utils.timezones import resolve_timezone, resolve_zoneinfo


@pytest.mark.parametrize('offset,local,expected', [
    ('UTC+00:52:08', '1889-04-20T18:29:59', '1889-04-20T17:37:51'),
    ('UTC-06:53:20', '1917-03-06T12:00:00', '1917-03-06T18:53:20'),
    ('UTC-00:14:28', '1542-12-07T13:12:00', '1542-12-07T13:26:28'),
    ('UTC+00:30', '1884-01-28T23:00:00', '1884-01-28T22:30:00'),
    ('+0:30', '1884-01-28T22:45:00', '1884-01-28T22:15:00'),
    ('GMT+02:01', '1870-04-22T12:00:00', '1870-04-22T09:59:00'),
    ('UTC+02:01', '1869-02-26T12:00:00', '1869-02-26T09:59:00'),
    ('UTC+05:30', '2000-01-01T01:00:00', '1999-12-31T19:30:00'),
    ('UTC-00:00:30', '2000-12-31T23:59:59', '2001-01-01T00:00:29'),
])
def test_exact_offset_preserves_instant_and_julian_day(offset, local, expected):
    local = datetime.fromisoformat(local)
    expected = datetime.fromisoformat(expected).replace(tzinfo=timezone.utc)
    utc, jd = TimeService.process_birth_time(local.date(), local.time(), offset)
    assert utc == expected
    assert jd == TimeService.to_julian_day(expected)
    assert utc.astimezone(resolve_timezone(offset)).replace(tzinfo=None) == local
    assert local.replace(tzinfo=resolve_zoneinfo(offset)).astimezone(timezone.utc) == expected
    payload = BirthDataInput(date=local.date(), time=local.time(), timezone=offset, latitude=48, longitude=13)
    assert payload.timezone == offset


@pytest.mark.parametrize('value', ['UTC+24:00', 'UTC+00:60', 'UTC+00:00:60', 'UTC+3:5', 'UTC+03:00junk', 'UTC+nan', 'Mars/Olympus', ''])
def test_invalid_offsets_rejected(value):
    with pytest.raises(pytz.UnknownTimeZoneError):
        resolve_timezone(value)
    with pytest.raises(ValueError):
        BirthDataInput(date=date(2000, 1, 1), time=time(12), timezone=value, latitude=0, longitude=0)


@pytest.mark.parametrize('month,hour', [(1, 11), (7, 10)])
def test_named_zone_dst_unchanged(month, hour):
    result = TimeService.to_utc(date(2026, month, 15), time(12), 'Europe/Madrid')
    assert result == datetime(2026, month, 15, hour, tzinfo=timezone.utc)
