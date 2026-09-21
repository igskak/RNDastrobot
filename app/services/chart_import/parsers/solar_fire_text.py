"""Read Solar Fire's human-readable chart-details text attachment."""
from __future__ import annotations

import re
from datetime import datetime

from app.models.chart_import import (
    ImportIssue,
    NormalizedImportRecord,
    ParsedChartImport,
)

from .common import (
    canonical_fixed_timezone,
    fingerprint_for,
    require_unambiguous_calendar,
    utc_from_local,
)


_HEADER = re.compile(r"^(.+?)\s+-\s+(.+?) Chart\s*$", re.I)
_DATETIME = re.compile(
    r"^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}),\s*"
    r"(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?),\s*"
    r"(.+?)\s+([+-]\d{1,2}:\d{2}(?::\d{2})?)\s*$",
    re.I,
)
_PLACE = re.compile(
    r"^(.+?),\s*(\d{1,2}[NS]\d{2}(?:[':]\d{2})?['\"]{0,2})\s*,\s*"
    r"(\d{1,3}[EW]\d{2}(?:[':]\d{2})?['\"]{0,2})\s*$",
    re.I,
)
_COORD = re.compile(
    r"^(\d{1,3})([NSEW])(\d{2})(?:[':](\d{2}))?['\"]{0,2}$", re.I
)


def _coord(value: str, latitude: bool) -> float:
    match = _COORD.fullmatch(value)
    if not match:
        raise ValueError("INVALID_COORDINATE")
    degrees, hemi, minutes, seconds = match.groups()
    if hemi.upper() not in ({"N", "S"} if latitude else {"E", "W"}):
        raise ValueError("INVALID_COORDINATE")
    if int(minutes) > 59 or int(seconds or 0) > 59:
        raise ValueError("INVALID_COORDINATE")
    number = int(degrees) + int(minutes) / 60 + int(seconds or 0) / 3600
    if number > (90 if latitude else 180):
        raise ValueError("INVALID_COORDINATE")
    return -number if hemi.upper() in {"S", "W"} else number


def _record(
    lines: list[str], index: int, line_no: int
) -> NormalizedImportRecord:
    header = _HEADER.fullmatch(lines[0].strip())
    assert header is not None
    title, raw_kind = header.groups()
    try:
        if len(lines) < 3:
            raise ValueError("SOLAR_FIRE_REQUIRED_FIELDS_MISSING")
        date_match = _DATETIME.fullmatch(lines[1].strip())
        place_match = _PLACE.fullmatch(lines[2].strip())
        if not date_match or not place_match:
            raise ValueError("SOLAR_FIRE_REQUIRED_FIELDS_MISSING")
        date, time, _, zone = date_match.groups()
        clean_time = re.sub(r"\s+", "", time).upper()
        time_format = (
            "%I:%M:%S%p"
            if ":" in clean_time[3:] and clean_time.endswith(("AM", "PM"))
            else (
                "%I:%M%p"
                if clean_time.endswith(("AM", "PM"))
                else ("%H:%M:%S" if clean_time.count(":") == 2 else "%H:%M")
            )
        )
        local_date = datetime.strptime(date, "%d %b %Y").date()
        local_time = datetime.strptime(clean_time, time_format).time()
        local = datetime.combine(local_date, local_time)
        require_unambiguous_calendar(local)
        place, lat_text, lon_text = place_match.groups()
        latitude = _coord(lat_text, latitude=True)
        longitude = _coord(lon_text, latitude=False)
        sign = 1 if zone[0] == "+" else -1
        parts = [int(part) for part in zone[1:].split(":")]
        if parts[0] > 23 or any(part > 59 for part in parts[1:]):
            raise ValueError("INVALID_UTC_OFFSET")
        # Solar Fire writes a west-positive zone, e.g. EDT +4:00 = UTC-04:00.
        offset_seconds = -sign * (
            parts[0] * 3600
            + parts[1] * 60
            + (parts[2] if len(parts) > 2 else 0)
        )
        utc_datetime = utc_from_local(local, offset_seconds)
        kind = {
            "natal": "birth",
            "event": "event",
            "horary": "horary",
            "company": "company",
        }.get(raw_kind.lower())
        if kind is None:
            raise ValueError("SOLAR_FIRE_CHART_TYPE_UNSUPPORTED")
        comments = (
            "\n".join(line.strip() for line in lines[3:] if line.strip())
            or None
        )
        issues = []
        if any(
            "sidereal zodiac" in line.casefold()
            or "heliocentric" in line.casefold()
            for line in lines[3:]
        ):
            issues.append(
                ImportIssue(
                    code="SOURCE_CALCULATION_SETTINGS_NOT_IMPORTED",
                    severity="warning",
                    message="SOURCE_CALCULATION_SETTINGS_NOT_IMPORTED",
                )
            )
        record = NormalizedImportRecord(
            source_index=index,
            source_line=line_no,
            title=title[:160],
            chart_kind=kind,
            local_date=local_date,
            local_time=local_time,
            timezone=canonical_fixed_timezone(offset_seconds),
            offset_seconds=offset_seconds,
            utc_datetime=utc_datetime,
            place=place[:255],
            latitude=latitude,
            longitude=longitude,
            comments=comments,
            issues=issues,
        )
        record.fingerprint = fingerprint_for(
            title=record.title,
            utc_datetime=utc_datetime,
            latitude=latitude,
            longitude=longitude,
            chart_kind=kind,
        )
        return record
    except (ValueError, OverflowError) as exc:
        code = str(exc) if str(exc).isupper() else "INVALID_SOLAR_FIRE_RECORD"
        return NormalizedImportRecord(
            source_index=index,
            source_line=line_no,
            title=title[:160],
            issues=[ImportIssue(code=code, severity="error", message=code)],
        )


def parse_solar_fire_text(content: bytes) -> ParsedChartImport:
    try:
        text = content.decode("utf-8-sig")
        encoding = (
            "utf-8-sig" if content.startswith(b"\xef\xbb\xbf") else "utf-8"
        )
    except UnicodeDecodeError:
        text = content.decode("cp1252")
        encoding = "windows-1252"
    blocks: list[tuple[int, list[str]]] = []
    for line_no, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if _HEADER.fullmatch(line):
            blocks.append((line_no, [line]))
        elif blocks:
            blocks[-1][1].append(line)
        elif line:
            raise ValueError("NOT_A_SOLAR_FIRE_TEXT_FILE")
    if not blocks:
        raise ValueError("NOT_A_SOLAR_FIRE_TEXT_FILE")
    records = [
        _record(lines, index, line_no)
        for index, (line_no, lines) in enumerate(blocks, 1)
    ]
    return ParsedChartImport(
        source_format="solar_fire", encoding=encoding, records=records
    )
