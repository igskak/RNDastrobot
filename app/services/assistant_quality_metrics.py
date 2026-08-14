"""
§26 quality metrics over captured turns.

Read-only aggregation of what the assistant actually did, so the rework's targets
stop being assertions. Every figure here comes from `assistant_turn_metrics`
columns the chat path already writes; nothing is recomputed or inferred.

The one that matters most is ``broad_query_bulk_tool_rate``: the whole slice was
built on the claim that a period question should reach a bulk tool, and until now
there was no way to check whether it does.
"""
from __future__ import annotations

from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import AssistantTurnMetric

# Tools that answer a period question in one call. A turn that used one of these
# took the intended path.
BULK_TOOLS = frozenset({
    "survey_transits", "discover_patterns", "intersect_forecast_windows",
    "survey_symbolic_ingresses",
})

# The atomic pair tool. Several of these in ONE turn is the failure the bulk
# tools exist to prevent — the model fanning out one pair at a time until the
# iteration budget runs out.
PAIR_TOOL = "find_aspect_passes"
_PAIR_FANOUT_THRESHOLD = 3


def _rate(numerator: int, denominator: int) -> Optional[float]:
    """None rather than 0.0 for an empty denominator: 'no data' and 'zero
    percent' are different claims and must not be confused in a report."""
    if not denominator:
        return None
    return round(numerator / denominator, 4)


def compute_quality_metrics(
    db: Session,
    *,
    astrologer_id: Optional[UUID] = None,
    limit: int = 500,
) -> Dict:
    """Aggregate the recent turns. Scoped to one astrologer when given."""
    query = db.query(AssistantTurnMetric)
    if astrologer_id is not None:
        query = query.filter(AssistantTurnMetric.astrologer_id == astrologer_id)
    rows: List[AssistantTurnMetric] = (
        query.order_by(AssistantTurnMetric.id.desc()).limit(max(1, limit)).all())

    total = len(rows)
    captured = [r for r in rows if r.tools_used is not None]

    bulk_turns = 0
    pair_fanout_turns = 0
    tool_turns = 0
    ungrounded_turns = 0
    ungrounded_dates = 0
    narrated_turns = 0
    truncation_turns = 0
    guardrail: Dict[str, int] = {}
    tool_usage: Dict[str, int] = {}
    narrative: Dict[str, int] = {}

    for row in rows:
        names = list(row.tools_used or [])
        for name in names:
            tool_usage[name] = tool_usage.get(name, 0) + 1
        if names:
            tool_turns += 1
            if any(n in BULK_TOOLS for n in names):
                bulk_turns += 1
            if names.count(PAIR_TOOL) >= _PAIR_FANOUT_THRESHOLD:
                pair_fanout_turns += 1

        dates = row.unsupported_dates or []
        if dates:
            ungrounded_turns += 1
            ungrounded_dates += len(dates)

        if row.narrated:
            narrated_turns += 1
        # A low narrated_rate is only actionable once you know WHY. Counting the
        # reason here means the stage being off, the model rejecting the call and
        # an empty completion are three different numbers, not one.
        diag = row.narrative_diag or {}
        status = diag.get("status") if isinstance(diag, dict) else None
        if status:
            narrative[status] = narrative.get(status, 0) + 1
        if row.max_iterations_reached:
            truncation_turns += 1

        key = row.guardrail or "none"
        guardrail[key] = guardrail.get(key, 0) + 1

    return {
        "turns": total,
        "turns_with_capture": len(captured),
        "targets": {
            # A turn that used any tool should mostly be reaching a bulk one when
            # the question was broad. We cannot classify intent from here, so
            # this is the observable proxy, not a verdict.
            "bulk_tool_rate_of_tool_turns": _rate(bulk_turns, tool_turns),
            # §26 wants unsupported_number_rate = 0.
            "unsupported_date_turn_rate": _rate(ungrounded_turns, total),
            "max_iteration_rate": _rate(truncation_turns, total),
            "narrated_rate": _rate(narrated_turns, total),
        },
        "counts": {
            "bulk_turns": bulk_turns,
            "pair_fanout_turns": pair_fanout_turns,
            "ungrounded_turns": ungrounded_turns,
            "ungrounded_dates": ungrounded_dates,
        },
        "guardrail": dict(sorted(guardrail.items(), key=lambda kv: -kv[1])),
        "narrative_status": dict(sorted(narrative.items(), key=lambda kv: -kv[1])),
        "tool_usage": dict(sorted(tool_usage.items(), key=lambda kv: -kv[1])),
    }


def recent_ungrounded_turns(
    db: Session,
    *,
    astrologer_id: Optional[UUID] = None,
    limit: int = 20,
) -> List[Dict]:
    """Turns that asserted a date no tool produced — the fabrication worth
    reading by hand, not just counting."""
    query = db.query(AssistantTurnMetric).filter(
        AssistantTurnMetric.unsupported_dates.isnot(None))
    if astrologer_id is not None:
        query = query.filter(AssistantTurnMetric.astrologer_id == astrologer_id)
    rows = query.order_by(AssistantTurnMetric.id.desc()).limit(max(1, limit)).all()
    return [
        {
            "metric_id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "unsupported_dates": r.unsupported_dates,
            "tools_used": r.tools_used,
            "guardrail": r.guardrail,
        }
        for r in rows if r.unsupported_dates
    ]
