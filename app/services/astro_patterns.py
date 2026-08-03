"""
Pattern Discovery Engine (chat-v2 slice 2, PR5).

Turns validated forecast events into objective higher-level findings. This is
deterministic code, NOT a model: a language model asked to spot "the densest
cluster" will produce a confident number it did not compute. Here every figure
comes from arithmetic over the events, and every finding carries the event ids it
rests on, so the narrative layer can only restate what was measured.

Hard boundary: nothing here assigns MEANING. Clustering, ranking, frequency,
duration, exactness, centrality and outlier detection are measurements. What a
configuration signifies for a person is out of scope by construction — there is
no field in the output that could carry it.

Thresholds are versioned (``forecast_patterns_v1``). A survey persists its
profile id, so when the thresholds move, past findings keep meaning instead of
silently re-interpreting under new cutoffs.
"""
from __future__ import annotations

import statistics
from datetime import datetime
from typing import Dict, List, Optional, Sequence

PATTERN_PROFILE = {
    "id": "forecast_patterns_v1",
    # Two contacts separated by more than this are separate clusters. Chosen to
    # match how astrologers read a "period": a fortnight of quiet breaks it.
    "cluster_gap_days": 14,
    "minimum_cluster_events": 2,
    # Percentile cutoffs for "notably long" and "notably dense". Percentile
    # rather than a fixed day count: what counts as long depends on the bodies
    # surveyed — a Pluto contact dwarfs a Mars one.
    "long_window_percentile": 90,
    "high_density_percentile": 90,
    # Below this orb a contact is partile — an exactness outlier worth surfacing.
    "partile_orb": 0.25,
}

# §2.6: no synthetic importance score. Independent metrics, ordered, so the
# astrologer sees WHY something ranks where it does and can disagree.
RANKING_PROFILE = {
    "id": "technical_priority_v1",
    "sort_order": [
        "simultaneous_contact_count_desc",
        "minimum_orb_asc",
        "exact_pass_count_desc",
        "angle_contact_desc",
        "duration_desc",
        "station_in_window_desc",
    ],
}

_PERSONAL = frozenset({"Sun", "Moon", "Mercury", "Venus", "Mars"})
_SOCIAL = frozenset({"Jupiter", "Saturn"})
_OUTER = frozenset({"Uranus", "Neptune", "Pluto", "Chiron"})
_NODES = frozenset({"TrueNorthNode", "TrueSouthNode"})


def _parse(value) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        try:
            return datetime.fromisoformat(value[:10])
        except ValueError:
            return None


def _duration_days(event: Dict) -> Optional[float]:
    start, end = _parse(event.get("enter")), _parse(event.get("leave"))
    if start is None or end is None:
        return None
    return round((end - start).total_seconds() / 86400.0, 2)


def _min_orb(event: Dict) -> Optional[float]:
    """Tightest orb reached: an exact pass is 0, otherwise closest approach."""
    passes = event.get("passes") or []
    if passes:
        orbs = [p.get("orb") for p in passes if isinstance(p.get("orb"), (int, float))]
        if orbs:
            return min(orbs)
    closest = event.get("closest_approach") or {}
    value = closest.get("orb")
    return value if isinstance(value, (int, float)) else None


def _target_category(natal_body: str) -> str:
    if natal_body in _PERSONAL:
        return "personal"
    if natal_body in _SOCIAL:
        return "social"
    if natal_body in _OUTER:
        return "outer"
    if natal_body in _NODES:
        return "node"
    if natal_body == "BlackMoon":
        return "lilith"
    return "angle" if natal_body in {"ASC", "DSC", "MC", "IC"} else "other"


def _percentile(values: Sequence[float], pct: float) -> Optional[float]:
    """Nearest-rank percentile. Explicit rather than numpy: one dependency less,
    and the tie behaviour stays predictable for small samples."""
    clean = sorted(v for v in values if isinstance(v, (int, float)))
    if not clean:
        return None
    if len(clean) == 1:
        return clean[0]
    rank = max(1, min(len(clean), int(round(pct / 100.0 * len(clean)))))
    return clean[rank - 1]


def _finding(index: int, kind: str, data: Dict, evidence: Sequence[str],
             metrics: Optional[Dict] = None) -> Dict:
    return {
        "finding_id": f"f_{index:03d}",
        "type": kind,
        "statement_data": data,
        "evidence_ids": list(evidence),
        "metrics": metrics or {},
    }


# --- temporal ----------------------------------------------------------------

def _cluster_anchor(event: Dict):
    """The moment an event actually lands: its exact passes.

    Clustering on the WINDOW instead chains outer-planet contacts into
    meaningless mega-clusters — Pluto windows run for months, so every contact in
    a two-year survey ends up within a fortnight of the next one and "the densest
    period" comes back as fourteen months. Exact passes are point events, so
    grouping them finds real concentration. A contact that never perfects is
    anchored at its closest approach rather than dropped, since an in-orb period
    with no hit is still activity.
    """
    dates = [_parse(p.get("date")) for p in event.get("passes") or []]
    dates = [d for d in dates if d]
    if dates:
        return dates
    closest = _parse((event.get("closest_approach") or {}).get("date"))
    return [closest] if closest else []


def find_clusters(events: Sequence[Dict], profile: Dict = PATTERN_PROFILE) -> List[Dict]:
    """Group events whose exact passes sit within ``cluster_gap_days``.

    Window overlap is a different question and is answered by the sweep-line in
    astro_intervals; this one is "when do things perfect together".
    """
    dated = []
    for event in events or []:
        anchors = _cluster_anchor(event)
        if anchors:
            dated.append((min(anchors), max(anchors), event))
    if not dated:
        return []
    dated.sort(key=lambda t: t[0])

    gap = profile["cluster_gap_days"] * 86400.0
    clusters: List[Dict] = []
    current = [dated[0]]
    reach = dated[0][1]
    for start, end, event in dated[1:]:
        if (start - reach).total_seconds() <= gap:
            current.append((start, end, event))
            reach = max(reach, end)
        else:
            clusters.append(current)
            current = [(start, end, event)]
            reach = end
    clusters.append(current)

    out = []
    for members in clusters:
        if len(members) < profile["minimum_cluster_events"]:
            continue
        out.append({
            "start": min(m[0] for m in members).isoformat(),
            "end": max(m[1] for m in members).isoformat(),
            "event_count": len(members),
            "exact_pass_count": sum(m[2].get("exact_pass_count", 0) for m in members),
            "bodies": sorted({m[2].get("transit_body") for m in members if m[2].get("transit_body")}),
            "targets": sorted({m[2].get("natal_body") for m in members if m[2].get("natal_body")}),
            "event_ids": [m[2].get("event_id") for m in members],
        })
    return out


def find_gaps(clusters: Sequence[Dict]) -> List[Dict]:
    """Quiet stretches between clusters — as much a finding as the busy ones."""
    gaps = []
    for previous, following in zip(clusters, clusters[1:]):
        start, end = _parse(previous["end"]), _parse(following["start"])
        if start and end and end > start:
            gaps.append({
                "start": previous["end"],
                "end": following["start"],
                "days": round((end - start).total_seconds() / 86400.0, 1),
            })
    return gaps


# --- structural --------------------------------------------------------------

def _tally(events: Sequence[Dict], key) -> List[Dict]:
    """Count events by a key, with the contributing ids kept for evidence."""
    buckets: Dict[str, List[str]] = {}
    for event in events or []:
        value = key(event)
        if value in (None, ""):
            continue
        buckets.setdefault(str(value), []).append(event.get("event_id"))
    rows = [
        {"value": value, "count": len(ids), "event_ids": ids}
        for value, ids in buckets.items()
    ]
    rows.sort(key=lambda r: (-r["count"], r["value"]))
    return rows


def structural_tallies(events: Sequence[Dict]) -> Dict[str, List[Dict]]:
    """Which parts of the chart are activated, and how often.

    Targets are axis-collapsed: an ASC contact and a DSC contact from the same
    body describe one axis being worked, and counting them separately would
    overstate how much of the chart is involved.
    """
    return {
        "targets": _tally(events, lambda e: e.get("axis_group") or e.get("natal_body")),
        "houses": _tally(events, lambda e: e.get("target_natal_house")),
        "bodies": _tally(events, lambda e: e.get("transit_body")),
        "aspects": _tally(events, lambda e: e.get("aspect_type")),
        "target_categories": _tally(
            events, lambda e: _target_category(e.get("natal_body") or "")),
        "axis_groups": _tally(events, lambda e: e.get("axis_group")),
        "ruled_houses": _tally_multi(events, lambda e: e.get("transit_body_ruled_houses") or []),
    }


def _tally_multi(events: Sequence[Dict], key) -> List[Dict]:
    buckets: Dict[str, List[str]] = {}
    for event in events or []:
        for value in key(event) or []:
            buckets.setdefault(str(value), []).append(event.get("event_id"))
    rows = [{"value": v, "count": len(ids), "event_ids": ids} for v, ids in buckets.items()]
    rows.sort(key=lambda r: (-r["count"], r["value"]))
    return rows


def cross_body_patterns(events: Sequence[Dict]) -> Dict[str, List[Dict]]:
    """Where two or more DIFFERENT transiting bodies converge.

    One planet hitting a target four times is repetition; four planets hitting it
    is convergence. Distinguishing them is the point.
    """
    by_target: Dict[str, Dict] = {}
    by_house: Dict[str, Dict] = {}
    for event in events or []:
        body = event.get("transit_body")
        if not body:
            continue
        target = event.get("axis_group") or event.get("natal_body")
        if target:
            slot = by_target.setdefault(str(target), {"bodies": set(), "event_ids": []})
            slot["bodies"].add(body)
            slot["event_ids"].append(event.get("event_id"))
        house = event.get("target_natal_house")
        if house is not None:
            slot = by_house.setdefault(str(house), {"bodies": set(), "event_ids": []})
            slot["bodies"].add(body)
            slot["event_ids"].append(event.get("event_id"))

    def _shared(source: Dict) -> List[Dict]:
        rows = [
            {"value": value, "body_count": len(slot["bodies"]),
             "bodies": sorted(slot["bodies"]), "event_ids": slot["event_ids"]}
            for value, slot in source.items() if len(slot["bodies"]) >= 2
        ]
        rows.sort(key=lambda r: (-r["body_count"], r["value"]))
        return rows

    # Same target reached through different aspect types by the same body.
    multi_aspect: Dict[str, set] = {}
    for event in events or []:
        key = f"{event.get('transit_body')}->{event.get('axis_group') or event.get('natal_body')}"
        if event.get("aspect_type"):
            multi_aspect.setdefault(key, set()).add(event["aspect_type"])
    return {
        "shared_targets": _shared(by_target),
        "shared_houses": _shared(by_house),
        "multi_aspect_pairs": sorted(
            [{"pair": k, "aspects": sorted(v)} for k, v in multi_aspect.items() if len(v) >= 2],
            key=lambda r: r["pair"]),
    }


# --- graph -------------------------------------------------------------------

def aspect_graph(events: Sequence[Dict]) -> Dict:
    """The forecast as a graph: bodies and targets are nodes, contacts are edges.

    Degree centrality says which points carry the most of the period's activity.
    Connected components say whether the period is one interlocking story or
    several unrelated ones — a structural fact, with no claim about meaning.
    """
    degree: Dict[str, int] = {}
    adjacency: Dict[str, set] = {}
    for event in events or []:
        left = event.get("transit_body")
        right = event.get("axis_group") or event.get("natal_body")
        if not left or not right:
            continue
        left_node, right_node = f"t:{left}", f"n:{right}"
        degree[left_node] = degree.get(left_node, 0) + 1
        degree[right_node] = degree.get(right_node, 0) + 1
        adjacency.setdefault(left_node, set()).add(right_node)
        adjacency.setdefault(right_node, set()).add(left_node)

    seen: set = set()
    components: List[List[str]] = []
    for node in sorted(adjacency):
        if node in seen:
            continue
        stack, group = [node], []
        seen.add(node)
        while stack:
            current = stack.pop()
            group.append(current)
            for neighbour in adjacency.get(current, ()):
                if neighbour not in seen:
                    seen.add(neighbour)
                    stack.append(neighbour)
        components.append(sorted(group))

    ranked = sorted(degree.items(), key=lambda kv: (-kv[1], kv[0]))
    return {
        "node_count": len(degree),
        "edge_count": sum(1 for e in events or []
                          if e.get("transit_body") and (e.get("axis_group") or e.get("natal_body"))),
        "degree_centrality": [{"node": n, "degree": d} for n, d in ranked],
        "hubs": [n for n, d in ranked if ranked and d == ranked[0][1]],
        "component_count": len(components),
        "components": components,
    }


# --- outliers ----------------------------------------------------------------

def find_outliers(events: Sequence[Dict], profile: Dict = PATTERN_PROFILE) -> List[Dict]:
    """Records that stand out by an objective measure, with the measure named."""
    out: List[Dict] = []
    durations = [d for d in (_duration_days(e) for e in events or []) if d is not None]
    long_cut = _percentile(durations, profile["long_window_percentile"])

    for event in events or []:
        eid = event.get("event_id")
        duration = _duration_days(event)
        if long_cut is not None and duration is not None and duration >= long_cut and len(durations) > 1:
            out.append({"type": "long_window", "event_id": eid,
                        "metric": {"duration_days": duration, "cutoff": long_cut}})
        orb = _min_orb(event)
        if orb is not None and orb <= profile["partile_orb"]:
            out.append({"type": "partile_contact", "event_id": eid,
                        "metric": {"min_orb": orb}})
        if event.get("exact_pass_count", 0) >= 3:
            out.append({"type": "triple_pass", "event_id": eid,
                        "metric": {"exact_pass_count": event["exact_pass_count"]}})
        if event.get("stations"):
            out.append({"type": "station_in_window", "event_id": eid,
                        "metric": {"station_count": len(event["stations"])}})
        if not (event.get("passes") or []):
            out.append({"type": "no_exact_pass", "event_id": eid,
                        "metric": {"min_orb": orb}})
    return out


# --- statistics + ranking ----------------------------------------------------

def statistics_block(events: Sequence[Dict], segments: Sequence[Dict] = ()) -> Dict:
    durations = [d for d in (_duration_days(e) for e in events or []) if d is not None]
    orbs = [o for o in (_min_orb(e) for e in events or []) if o is not None]
    return {
        "event_count": len(events or []),
        "exact_pass_count": sum(e.get("exact_pass_count", 0) for e in events or []),
        "unique_targets": len({(e.get("axis_group") or e.get("natal_body"))
                               for e in events or [] if e.get("natal_body")}),
        "unique_bodies": len({e.get("transit_body") for e in events or [] if e.get("transit_body")}),
        "duration_days": {
            "mean": round(statistics.fmean(durations), 2) if durations else None,
            "median": round(statistics.median(durations), 2) if durations else None,
            "max": max(durations) if durations else None,
            "min": min(durations) if durations else None,
        },
        "min_orb": min(orbs) if orbs else None,
        "max_simultaneous_contacts": max(
            (s.get("contact_count", 0) for s in segments or ()), default=0),
        "segment_count": len(segments or ()),
    }


def rank_events(events: Sequence[Dict], segments: Sequence[Dict] = (),
                profile: Dict = RANKING_PROFILE) -> List[Dict]:
    """Order by the declared metric sequence, exposing every metric used.

    No synthetic score: the astrologer sees the actual numbers and can rank
    differently. A single hidden number would be a judgement, not a measurement.
    """
    simultaneity: Dict[str, int] = {}
    for segment in segments or ():
        for eid in segment.get("event_ids") or []:
            simultaneity[eid] = max(simultaneity.get(eid, 0),
                                    segment.get("contact_count", 0))

    rows = []
    for event in events or []:
        eid = event.get("event_id")
        orb = _min_orb(event)
        rows.append({
            "event_id": eid,
            "transit_body": event.get("transit_body"),
            "natal_body": event.get("natal_body"),
            "aspect_type": event.get("aspect_type"),
            "metrics": {
                "simultaneous_contact_count": simultaneity.get(eid, 0),
                "minimum_orb": orb,
                "exact_pass_count": event.get("exact_pass_count", 0),
                "angle_contact": bool(event.get("axis_group")),
                "duration_days": _duration_days(event),
                "station_in_window": bool(event.get("stations")),
            },
        })

    def _key(row):
        m = row["metrics"]
        return (
            -m["simultaneous_contact_count"],
            m["minimum_orb"] if m["minimum_orb"] is not None else 99,
            -m["exact_pass_count"],
            0 if m["angle_contact"] else 1,
            -(m["duration_days"] or 0),
            0 if m["station_in_window"] else 1,
            row["event_id"] or "",     # deterministic tiebreak
        )

    rows.sort(key=_key)
    return rows


# How many full records travel with the findings. Enough to write a supporting
# section, few enough not to swamp the payload with a 400-event survey.
_EVIDENCE_LIMIT = 12


def _supporting_events(events: Sequence[Dict], ranking: Sequence[Dict]) -> List[Dict]:
    """The highest-ranked records, in full, so findings can actually be cited.

    Ranked order rather than chronological: these are the ones a reply is most
    likely to detail, and a caller that needs the rest can survey directly.
    """
    by_id = {e.get("event_id"): e for e in events or []}
    out = []
    for row in ranking[:_EVIDENCE_LIMIT]:
        event = by_id.get(row.get("event_id"))
        if event:
            out.append(event)
    return out


# --- assembly ----------------------------------------------------------------

def discover(events: Sequence[Dict], segments: Sequence[Dict] = (),
             profile: Dict = PATTERN_PROFILE) -> Dict:
    """Structured Findings for one survey. Every number here was computed here.

    Findings are emitted only when the data supports them: no clusters means no
    cluster finding, not an empty-but-confident one. A period with no dominant
    concentration must be reportable as exactly that.
    """
    events = list(events or [])
    segments = list(segments or ())
    clusters = find_clusters(events, profile)
    tallies = structural_tallies(events)
    cross = cross_body_patterns(events)
    graph = aspect_graph(events)
    outliers = find_outliers(events, profile)
    stats = statistics_block(events, segments)
    ranking = rank_events(events, segments)

    findings: List[Dict] = []
    index = 1

    densest = max(clusters, key=lambda c: c["event_count"], default=None) if clusters else None
    if densest:
        findings.append(_finding(index, "highest_density", {
            "start": densest["start"], "end": densest["end"],
            "event_count": densest["event_count"], "bodies": densest["bodies"],
        }, densest["event_ids"], {"event_count": densest["event_count"]}))
        index += 1

    if len(clusters) > 1:
        findings.append(_finding(index, "cluster_structure", {
            "cluster_count": len(clusters),
            "gap_days_threshold": profile["cluster_gap_days"],
        }, [eid for c in clusters for eid in c["event_ids"]],
            {"cluster_count": len(clusters)}))
        index += 1
    elif events and not clusters:
        # Explicitly reportable: activity exists but is too scattered to cluster.
        findings.append(_finding(index, "no_dominant_cluster", {
            "reason": "no group of events falls within the cluster gap",
            "gap_days_threshold": profile["cluster_gap_days"],
        }, [e.get("event_id") for e in events], {}))
        index += 1

    top_targets = [t for t in tallies["targets"] if t["count"] > 1][:3]
    if top_targets:
        findings.append(_finding(index, "repeated_targets", {
            "targets": [{"target": t["value"], "count": t["count"]} for t in top_targets],
        }, [eid for t in top_targets for eid in t["event_ids"]],
            {"top_count": top_targets[0]["count"]}))
        index += 1

    if tallies["axis_groups"]:
        findings.append(_finding(index, "axis_activation", {
            "axes": [{"axis": a["value"], "count": a["count"]} for a in tallies["axis_groups"]],
        }, [eid for a in tallies["axis_groups"] for eid in a["event_ids"]], {}))
        index += 1

    if cross["shared_targets"]:
        top = cross["shared_targets"][0]
        findings.append(_finding(index, "multi_body_convergence", {
            "target": top["value"], "bodies": top["bodies"],
        }, top["event_ids"], {"body_count": top["body_count"]}))
        index += 1

    if stats["max_simultaneous_contacts"] >= 2:
        peak = max(segments, key=lambda s: s.get("contact_count", 0))
        findings.append(_finding(index, "simultaneous_peak", {
            "start": peak.get("start"), "end": peak.get("end"),
            "bodies": peak.get("bodies"),
        }, peak.get("event_ids") or [],
            {"contact_count": peak.get("contact_count")}))
        index += 1

    if graph["hubs"] and graph["node_count"] > 2:
        # A finding with no evidence cannot be cited, which breaks the rule the
        # whole engine rests on. Attach the events that touch the hub nodes.
        hub_names = {h.split(":", 1)[1] for h in graph["hubs"]}
        hub_events = [
            e.get("event_id") for e in events
            if e.get("transit_body") in hub_names
            or (e.get("axis_group") or e.get("natal_body")) in hub_names
        ]
        findings.append(_finding(index, "graph_hub", {
            "hubs": graph["hubs"],
            "degree": graph["degree_centrality"][0]["degree"] if graph["degree_centrality"] else 0,
        }, hub_events, {"node_count": graph["node_count"],
                        "component_count": graph["component_count"]}))
        index += 1

    notes: List[str] = []
    if not events:
        notes.append("no_events_in_window")
    if stats["segment_count"] == 0 and events:
        notes.append("no_overlap_data_supplied")

    return {
        "status": "ok",
        "pattern_profile": profile["id"],
        "ranking_profile": RANKING_PROFILE["id"],
        "executive_summary": {
            "event_count": stats["event_count"],
            "cluster_count": len(clusters),
            "highest_density_period": (
                {"start": densest["start"], "end": densest["end"],
                 "event_count": densest["event_count"]} if densest else None),
            "most_repeated_targets": [
                {"target": t["value"], "count": t["count"]} for t in tallies["targets"][:3]],
            "main_axis_patterns": [
                {"axis": a["value"], "count": a["count"]} for a in tallies["axis_groups"]],
            "max_simultaneous_contacts": stats["max_simultaneous_contacts"],
        },
        "patterns": findings,
        "clusters": clusters,
        "gaps": find_gaps(clusters),
        "structural": tallies,
        "cross_body": cross,
        "graph": graph,
        "outliers": outliers,
        "statistics": stats,
        "ranking": ranking,
        # The records behind the findings. Without them evidence_ids point at
        # nothing the reader can see, and a caller told to report contact detail
        # will invent the dates — observed on the first live run, where the model
        # wrote eight fully-formed enter/exact/leave records out of thin air.
        # Bounded to the top of the ranking so the payload stays usable; the
        # count of omitted records is stated rather than left implicit.
        "supporting_events": _supporting_events(events, ranking),
        "supporting_events_omitted": max(0, len(events) - _EVIDENCE_LIMIT),
        "technical_notes": notes,
        "warnings": [],
    }
