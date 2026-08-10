"""
Full analysis table over a persisted survey (spec §9.9).

The survey already holds every event; this turns it into something pageable,
sortable, filterable and exportable without the model ever carrying the rows.
That split is the point: a 400-event survey would swamp a completion, so the
model gets a small descriptor and the browser fetches pages from the endpoint.

Sorting and filtering are allowlisted against the column set. The rows are plain
dicts from JSONB, so there is no SQL here to inject into — but an unchecked
column name would still let a caller sort by an arbitrary key and leak the shape
of the record, so the allowlist stands.
"""
from __future__ import annotations

import csv
import io
from typing import Dict, List, Optional, Sequence

# Columns the table exposes, in display order. Derived from the survey event
# shape; anything not here cannot be sorted, filtered or exported.
TABLE_COLUMNS: Dict[str, Dict] = {
    "transit_body": {"label": "Transit", "type": "text"},
    "aspect_type": {"label": "Aspect", "type": "text"},
    "natal_body": {"label": "Target", "type": "text"},
    "target_natal_house": {"label": "House", "type": "number"},
    "enter": {"label": "Enter", "type": "date"},
    "exact_dates": {"label": "Exact", "type": "text"},
    "leave": {"label": "Leave", "type": "date"},
    "exact_pass_count": {"label": "Passes", "type": "number"},
    "min_orb": {"label": "Min orb", "type": "number"},
    "duration_days": {"label": "Days", "type": "number"},
    "station_count": {"label": "Stations", "type": "number"},
    "axis_group": {"label": "Axis", "type": "text"},
}

DEFAULT_SORT = "enter"
MAX_PAGE_SIZE = 200
_DEFAULT_PAGE_SIZE = 25


def _parse_iso(value):
    from datetime import datetime

    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        try:
            return datetime.fromisoformat(value[:10])
        except ValueError:
            return None


def _duration_days(enter, leave) -> Optional[float]:
    start, end = _parse_iso(enter), _parse_iso(leave)
    if start is None or end is None:
        return None
    return round((end - start).total_seconds() / 86400.0, 2)


def _min_orb(event: Dict) -> Optional[float]:
    orbs = [p.get("orb") for p in event.get("passes") or []
            if isinstance(p.get("orb"), (int, float))]
    if orbs:
        return min(orbs)
    closest = (event.get("closest_approach") or {}).get("orb")
    return closest if isinstance(closest, (int, float)) else None


def event_to_row(event: Dict) -> Dict:
    """Flatten one survey event into a display row.

    Exact passes collapse to a comma-joined date list: a table cell cannot hold
    a nested structure, and the retrograde triple-pass case is exactly what an
    astrologer scans this column for.
    """
    house = event.get("target_natal_house")
    passes = event.get("passes") or []
    return {
        "event_id": event.get("event_id"),
        "transit_body": event.get("transit_body"),
        "aspect_type": event.get("aspect_type"),
        "natal_body": event.get("natal_body"),
        "target_natal_house": (
            house.get("effective_value") if isinstance(house, dict) else house),
        "enter": event.get("enter"),
        "exact_dates": ", ".join(
            str(p.get("date"))[:10] for p in passes if p.get("date")) or None,
        "leave": event.get("leave"),
        "exact_pass_count": event.get("exact_pass_count", len(passes)),
        "min_orb": _min_orb(event),
        "duration_days": _duration_days(event.get("enter"), event.get("leave")),
        "station_count": len(event.get("stations") or []),
        "axis_group": event.get("axis_group"),
    }


def _matches(row: Dict, filters: Dict) -> bool:
    """Case-insensitive substring match for text, exact for everything else.

    Substring on text because an astrologer filtering "Plu" means Pluto; exact
    on numbers because "house 4" must not also match 14.
    """
    for column, wanted in (filters or {}).items():
        value = row.get(column)
        if wanted is None:
            continue
        if isinstance(value, str) and isinstance(wanted, str):
            if wanted.lower() not in value.lower():
                return False
        elif value != wanted:
            return False
    return True


def _sort_key(column: str):
    def key(row: Dict):
        value = row.get(column)
        if TABLE_COLUMNS.get(column, {}).get("type") == "date":
            parsed = _parse_iso(value)
            return parsed.timestamp() if parsed else 0
        if isinstance(value, (int, float)):
            return value
        return str(value).lower()
    return key


def _sorted_rows(rows: List[Dict], column: str, order: str) -> List[Dict]:
    """Sort, keeping empty cells at the bottom in BOTH directions.

    A single reverse=True flips the null bucket to the top, which reads as "these
    are the highest values" when they are simply missing. So the empties are held
    out of the sort and appended, and mixed types never reach a comparison.
    """
    present = [r for r in rows if r.get(column) is not None]
    missing = [r for r in rows if r.get(column) is None]
    present.sort(key=_sort_key(column), reverse=(order == "desc"))
    return present + missing


def validate_query(
    *,
    sort: Optional[str],
    filters: Optional[Dict],
    page_size: Optional[int],
) -> str:
    """'' when the query is usable, else a machine error code."""
    if sort is not None and sort not in TABLE_COLUMNS:
        return "bad_sort_column"
    for column in (filters or {}):
        if column not in TABLE_COLUMNS:
            return "bad_filter_column"
    if page_size is not None and not (
            isinstance(page_size, int) and 1 <= page_size <= MAX_PAGE_SIZE):
        return "bad_page_size"
    return ""


def build_table(
    events: Sequence[Dict],
    *,
    sort: str = DEFAULT_SORT,
    order: str = "asc",
    filters: Optional[Dict] = None,
    page: int = 1,
    page_size: int = _DEFAULT_PAGE_SIZE,
) -> Dict:
    """One page of the table, plus the totals needed to page through it."""
    rows = [event_to_row(e) for e in events or []]
    filtered = _sorted_rows(
        [r for r in rows if _matches(r, filters or {})], sort, order)

    total = len(filtered)
    size = max(1, min(page_size, MAX_PAGE_SIZE))
    pages = max(1, (total + size - 1) // size)
    current = max(1, min(page, pages))
    start = (current - 1) * size

    return {
        "columns": [
            {"key": key, **meta} for key, meta in TABLE_COLUMNS.items()
        ],
        "rows": filtered[start:start + size],
        "page": current,
        "page_size": size,
        "page_count": pages,
        "total_rows": total,
        "unfiltered_rows": len(rows),
        "sort": sort,
        "order": order,
        "filters": filters or {},
    }


def to_csv(events: Sequence[Dict], *, sort: str = DEFAULT_SORT,
           order: str = "asc", filters: Optional[Dict] = None) -> str:
    """The whole filtered set as CSV — an export that paged would be useless."""
    rows = [event_to_row(e) for e in events or []]
    filtered = _sorted_rows(
        [r for r in rows if _matches(r, filters or {})], sort, order)

    buffer = io.StringIO()
    columns = list(TABLE_COLUMNS)
    writer = csv.DictWriter(
        buffer, fieldnames=["event_id"] + columns, extrasaction="ignore")
    writer.writeheader()
    for row in filtered:
        writer.writerow(row)
    return buffer.getvalue()


def describe_table(events: Sequence[Dict], survey_id: str) -> Dict:
    """The compact descriptor the MODEL receives.

    Deliberately carries no rows: a 400-event survey would swamp the completion
    budget, and the model does not need the rows to say a table exists. The
    browser fetches pages from the endpoint instead.
    """
    return {
        "status": "ok",
        "survey_id": survey_id,
        "table_available": True,
        "row_count": len(events or []),
        "columns": [
            {"key": key, "label": meta["label"]} for key, meta in TABLE_COLUMNS.items()
        ],
        "default_sort": DEFAULT_SORT,
        "csv_available": True,
    }
