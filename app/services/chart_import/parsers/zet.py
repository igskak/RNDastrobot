"""Parser for textual ZET database files (.zbs)."""
from __future__ import annotations

import re
from datetime import datetime

from app.models.chart_import import (
    ImportIssue,
    NormalizedImportRecord,
    ParsedChartImport,
)

from .common import canonical_fixed_timezone, fingerprint_for, utc_from_local


_OFFSET = re.compile(r"([+-])(\d{1,2})(?::([0-5]\d))?(?::([0-5]\d))?$")
_COORD = re.compile(r"(\d{1,3})([nsew])(\d{2})(?::(\d{2}))?$", re.IGNORECASE)


def _decode(content: bytes) -> tuple[str, str]:
    if content.startswith(b"\xef\xbb\xbf"):
        return content.decode("utf-8-sig"), "utf-8-sig"
    try:
        return content.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        try:
            return content.decode("cp1251"), "windows-1251"
        except UnicodeDecodeError as exc:
            raise ValueError("UNSUPPORTED_FILE_ENCODING") from exc


def _parse_offset(value: str) -> int:
    match = _OFFSET.fullmatch(value.strip())
    if not match:
        raise ValueError("INVALID_UTC_OFFSET")
    sign, hours, minutes, seconds = match.groups()
    hour_value = int(hours)
    if hour_value > 23:
        raise ValueError("INVALID_UTC_OFFSET")
    total = hour_value * 3600 + int(minutes or 0) * 60 + int(seconds or 0)
    return -total if sign == "-" else total


def _parse_coord(value: str, latitude: bool) -> float:
    match = _COORD.fullmatch(value.strip())
    if not match:
        raise ValueError("INVALID_COORDINATE")
    degrees, hemisphere, minutes, seconds = match.groups()
    number = int(degrees) + int(minutes) / 60 + int(seconds or 0) / 3600
    if hemisphere.lower() in {"s", "w"}:
        number = -number
    limit = 90 if latitude else 180
    allowed = {"n", "s"} if latitude else {"e", "w"}
    if hemisphere.lower() not in allowed or abs(number) > limit:
        raise ValueError("INVALID_COORDINATE")
    return number


def _error_record(
    source_index: int, line_number: int, title: str, code: str
) -> NormalizedImportRecord:
    return NormalizedImportRecord(
        source_index=source_index,
        source_line=line_number,
        title=(title or f"Record {source_index}")[:160],
        issues=[ImportIssue(code=code, severity="error", message=code)],
    )


def parse_zet(content: bytes) -> ParsedChartImport:
    text, encoding = _decode(content)
    records: list[NormalizedImportRecord] = []
    for line_number, raw_line in enumerate(text.splitlines(), 1):
        if not raw_line.strip():
            continue
        source_index = len(records) + 1
        fields = [part.strip() for part in raw_line.split(";")]
        title = fields[0] if fields else ""
        if len(fields) < 7:
            records.append(
                _error_record(
                    source_index, line_number, title, "ZET_NOT_ENOUGH_FIELDS"
                )
            )
            continue
        try:
            time_format = "%H:%M:%S" if fields[2].count(":") == 2 else "%H:%M"
            local = datetime.strptime(
                f"{fields[1]} {fields[2]}", f"%d.%m.%Y {time_format}"
            )
            offset_seconds = _parse_offset(fields[3])
            latitude = _parse_coord(fields[5], latitude=True)
            longitude = _parse_coord(fields[6], latitude=False)
            utc_datetime = utc_from_local(local, offset_seconds)
            comments = (
                ";".join(part for part in fields[7:] if part).strip() or None
            )
            record = NormalizedImportRecord(
                source_index=source_index,
                source_line=line_number,
                title=(title or f"Record {source_index}")[:160],
                chart_kind="other",
                local_date=local.date(),
                local_time=local.time(),
                timezone=canonical_fixed_timezone(offset_seconds),
                offset_seconds=offset_seconds,
                utc_datetime=utc_datetime,
                place=fields[4][:255],
                latitude=latitude,
                longitude=longitude,
                comments=comments,
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
                utc_datetime=record.utc_datetime,
                latitude=record.latitude,
                longitude=record.longitude,
                chart_kind=record.chart_kind,
            )
            records.append(record)
        except ValueError as exc:
            code = str(exc) if str(exc).isupper() else "INVALID_ZET_RECORD"
            records.append(
                _error_record(source_index, line_number, title, code)
            )
    if not records:
        raise ValueError("EMPTY_IMPORT_FILE")
    return ParsedChartImport(
        source_format="zet", encoding=encoding, records=records
    )
