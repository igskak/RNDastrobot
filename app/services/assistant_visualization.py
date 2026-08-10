"""
Declarative visualization specs for forecast data (spec §9.8, §17).

The model never sends code. It sends a small declarative spec — a chart type and
which fields to plot — and the server validates it against the dataset it will
be drawn from, then builds the series itself. So a spec cannot reference a field
that does not exist, cannot smuggle markup through a label, and cannot become
executable anything on the way to the browser.

The client draws from the returned series. Series are built here rather than
client-side for the same reason numbers are: whatever is plotted has to be the
same data the answer talks about.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Sequence

# §9.8 chart types. Each is bound to the shape of data it can honestly show, so
# the planner cannot ask for a heatmap of something that has no time axis.
CHART_TYPES: Dict[str, Dict] = {
    "aspect_timeline": {
        "needs": "events",
        "summary": "One horizontal bar per contact from enter to leave, exact passes marked.",
    },
    "monthly_heatmap": {
        "needs": "events",
        "summary": "Contact density per calendar month.",
    },
    "orb_line": {
        "needs": "events",
        "summary": "Minimum orb per contact, ordered in time.",
    },
    "bar": {
        "needs": "events",
        "summary": "Counts grouped by one categorical field.",
    },
    "network": {
        "needs": "events",
        "summary": "Transiting bodies and natal targets as nodes, contacts as edges.",
    },
}

# Fields a spec may group or colour by. Anything else is rejected rather than
# silently ignored, so a typo surfaces instead of producing a wrong chart.
GROUPABLE_FIELDS = (
    "transit_body", "natal_body", "aspect_type", "target_natal_house",
    "axis_group", "target_type",
)

# §10.2: below this a chart adds nothing a sentence would not carry better.
MIN_ROWS_FOR_CHART = 4
MAX_SERIES_POINTS = 400

# Labels reach the DOM. The client builds text nodes rather than markup, so this
# is defence in depth, not the only guard.
_LABEL_SAFE = re.compile(r"[<>&\"']")


def _clean_label(value, limit: int = 60) -> str:
    return _LABEL_SAFE.sub("", str(value or ""))[:limit]


def _month(value) -> Optional[str]:
    text = str(value or "")
    return text[:7] if len(text) >= 7 else None


def validate_spec(spec: Dict, *, row_count: int) -> str:
    """'' when the spec is drawable, else a machine error code."""
    if not isinstance(spec, dict):
        return "bad_spec"
    if spec.get("type") not in CHART_TYPES:
        return "bad_chart_type"
    group_by = spec.get("group_by")
    if group_by is not None and group_by not in GROUPABLE_FIELDS:
        return "bad_group_by"
    if spec.get("type") == "bar" and not group_by:
        return "group_by_required"
    if row_count < MIN_ROWS_FOR_CHART:
        # Not an error in the data — a judgement that a chart is the wrong
        # answer here. The caller reports it and writes a sentence instead.
        return "too_few_rows_for_a_chart"
    return ""


def _timeline(events: Sequence[Dict]) -> List[Dict]:
    out = []
    for event in events[:MAX_SERIES_POINTS]:
        if not event.get("enter") or not event.get("leave"):
            continue
        out.append({
            "id": event.get("event_id"),
            "label": _clean_label(
                f"{event.get('transit_body')} {event.get('aspect_type')} "
                f"{event.get('natal_body')}"),
            "start": event["enter"],
            "end": event["leave"],
            "exact": [p.get("date") for p in event.get("passes") or [] if p.get("date")],
            "group": _clean_label(event.get("transit_body")),
        })
    return out


def _heatmap(events: Sequence[Dict]) -> List[Dict]:
    """Density by month, counted on exact passes with a fallback to the window.

    Counting only passes would drop a contact that never perfects, which is
    still activity; counting only windows would smear a year-long contact across
    twelve cells. Passes first, window start when there are none.
    """
    buckets: Dict[str, int] = {}
    for event in events:
        dates = [p.get("date") for p in event.get("passes") or [] if p.get("date")]
        if not dates:
            dates = [event.get("enter")]
        for value in dates:
            key = _month(value)
            if key:
                buckets[key] = buckets.get(key, 0) + 1
    return [{"bucket": k, "value": v} for k, v in sorted(buckets.items())]


def _orb_line(events: Sequence[Dict]) -> List[Dict]:
    points = []
    for event in events:
        orbs = [p.get("orb") for p in event.get("passes") or []
                if isinstance(p.get("orb"), (int, float))]
        value = min(orbs) if orbs else (event.get("closest_approach") or {}).get("orb")
        if not isinstance(value, (int, float)) or not event.get("enter"):
            continue
        points.append({
            "id": event.get("event_id"),
            "x": event["enter"],
            "y": round(float(value), 4),
            "label": _clean_label(
                f"{event.get('transit_body')} {event.get('aspect_type')} "
                f"{event.get('natal_body')}"),
        })
    points.sort(key=lambda p: p["x"])
    return points[:MAX_SERIES_POINTS]


def _bar(events: Sequence[Dict], group_by: str) -> List[Dict]:
    buckets: Dict[str, int] = {}
    for event in events:
        value = event.get(group_by)
        if isinstance(value, dict):          # overridable block
            value = value.get("effective_value")
        if value in (None, ""):
            continue
        key = _clean_label(value, 40)
        buckets[key] = buckets.get(key, 0) + 1
    rows = [{"bucket": k, "value": v} for k, v in buckets.items()]
    rows.sort(key=lambda r: (-r["value"], r["bucket"]))
    return rows


def _network(events: Sequence[Dict]) -> Dict:
    nodes: Dict[str, Dict] = {}
    edges: Dict[str, Dict] = {}
    for event in events:
        left, right = event.get("transit_body"), (
            event.get("axis_group") or event.get("natal_body"))
        if not left or not right:
            continue
        left_id, right_id = f"t:{left}", f"n:{right}"
        for node_id, label, kind in (
                (left_id, left, "transit"), (right_id, right, "natal")):
            node = nodes.setdefault(
                node_id, {"id": node_id, "label": _clean_label(label),
                          "kind": kind, "degree": 0})
            node["degree"] += 1
        key = f"{left_id}|{right_id}"
        edge = edges.setdefault(
            key, {"source": left_id, "target": right_id, "weight": 0})
        edge["weight"] += 1
    return {
        "nodes": sorted(nodes.values(), key=lambda n: (-n["degree"], n["id"])),
        "edges": sorted(edges.values(), key=lambda e: (-e["weight"], e["source"])),
    }


def build_visualization(spec: Dict, events: Sequence[Dict]) -> Dict:
    """Validate the spec and build the series the client will draw."""
    events = list(events or [])
    error = validate_spec(spec, row_count=len(events))
    if error:
        return {"status": "error", "error": error}

    kind = spec["type"]
    group_by = spec.get("group_by")
    if kind == "aspect_timeline":
        series, shape = _timeline(events), "intervals"
    elif kind == "monthly_heatmap":
        series, shape = _heatmap(events), "buckets"
    elif kind == "orb_line":
        series, shape = _orb_line(events), "points"
    elif kind == "bar":
        series, shape = _bar(events, group_by), "buckets"
    else:
        series, shape = _network(events), "graph"

    count = len(series) if isinstance(series, list) else len(series.get("nodes", []))
    if not count:
        return {"status": "error", "error": "no_plottable_data"}

    return {
        "status": "ok",
        "chart": {
            "type": kind,
            "shape": shape,
            "title": _clean_label(spec.get("title") or CHART_TYPES[kind]["summary"], 120),
            "group_by": group_by,
            "series": series,
            # §17 requires alt text. Generated here from what was actually
            # plotted, so it cannot describe a chart the data does not support.
            "alt": _alt_text(kind, count, group_by),
        },
    }


def _alt_text(kind: str, count: int, group_by: Optional[str]) -> str:
    if kind == "aspect_timeline":
        return f"Timeline of {count} contact windows with their exact passes marked."
    if kind == "monthly_heatmap":
        return f"Contact density across {count} months."
    if kind == "orb_line":
        return f"Minimum orb for {count} contacts, ordered in time."
    if kind == "bar":
        return f"Contact counts across {count} values of {group_by}."
    return f"Aspect network with {count} nodes; edge weight is the contact count."
