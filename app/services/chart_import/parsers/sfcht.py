"""Read the Solar Fire v6+ chart collection shared with Astro Gold.

Only the observed version-3 layout is accepted. Unknown variants fail closed so
we never silently change a chart's birth time or geographical coordinates.
"""
from __future__ import annotations

import math
import struct
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


_HEADER_SIZE = 86
_RECORD_SIZE = 296
_SUBCHART_SIZE = 115


def _field(raw: bytes) -> str:
    return raw.split(b"\0", 1)[0].decode("cp1252").strip()


def _notes(content: bytes, offset: int) -> tuple[str, int]:
    if offset + 4 > len(content):
        raise ValueError("INVALID_SFCHT_FILE")
    length = struct.unpack_from("<I", content, offset)[0]
    if length > 64 * 1024:
        raise ValueError("IMPORT_RECORD_TOO_LARGE")
    end = offset + 4 + length
    if end > len(content):
        raise ValueError("INVALID_SFCHT_FILE")
    return (
        content[offset + 4:end].replace(b"\0", b"").decode("cp1252").strip(),
        end,
    )


def _record(
    raw: bytes, index: int, notes: str, subchart_count: int
) -> NormalizedImportRecord:
    title = _field(raw[2:52]) or f"Record {index}"
    try:
        year = struct.unpack_from("<h", raw, 100)[0]
        local = datetime(
            year, raw[102], raw[103], raw[104], raw[105], raw[106]
        )
        require_unambiguous_calendar(local)
        longitude = -float(struct.unpack_from("<f", raw, 92)[0])
        latitude = float(struct.unpack_from("<f", raw, 96)[0])
        offset_hours = -float(struct.unpack_from("<f", raw, 107)[0])
        if (
            not all(map(math.isfinite, (longitude, latitude, offset_hours)))
            or abs(longitude) > 180
            or abs(latitude) > 90
            or abs(offset_hours) > 23
        ):
            raise ValueError("INVALID_SFCHT_RECORD")
        offset_seconds = round(offset_hours * 3600)
        kind = {1: "birth", 2: "birth", 3: "event", 4: "horary"}.get(
            raw[117], "other"
        )
        city, region = _field(raw[52:72]), _field(raw[72:92])
        place = ", ".join(part for part in (city, region) if part)
        source_rating = _field(raw[118:150])
        secondary_name = _field(raw[162:212])
        comment_parts = [
            part for part in (notes, source_rating, secondary_name) if part
        ]
        issues = []
        if subchart_count:
            issues.append(
                ImportIssue(
                    code="SFCHT_SUBCHARTS_NOT_IMPORTED",
                    severity="warning",
                    message="SFCHT_SUBCHARTS_NOT_IMPORTED",
                )
            )
        if raw[152] != 1 or raw[157] != 1:
            issues.append(
                ImportIssue(
                    code="SOURCE_CALCULATION_SETTINGS_NOT_IMPORTED",
                    severity="warning",
                    message="SOURCE_CALCULATION_SETTINGS_NOT_IMPORTED",
                )
            )
        if kind == "other":
            issues.append(
                ImportIssue(
                    code="CHART_KIND_NOT_PROVIDED",
                    severity="warning",
                    message="CHART_KIND_NOT_PROVIDED",
                )
            )
        utc_datetime = utc_from_local(local, offset_seconds)
        record = NormalizedImportRecord(
            source_index=index,
            source_line=index,
            title=title[:160],
            chart_kind=kind,
            local_date=local.date(),
            local_time=local.time(),
            timezone=canonical_fixed_timezone(offset_seconds),
            offset_seconds=offset_seconds,
            utc_datetime=utc_datetime,
            place=place[:255],
            latitude=latitude,
            longitude=longitude,
            comments="\n".join(comment_parts) or None,
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
        code = str(exc) if str(exc).isupper() else "INVALID_SFCHT_RECORD"
        return NormalizedImportRecord(
            source_index=index,
            source_line=index,
            title=title[:160],
            issues=[ImportIssue(code=code, severity="error", message=code)],
        )


def parse_sfcht(content: bytes) -> ParsedChartImport:
    if (
        len(content) < _HEADER_SIZE
        or content[:2] != b"\x03\x00"
        or content[84:86] != b"\0\0"
    ):
        raise ValueError("UNSUPPORTED_SFCHT_VERSION")
    count = struct.unpack_from("<H", content, 82)[0]
    if not count:
        raise ValueError("EMPTY_IMPORT_FILE")
    if count > 2000:
        raise ValueError("IMPORT_TOO_MANY_RECORDS")
    records = []
    pos = _HEADER_SIZE
    for index in range(1, count + 1):
        if (
            pos + _RECORD_SIZE > len(content)
            or content[pos:pos + 2] != b"\x01\x01"
        ):
            raise ValueError("INVALID_SFCHT_FILE")
        raw = content[pos:pos + _RECORD_SIZE]
        pos += _RECORD_SIZE
        subchart_count = struct.unpack_from("<I", raw, 292)[0]
        if subchart_count > (len(content) - pos) // (_SUBCHART_SIZE + 4):
            raise ValueError("INVALID_SFCHT_FILE")
        for _ in range(subchart_count):
            pos += _SUBCHART_SIZE
            _, pos = _notes(content, pos)
        notes, pos = _notes(content, pos)
        records.append(_record(raw, index, notes, subchart_count))
    if pos != len(content):
        raise ValueError("INVALID_SFCHT_FILE")
    return ParsedChartImport(
        source_format="sfcht", encoding="windows-1252", records=records
    )
