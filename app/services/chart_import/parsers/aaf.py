"""Conservative parser for the AAF exchange format used by Astro.com."""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime

from app.models.chart_import import (
    ImportIssue,
    NormalizedImportRecord,
    ParsedChartImport,
)

from .common import canonical_fixed_timezone, fingerprint_for, utc_from_local


_COORD = re.compile(
    r"(\d{1,3})([nsew])(\d{1,2})(?::(\d{1,2}))?$", re.IGNORECASE
)
_ZONE = re.compile(
    r"(\d{1,2})(?:h)?(?:([ew])(\d{0,2})(?::(\d{1,2}))?)?$",
    re.IGNORECASE,
)
_CHART_KINDS = {
    "m": "birth",
    "f": "birth",
    "w": "birth",
    "e": "event",
    "o": "company",
}


def _csv(value: str) -> list[str]:
    return next(csv.reader(io.StringIO(value), skipinitialspace=True))


def _coord(value: str, latitude: bool) -> float:
    if re.fullmatch(r"0(?::00)(?::00)?", value.strip()):
        return 0.0
    match = _COORD.fullmatch(value.strip())
    if not match:
        raise ValueError("INVALID_COORDINATE")
    degrees, hemisphere, minutes, seconds = match.groups()
    allowed = {"n", "s"} if latitude else {"e", "w"}
    if hemisphere.lower() not in allowed:
        raise ValueError("INVALID_COORDINATE")
    minute_value = int(minutes)
    second_value = int(seconds or 0)
    if minute_value > 59 or second_value > 59:
        raise ValueError("INVALID_COORDINATE")
    number = int(degrees) + minute_value / 60 + second_value / 3600
    if hemisphere.lower() in {"s", "w"}:
        number = -number
    if abs(number) > (90 if latitude else 180):
        raise ValueError("INVALID_COORDINATE")
    return number


def _offset(value: str) -> int:
    match = _ZONE.fullmatch(value.strip())
    if not match:
        raise ValueError("UNSUPPORTED_AAF_TIMEZONE")
    hours, direction, minutes, seconds = match.groups()
    hour_value = int(hours)
    minute_value = int(minutes or 0)
    second_value = int(seconds or 0)
    if hour_value > 23 or minute_value > 59 or second_value > 59:
        raise ValueError("UNSUPPORTED_AAF_TIMEZONE")
    if direction is None and hour_value != 0:
        raise ValueError("UNSUPPORTED_AAF_TIMEZONE")
    total = hour_value * 3600 + minute_value * 60 + second_value
    if direction is None:
        return 0
    return total if direction.lower() == "e" else -total


def _effective_offset(value: str, time_type: str, longitude: float) -> int:
    normalized_type = time_type.strip().lower()
    if normalized_type not in {"0", "1", "2", "h", "l", "m", "w"}:
        raise ValueError("AAF_TIME_TYPE_UNSUPPORTED")
    if value.strip() == "*":
        if normalized_type != "l":
            raise ValueError("UNSUPPORTED_AAF_TIMEZONE")
        return round(longitude * 240)
    standard_offset = _offset(value)
    daylight_adjustments = {"1": 3600, "w": 3600, "2": 7200, "h": 1800}
    return standard_offset + daylight_adjustments.get(normalized_type, 0)


def _record(
    block: dict[str, list[str]], source_index: int, source_line: int
) -> NormalizedImportRecord:
    a = block.get("A93") or []
    b = block.get("B93") or []
    fallback_title = f"Record {source_index}"
    title = fallback_title
    if a:
        title = " ".join(
            part
            for part in [a[1] if len(a) > 1 else "", a[0]]
            if part and part != "*"
        ).strip()
        title = title or fallback_title
    if len(a) < 7 or len(b) < 5:
        return NormalizedImportRecord(
            source_index=source_index,
            source_line=source_line,
            title=title[:160],
            issues=[
                ImportIssue(
                    code="AAF_REQUIRED_FIELDS_MISSING",
                    severity="error",
                    message="AAF_REQUIRED_FIELDS_MISSING",
                )
            ],
        )
    try:
        raw_date = a[3].strip()
        calendar_suffix = raw_date[-1:].lower()
        if calendar_suffix == "j":
            raise ValueError("AAF_JULIAN_CALENDAR_UNSUPPORTED")
        if calendar_suffix == "g":
            raw_date = raw_date[:-1]
        date_value = datetime.strptime(raw_date, "%d.%m.%Y").date()
        if (
            calendar_suffix != "g"
            and date_value < datetime(1582, 10, 15).date()
        ):
            raise ValueError("AAF_JULIAN_CALENDAR_UNSUPPORTED")
        time_value = datetime.strptime(
            a[4].strip(), "%H:%M:%S" if a[4].count(":") == 2 else "%H:%M"
        ).time()
        chart_kind = _CHART_KINDS.get(a[2].strip().lower())
        if chart_kind is None:
            raise ValueError("AAF_CHART_TYPE_UNSUPPORTED")
        time_type = b[4].strip().lower()
        latitude = _coord(b[1], latitude=True)
        longitude = _coord(b[2], latitude=False)
        offset_seconds = _effective_offset(b[3], time_type, longitude)
        local = datetime.combine(date_value, time_value)
        utc_datetime = utc_from_local(local, offset_seconds)
        source_jd = None if b[0].strip() in {"", "*"} else float(b[0])
        calculated_jd = (
            utc_datetime.date().toordinal()
            + 1721424.5
            + (
                utc_datetime.hour
                + utc_datetime.minute / 60
                + utc_datetime.second / 3600
            )
            / 24
        )
        if (
            source_jd is not None
            and abs(source_jd - calculated_jd) > 2 / 86400
        ):
            raise ValueError("AAF_JULIAN_DAY_CONFLICT")
        comments = (
            "\n".join(
                block.get("COM", [])
                + block.get("SRC", [])
                + block.get("VIA", [])
            ).strip()
            or None
        )
        record = NormalizedImportRecord(
            source_index=source_index,
            source_line=source_line,
            title=title[:160],
            first_name=(
                a[1].strip() if len(a) > 1 and a[1].strip() != "*" else None
            ),
            last_name=(a[0].strip() if a[0].strip() != "*" else None),
            chart_kind=chart_kind,
            local_date=date_value,
            local_time=time_value,
            timezone=canonical_fixed_timezone(offset_seconds),
            offset_seconds=offset_seconds,
            utc_datetime=utc_datetime,
            place=a[5].strip()[:255],
            latitude=latitude,
            longitude=longitude,
            comments=comments,
            source_julian_day=source_jd,
            issues=[],
        )
        record.fingerprint = fingerprint_for(
            title=record.title,
            utc_datetime=record.utc_datetime,
            latitude=record.latitude,
            longitude=record.longitude,
            chart_kind=record.chart_kind,
        )
        return record
    except (ValueError, IndexError) as exc:
        code = str(exc) if str(exc).isupper() else "INVALID_AAF_RECORD"
        return NormalizedImportRecord(
            source_index=source_index,
            source_line=source_line,
            title=title[:160],
            issues=[ImportIssue(code=code, severity="error", message=code)],
        )


def parse_aaf(content: bytes) -> ParsedChartImport:
    try:
        text = content.decode("utf-8-sig")
        encoding = (
            "utf-8-sig" if content.startswith(b"\xef\xbb\xbf") else "utf-8"
        )
    except UnicodeDecodeError:
        try:
            text = content.decode("cp1252")
            encoding = "windows-1252"
        except UnicodeDecodeError as exc:
            raise ValueError("UNSUPPORTED_FILE_ENCODING") from exc
    blocks: list[tuple[int, dict[str, list[str]]]] = []
    current: dict[str, list[str]] | None = None
    start_line = 0
    for line_number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("##"):
            continue
        if line.startswith("#A93:"):
            if current is not None:
                blocks.append((start_line, current))
            current = {"A93": _csv(line[5:])}
            start_line = line_number
            continue
        if current is None or not line.startswith("#") or ":" not in line:
            continue
        key, value = line[1:].split(":", 1)
        key = key.upper()
        if key == "B93":
            current[key] = _csv(value)
        elif key in {"COM", "SRC", "VIA"}:
            current.setdefault(key, []).append(value.strip())
    if current is not None:
        blocks.append((start_line, current))
    if not blocks:
        raise ValueError("NOT_AN_AAF_FILE")
    records = [
        _record(block, index, line)
        for index, (line, block) in enumerate(blocks, 1)
    ]
    return ParsedChartImport(
        source_format="aaf", encoding=encoding, records=records
    )
