"""
Interval intersection for forecast events (chat-v2 slice 2, PR3).

Answers "when are several things active at once" — the question behind
"когда Уран и Плутон одновременно аспектируют карту". Pure functions over the
event shape produced by survey_transits: no DB, no ephemeris, no model.

Sweep-line, deliberately: the naive approach of merging any overlapping windows
loses exactly the information the astrologer wants. If Uranus leaves orb on
March 1 and Neptune enters on March 2, a merged window claims continuous
activity across a gap where nothing overlapped. So the timeline is split at every
boundary where the ACTIVE SET changes, and two segments are joined only when
their active sets are identical.

Intervals are half-open [enter, leave): a contact that ends exactly when another
begins does not count as simultaneous, which is the astrologically honest reading.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Sequence

# Events whose window cannot be parsed are excluded from the sweep and reported,
# never silently treated as zero-length or as spanning everything.
_UNPARSEABLE = "unparseable_window"


def _parse(value) -> Optional[datetime]:
    """ISO timestamp (with or without offset) to datetime. None when unusable.

    Mixed offsets are normal here: engine output carries local offsets that shift
    across DST, so comparisons must happen on aware datetimes. A naive value is
    left naive and only compared with other naive values (see _sweepable).
    """
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        try:
            return datetime.fromisoformat(value[:10])
        except ValueError:
            return None


def _sweepable(events: Sequence[Dict]):
    """Split events into (usable, skipped) and normalise their bounds.

    Mixing aware and naive datetimes raises on comparison, so if the batch is
    mixed we drop the naive minority rather than guessing a timezone for them.
    """
    parsed = []
    skipped: List[str] = []
    for event in events or []:
        start = _parse(event.get("enter"))
        end = _parse(event.get("leave"))
        if start is None or end is None or end < start:
            skipped.append(event.get("event_id") or "?")
            continue
        parsed.append((start, end, event))

    if not parsed:
        return [], skipped
    aware = [p for p in parsed if p[0].tzinfo is not None and p[1].tzinfo is not None]
    naive = [p for p in parsed if p not in aware]
    if aware and naive:
        skipped.extend(e.get("event_id") or "?" for _, _, e in naive)
        parsed = aware
    return parsed, skipped


def _segment_shape(active: List[Dict]) -> Dict:
    """Counts for one segment.

    ``contact_count`` is raw records. ``unique_target_count`` collapses an axis to
    one: Pluto conjunct IC and Pluto opposite MC are two real contacts describing
    a single IC-MC activation, and counting them as two distinct targets would
    overstate how much of the chart is involved.
    """
    bodies = sorted({e.get("transit_body") for e in active if e.get("transit_body")})
    axis_groups = sorted({e["axis_group"] for e in active if e.get("axis_group")})
    targets = {e.get("axis_group") or e.get("natal_body") for e in active}
    return {
        "contact_count": len(active),
        "unique_target_count": len({t for t in targets if t}),
        "unique_body_count": len(bodies),
        "bodies": bodies,
        "axis_groups": axis_groups,
        "event_ids": [e.get("event_id") for e in active],
    }


def intersect_windows(
    events: Sequence[Dict],
    *,
    min_contacts: int = 2,
    min_bodies: int = 1,
    bodies: Optional[Sequence[str]] = None,
) -> Dict:
    """Segments of the timeline where the active set meets the thresholds.

    ``min_contacts`` — how many contacts must overlap.
    ``min_bodies``   — how many DISTINCT transiting bodies must be involved.
    ``bodies``       — when given, every one of these must be active in a segment
                       ("when are Uranus AND Pluto both aspecting"), which is a
                       different question from "when do any two contacts overlap".

    Segments carry the exact event ids that were active, so a caller can cite the
    underlying records rather than re-deriving them.
    """
    parsed, skipped = _sweepable(events)
    warnings: List[str] = []
    if skipped:
        warnings.append(f"{_UNPARSEABLE}:{len(skipped)}")

    required = set(bodies or ())
    boundaries = sorted({p[0] for p in parsed} | {p[1] for p in parsed})

    segments: List[Dict] = []
    for index in range(len(boundaries) - 1):
        start, end = boundaries[index], boundaries[index + 1]
        # Half-open: active at `start` means it began at or before start and has
        # not yet left. An event ending exactly at `start` is already gone.
        active = [e for (s, l, e) in parsed if s <= start and l > start]
        if not active:
            continue
        shape = _segment_shape(active)
        if shape["contact_count"] < min_contacts:
            continue
        if shape["unique_body_count"] < min_bodies:
            continue
        if required and not required.issubset(set(shape["bodies"])):
            continue

        previous = segments[-1] if segments else None
        # Join only when the active set is IDENTICAL and the segments touch.
        # Different sets stay separate: that distinction is the whole point.
        if (previous
                and previous["_end"] == start
                and previous["event_ids"] == shape["event_ids"]):
            previous["_end"] = end
            previous["end"] = end.isoformat()
            continue

        segments.append({
            "start": start.isoformat(),
            "end": end.isoformat(),
            "_end": end,
            **shape,
        })

    for segment in segments:
        segment.pop("_end", None)

    peak = max((s["contact_count"] for s in segments), default=0)
    return {
        "status": "ok",
        "segments": segments,
        "summary": {
            "segment_count": len(segments),
            "max_simultaneous_contacts": peak,
            "densest_segment": next(
                (s for s in segments if s["contact_count"] == peak), None),
        },
        "criteria": {
            "min_contacts": min_contacts,
            "min_bodies": min_bodies,
            "required_bodies": sorted(required) if required else None,
        },
        "warnings": warnings,
    }
