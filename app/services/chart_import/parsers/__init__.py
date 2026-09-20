"""Format detection and parser dispatch for chart imports."""
from __future__ import annotations

from pathlib import Path

from app.models.chart_import import ParsedChartImport

from .aaf import parse_aaf
from .zet import parse_zet


def parse_chart_import(filename: str, content: bytes) -> ParsedChartImport:
    suffix = Path(filename or "").suffix.casefold()
    if suffix == ".zbs":
        return parse_zet(content)
    if suffix in {".aaf", ".txt"}:
        return parse_aaf(content)
    raise ValueError("UNSUPPORTED_IMPORT_FORMAT")


__all__ = ["parse_chart_import", "parse_aaf", "parse_zet"]
