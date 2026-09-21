"""Strict reader for Astrolog chart-info and chart-list switch files."""
from __future__ import annotations

import re
import shlex
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


_MONTHS = {
    name.lower(): index
    for index, name in enumerate(
        (
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ),
        1,
    )
}
_ANGLE = re.compile(r"(\d{1,3})(?::(\d{1,2}))?(?::(\d{1,2}))?([NSEW])", re.I)
_ZONE = re.compile(
    r"([+-]?)(\d{1,2})(?::([0-5]\d))?(?::([0-5]\d))?([EW])?", re.I
)
_CLOCK = re.compile(r"(\d{1,2}):(\d{2})(?::(\d{2}))?(am|pm)?", re.I)


def _angle(value: str, latitude: bool) -> float:
    match = _ANGLE.fullmatch(value)
    if not match:
        raise ValueError("INVALID_COORDINATE")
    degrees, minutes, seconds, hemisphere = match.groups()
    if hemisphere.upper() not in ({"N", "S"} if latitude else {"E", "W"}):
        raise ValueError("INVALID_COORDINATE")
    if int(minutes or 0) > 59 or int(seconds or 0) > 59:
        raise ValueError("INVALID_COORDINATE")
    angle = int(degrees) + int(minutes or 0) / 60 + int(seconds or 0) / 3600
    if angle > (90 if latitude else 180):
        raise ValueError("INVALID_COORDINATE")
    return -angle if hemisphere.upper() in {"W", "S"} else angle


def _time(value: str) -> tuple[int, int, int]:
    match = _CLOCK.fullmatch(value)
    if not match:
        raise ValueError("ASTROLOG_TIME_UNSUPPORTED")
    hour, minute, second, meridiem = match.groups()
    h, m, s = int(hour), int(minute), int(second or 0)
    if m > 59 or s > 59 or (meridiem and not 1 <= h <= 12):
        raise ValueError("ASTROLOG_TIME_UNSUPPORTED")
    if meridiem:
        h = h % 12 + (12 if meridiem.lower() == "pm" else 0)
    if h > 23:
        raise ValueError("ASTROLOG_TIME_UNSUPPORTED")
    return h, m, s


def _offset(zone: str, dst: str, longitude: float) -> int:
    if zone.upper() == "LMT":
        return round(longitude * 240)
    match = _ZONE.fullmatch(zone)
    if not match:
        raise ValueError("ASTROLOG_TIMEZONE_UNSUPPORTED")
    sign, hours, minutes, seconds, hemisphere = match.groups()
    h = int(hours)
    if h > 23 or (sign and hemisphere):
        raise ValueError("ASTROLOG_TIMEZONE_UNSUPPORTED")
    west_seconds = h * 3600 + int(minutes or 0) * 60 + int(seconds or 0)
    if sign == "-" or (hemisphere and hemisphere.upper() == "E"):
        west_seconds = -west_seconds
    daylight = dst.casefold()
    if daylight in {"st", "no", "0", "0:00"}:
        daylight_seconds = 0
    elif daylight in {"dt", "yes", "1", "1:00"}:
        daylight_seconds = 3600
    else:
        raise ValueError("ASTROLOG_DAYLIGHT_UNSUPPORTED")
    return -west_seconds + daylight_seconds


def _record(
    args: list[str], index: int, line: int, name: str = "", place: str = ""
) -> NormalizedImportRecord:
    title = (name or f"Record {index}")[:160]
    try:
        if len(args) != 8:
            raise ValueError("ASTROLOG_REQUIRED_FIELDS_MISSING")
        month = _MONTHS.get(
            args[0].casefold(), int(args[0]) if args[0].isdigit() else 0
        )
        hour, minute, second = _time(args[3])
        local = datetime(
            int(args[2]), month, int(args[1]), hour, minute, second
        )
        require_unambiguous_calendar(local)
        longitude = _angle(args[6], latitude=False)
        latitude = _angle(args[7], latitude=True)
        offset_seconds = _offset(args[5], args[4], longitude)
        utc_datetime = utc_from_local(local, offset_seconds)
        record = NormalizedImportRecord(
            source_index=index,
            source_line=line,
            title=title,
            chart_kind="other",
            local_date=local.date(),
            local_time=local.time(),
            timezone=canonical_fixed_timezone(offset_seconds),
            offset_seconds=offset_seconds,
            utc_datetime=utc_datetime,
            place=place[:255],
            latitude=latitude,
            longitude=longitude,
            issues=[
                ImportIssue(
                    code="CHART_KIND_NOT_PROVIDED",
                    severity="warning",
                    message="CHART_KIND_NOT_PROVIDED",
                )
            ],
        )
        record.fingerprint = fingerprint_for(
            title=record.title,
            utc_datetime=utc_datetime,
            latitude=latitude,
            longitude=longitude,
            chart_kind=record.chart_kind,
        )
        return record
    except (ValueError, OverflowError) as exc:
        code = str(exc) if str(exc).isupper() else "INVALID_ASTROLOG_RECORD"
        return NormalizedImportRecord(
            source_index=index,
            source_line=line,
            title=title,
            issues=[ImportIssue(code=code, severity="error", message=code)],
        )


def parse_astrolog(content: bytes) -> ParsedChartImport:
    try:
        text = content.decode("utf-8-sig")
        encoding = (
            "utf-8-sig" if content.startswith(b"\xef\xbb\xbf") else "utf-8"
        )
    except UnicodeDecodeError:
        text = content.decode("cp1252")
        encoding = "windows-1252"
    lines = text.splitlines()
    header_index = next(
        (index for index, line in enumerate(lines) if line.strip()), -1
    )
    header = lines[header_index].strip() if header_index >= 0 else ""
    if not re.match(r"^@A[IL]\d+\b", header, re.I):
        raise ValueError("NOT_AN_ASTROLOG_FILE")
    records: list[NormalizedImportRecord] = []
    single: NormalizedImportRecord | None = None
    for line_no, raw in enumerate(lines[header_index + 1:], header_index + 2):
        line = raw.strip()
        if not line or line.startswith((";", "#")):
            continue
        lexer = shlex.shlex(line, posix=True)
        lexer.whitespace_split = True
        lexer.commenters = ";"
        try:
            fields = list(lexer)
        except ValueError as exc:
            raise ValueError("NOT_AN_ASTROLOG_FILE") from exc
        if not fields:
            continue
        switch = fields[0].lower().replace("-", "/", 1)
        if switch == "/qcl":
            if len(fields) != 11:
                records.append(_record([], len(records) + 1, line_no))
            else:
                records.append(
                    _record(
                        fields[1:9],
                        len(records) + 1,
                        line_no,
                        fields[9],
                        fields[10],
                    )
                )
        elif (
            switch == "/qb"
            and header.upper().startswith("@AI")
            and single is None
        ):
            single = _record(fields[1:], 1, line_no)
        elif switch == "/zi" and single is not None and len(fields) == 3:
            single.title = fields[1][:160]
            single.place = fields[2][:255]
            single.fingerprint = fingerprint_for(
                title=single.title,
                utc_datetime=single.utc_datetime,
                latitude=single.latitude,
                longitude=single.longitude,
                chart_kind=single.chart_kind,
            )
        else:
            raise ValueError("ASTROLOG_UNSUPPORTED_SWITCH")
    if single is not None:
        records.append(single)
    if not records:
        raise ValueError("EMPTY_IMPORT_FILE")
    return ParsedChartImport(
        source_format="astrolog", encoding=encoding, records=records
    )
