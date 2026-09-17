"""Named timezones and explicit UTC offsets, including historical seconds."""
from datetime import datetime, timedelta, timezone, tzinfo
import re
from typing import Optional
from zoneinfo import ZoneInfo

import pytz


_OFFSET = re.compile(
    r"(?:UTC|GMT)?([+-])(\d{1,2})(?::([0-5]\d)(?::([0-5]\d))?)?",
    re.IGNORECASE,
)


def fixed_offset(value: str) -> Optional[timezone]:
    """Parse an explicit offset; an IANA zone is deliberately not inferred."""
    match = (
        _OFFSET.fullmatch(value.strip()) if isinstance(value, str) else None
    )
    if match is None:
        return None
    sign, raw_hours, raw_minutes, raw_seconds = match.groups()
    hours = int(raw_hours)
    minutes = int(raw_minutes or 0)
    seconds = int(raw_seconds or 0)
    if hours > 23:
        raise pytz.UnknownTimeZoneError(value)
    total = hours * 3600 + minutes * 60 + seconds
    if sign == '-':
        total = -total
    label = f"UTC{sign}{hours:02d}:{minutes:02d}"
    if seconds:
        label += f":{seconds:02d}"
    return timezone(timedelta(seconds=total), label) if total else timezone.utc


def resolve_timezone(value: str) -> tzinfo:
    """Keep pytz's IANA behaviour while accepting exact fixed offsets."""
    return fixed_offset(value) or pytz.timezone(value)


def resolve_zoneinfo(value: str) -> tzinfo:
    """Equivalent resolver for callers using zoneinfo's datetime semantics."""
    return fixed_offset(value) or ZoneInfo(value)


def localize(naive: datetime, zone: tzinfo) -> datetime:
    """Attach a zone without rounding fixed offsets to whole minutes."""
    if naive.tzinfo is not None:
        raise ValueError('Expected a naive local datetime')
    if hasattr(zone, 'localize'):
        return zone.localize(naive)
    return naive.replace(tzinfo=zone)
