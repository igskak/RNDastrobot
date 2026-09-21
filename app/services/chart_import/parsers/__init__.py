"""Format detection and parser dispatch for chart imports."""
from __future__ import annotations

from pathlib import Path

from app.models.chart_import import ParsedChartImport

from .aaf import parse_aaf
from .astrolog import parse_astrolog
from .sfcht import parse_sfcht
from .solar_fire_text import parse_solar_fire_text
from .zet import parse_zet


def parse_chart_import(filename: str, content: bytes) -> ParsedChartImport:
    suffix = Path(filename or "").suffix.casefold()
    if suffix == ".zbs":
        return parse_zet(content)
    if suffix == ".aaf":
        return parse_aaf(content)
    if suffix == ".sfcht":
        return parse_sfcht(content)
    if suffix == ".as":
        return parse_astrolog(content)
    if suffix == ".txt":
        if (
            content.lstrip(b"\xef\xbb\xbf \t\r\n").startswith(b"#A93:")
            or b"\n#A93:" in content
        ):
            return parse_aaf(content)
        return parse_solar_fire_text(content)
    raise ValueError("UNSUPPORTED_IMPORT_FORMAT")


__all__ = [
    "parse_chart_import",
    "parse_aaf",
    "parse_astrolog",
    "parse_sfcht",
    "parse_solar_fire_text",
    "parse_zet",
]
