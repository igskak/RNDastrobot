"""Pure helpers shared by chart import parsers."""
from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta
from typing import Optional


def canonical_fixed_timezone(offset_seconds: int) -> str:
    sign = "+" if offset_seconds >= 0 else "-"
    absolute = abs(int(offset_seconds))
    hours, remainder = divmod(absolute, 3600)
    minutes, seconds = divmod(remainder, 60)
    value = f"UTC{sign}{hours:02d}:{minutes:02d}"
    if seconds:
        value += f":{seconds:02d}"
    return value


def utc_from_local(local: datetime, offset_seconds: int) -> datetime:
    return local - timedelta(seconds=offset_seconds)


def require_unambiguous_calendar(local: datetime) -> None:
    """Formats without a calendar flag cannot safely import earlier dates."""
    if local.date() < date(1582, 10, 15):
        raise ValueError("HISTORICAL_CALENDAR_UNSUPPORTED")


def fingerprint_for(
    *,
    title: str,
    utc_datetime: Optional[datetime],
    latitude: Optional[float],
    longitude: Optional[float],
    chart_kind: str,
) -> Optional[str]:
    if utc_datetime is None or latitude is None or longitude is None:
        return None
    normalized = "|".join(
        [
            title.strip().casefold(),
            utc_datetime.replace(tzinfo=None).isoformat(timespec="seconds"),
            f"{latitude:.7f}",
            f"{longitude:.7f}",
            chart_kind,
        ]
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
