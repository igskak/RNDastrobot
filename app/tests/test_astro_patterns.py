"""PR5 — Pattern Discovery Engine: deterministic findings over forecast events."""
import pytest

from app.services.astro_patterns import (
    PATTERN_PROFILE,
    RANKING_PROFILE,
    aspect_graph,
    cross_body_patterns,
    discover,
    find_clusters,
    find_gaps,
    find_outliers,
    rank_events,
    statistics_block,
    structural_tallies,
)
from app.services.astro_tool_schemas import build_query_tools


def _event(eid, body, target, enter, leave, *, axis=None, house=None,
           passes=(), stations=(), closest=None, aspect="Conjunction", ruled=None):
    return {
        "event_id": eid, "transit_body": body, "natal_body": target,
        "aspect_type": aspect, "axis_group": axis, "target_natal_house": house,
        "transit_body_ruled_houses": ruled or [],
        "enter": enter, "leave": leave,
        "passes": list(passes), "exact_pass_count": len(passes),
        "stations": list(stations),
        "closest_approach": closest or {"orb": 0.5, "date": enter},
    }


def _pass(date, orb=0.0, motion="direct"):
    return {"date": date, "orb": orb, "motion": motion}


def _tool():
    return next(f["function"] for f in build_query_tools()
                if f["function"]["name"] == "discover_patterns")


# --- clustering ---------------------------------------------------------------

def test_events_whose_passes_are_close_form_one_cluster():
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-01-20T00:00:00+00:00",
               passes=[_pass("2027-01-10T00:00:00+00:00")]),
        _event("b", "Uranus", "Moon", "2027-01-05T00:00:00+00:00", "2027-02-10T00:00:00+00:00",
               passes=[_pass("2027-01-18T00:00:00+00:00")]),
    ]
    clusters = find_clusters(events)
    assert len(clusters) == 1
    assert clusters[0]["event_count"] == 2
    assert clusters[0]["bodies"] == ["Pluto", "Uranus"]


def test_passes_beyond_the_gap_are_separate_clusters():
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-01-20T00:00:00+00:00",
               passes=[_pass("2027-01-10T00:00:00+00:00")]),
        _event("b", "Uranus", "Moon", "2027-06-01T00:00:00+00:00", "2027-06-20T00:00:00+00:00",
               passes=[_pass("2027-06-10T00:00:00+00:00")]),
        _event("c", "Neptune", "Mars", "2027-06-05T00:00:00+00:00", "2027-06-25T00:00:00+00:00",
               passes=[_pass("2027-06-14T00:00:00+00:00")]),
    ]
    clusters = find_clusters(events)
    assert len(clusters) == 1          # only the June pair meets minimum_cluster_events
    assert clusters[0]["event_count"] == 2
    assert clusters[0]["bodies"] == ["Neptune", "Uranus"]


def test_long_overlapping_windows_do_not_chain_into_a_mega_cluster():
    """Outer-planet windows run for months. Clustering on the WINDOW chains a
    whole two-year survey into one 14-month "densest period", which is true and
    useless. Clustering on exact passes finds real concentration."""
    events = [
        _event("a", "Pluto", "Sun", "2026-10-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00",
               passes=[_pass("2026-11-01T00:00:00+00:00")]),
        _event("b", "Uranus", "Moon", "2026-12-01T00:00:00+00:00", "2027-08-01T00:00:00+00:00",
               passes=[_pass("2027-05-01T00:00:00+00:00")]),
    ]
    # Windows overlap for months, but the passes are six months apart.
    assert find_clusters(events) == []


def test_a_lone_event_is_not_a_cluster():
    events = [_event("a", "Pluto", "Sun",
                     "2027-01-01T00:00:00+00:00", "2027-01-20T00:00:00+00:00",
                     passes=[_pass("2027-01-10T00:00:00+00:00")])]
    assert find_clusters(events) == []


def test_contact_without_an_exact_pass_clusters_at_closest_approach():
    """An in-orb period that never perfects is still activity and must not
    vanish from the cluster picture."""
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00",
               passes=[_pass("2027-01-10T00:00:00+00:00")]),
        _event("b", "Neptune", "Moon", "2027-01-01T00:00:00+00:00", "2027-03-01T00:00:00+00:00",
               closest={"orb": 0.4, "date": "2027-01-14T00:00:00+00:00"}),
    ]
    clusters = find_clusters(events)
    assert len(clusters) == 1
    assert sorted(clusters[0]["event_ids"]) == ["a", "b"]


def test_gaps_between_clusters_are_reported():
    clusters = [
        {"start": "2027-01-01T00:00:00+00:00", "end": "2027-02-01T00:00:00+00:00"},
        {"start": "2027-06-01T00:00:00+00:00", "end": "2027-07-01T00:00:00+00:00"},
    ]
    gaps = find_gaps(clusters)
    assert len(gaps) == 1
    assert gaps[0]["days"] == 120.0


# --- structural tallies -------------------------------------------------------

def test_targets_are_axis_collapsed_in_tallies():
    """ASC and DSC contacts describe one axis being worked."""
    events = [
        _event("a", "Pluto", "ASC", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", axis="ASC-DSC", house=1),
        _event("b", "Pluto", "DSC", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", axis="ASC-DSC", house=7),
    ]
    tallies = structural_tallies(events)
    assert tallies["targets"] == [
        {"value": "ASC-DSC", "count": 2, "event_ids": ["a", "b"]}]
    assert tallies["axis_groups"][0]["value"] == "ASC-DSC"


def test_target_categories_are_classified():
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
        _event("b", "Pluto", "MC", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", axis="MC-IC"),
        _event("c", "Pluto", "TrueNorthNode", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00"),
    ]
    values = {row["value"] for row in structural_tallies(events)["target_categories"]}
    assert values == {"personal", "angle", "node"}


def test_ruled_houses_are_tallied_across_events():
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", ruled=[4, 11]),
        _event("b", "Pluto", "Moon", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", ruled=[4]),
    ]
    ruled = {r["value"]: r["count"] for r in structural_tallies(events)["ruled_houses"]}
    assert ruled == {"4": 2, "11": 1}


# --- cross-body ---------------------------------------------------------------

def test_convergence_needs_different_bodies_not_repetition():
    """One planet hitting a target four times is repetition; several planets
    hitting it is convergence. The engine must not confuse them."""
    repeated = [
        _event(f"p{i}", "Pluto", "Sun", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", aspect=a)
        for i, a in enumerate(["Conjunction", "Square", "Trine"])
    ]
    assert cross_body_patterns(repeated)["shared_targets"] == []

    converging = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
        _event("b", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
    ]
    shared = cross_body_patterns(converging)["shared_targets"]
    assert shared[0]["value"] == "Sun"
    assert shared[0]["bodies"] == ["Pluto", "Uranus"]


def test_multi_aspect_pairs_are_detected():
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", aspect="Conjunction"),
        _event("b", "Pluto", "Sun", "2028-01-01T00:00:00+00:00",
               "2028-02-01T00:00:00+00:00", aspect="Square"),
    ]
    pairs = cross_body_patterns(events)["multi_aspect_pairs"]
    assert pairs[0]["pair"] == "Pluto->Sun"
    assert pairs[0]["aspects"] == ["Conjunction", "Square"]


# --- graph --------------------------------------------------------------------

def test_graph_degree_and_hubs():
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
        _event("c", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
    ]
    graph = aspect_graph(events)
    assert graph["edge_count"] == 3
    degrees = {row["node"]: row["degree"] for row in graph["degree_centrality"]}
    assert degrees["t:Pluto"] == 2
    assert degrees["n:Sun"] == 2
    assert graph["component_count"] == 1


def test_graph_separates_unconnected_components():
    """Whether the period is one interlocking story or several unrelated ones is
    a structural fact worth surfacing."""
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
        _event("b", "Neptune", "Mars", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
    ]
    assert aspect_graph(events)["component_count"] == 2


# --- outliers -----------------------------------------------------------------

def test_partile_and_triple_pass_and_station_are_flagged():
    events = [
        _event("a", "Pluto", "MC", "2027-01-01T00:00:00+00:00", "2028-01-01T00:00:00+00:00",
               passes=[_pass("2027-03-01"), _pass("2027-07-01", motion="retrograde"),
                       _pass("2027-11-01")],
               stations=[{"date": "2027-05-01", "type": "R"}],
               closest={"orb": 0.0, "date": "2027-03-01"}),
    ]
    kinds = {o["type"] for o in find_outliers(events)}
    assert {"partile_contact", "triple_pass", "station_in_window"} <= kinds


def test_contact_without_an_exact_pass_is_flagged():
    events = [_event("a", "Neptune", "Sun", "2027-01-01T00:00:00+00:00",
                     "2027-06-01T00:00:00+00:00", closest={"orb": 0.48, "date": "2027-03-01"})]
    kinds = {o["type"] for o in find_outliers(events)}
    assert "no_exact_pass" in kinds
    assert "partile_contact" not in kinds


# --- ranking (§2.6) -----------------------------------------------------------

def test_ranking_exposes_metrics_and_uses_no_synthetic_score():
    """A single hidden number would be a judgement. The astrologer must see the
    actual metrics and be able to rank differently."""
    events = [
        _event("wide", "Neptune", "Sun", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", closest={"orb": 0.9, "date": "2027-01-15"}),
        _event("tight", "Pluto", "MC", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", axis="MC-IC",
               passes=[_pass("2027-01-15")], closest={"orb": 0.0, "date": "2027-01-15"}),
    ]
    rows = rank_events(events)
    assert rows[0]["event_id"] == "tight"
    assert "score" not in rows[0]
    metrics = rows[0]["metrics"]
    assert set(metrics) == {
        "simultaneous_contact_count", "minimum_orb", "exact_pass_count",
        "angle_contact", "duration_days", "station_in_window"}
    assert metrics["angle_contact"] is True


def test_simultaneity_dominates_the_ranking_order():
    """First key in technical_priority_v1: a contact overlapping others outranks
    a tighter but isolated one."""
    events = [
        _event("solo", "Pluto", "Sun", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", closest={"orb": 0.01, "date": "2027-01-15"}),
        _event("crowded", "Uranus", "Moon", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", closest={"orb": 0.8, "date": "2027-01-15"}),
    ]
    segments = [{"event_ids": ["crowded"], "contact_count": 5}]
    assert rank_events(events, segments)[0]["event_id"] == "crowded"


def test_ranking_is_deterministic_for_identical_metrics():
    events = [
        _event("b", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
        _event("a", "Pluto", "Moon", "2027-01-01T00:00:00+00:00", "2027-02-01T00:00:00+00:00"),
    ]
    assert [r["event_id"] for r in rank_events(events)] == ["a", "b"]


# --- statistics ---------------------------------------------------------------

def test_statistics_cover_durations_and_orbs():
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-01-11T00:00:00+00:00",
               closest={"orb": 0.2, "date": "2027-01-05"}),
        _event("b", "Uranus", "Moon", "2027-01-01T00:00:00+00:00", "2027-01-21T00:00:00+00:00",
               closest={"orb": 0.6, "date": "2027-01-10"}),
    ]
    stats = statistics_block(events, [{"contact_count": 2, "event_ids": ["a", "b"]}])
    assert stats["event_count"] == 2
    assert stats["duration_days"]["max"] == 20.0
    assert stats["duration_days"]["median"] == 15.0
    assert stats["min_orb"] == 0.2
    assert stats["max_simultaneous_contacts"] == 2


# --- assembly -----------------------------------------------------------------

def _rich_events():
    return [
        _event("e1", "Pluto", "MC", "2027-01-01T00:00:00+00:00", "2027-03-01T00:00:00+00:00",
               axis="MC-IC", house=10, passes=[_pass("2027-02-01")],
               closest={"orb": 0.0, "date": "2027-02-01"}),
        _event("e2", "Uranus", "MC", "2027-01-15T00:00:00+00:00", "2027-03-15T00:00:00+00:00",
               axis="MC-IC", house=10, passes=[_pass("2027-02-10")],
               closest={"orb": 0.1, "date": "2027-02-10"}),
        _event("e3", "Neptune", "Sun", "2027-09-01T00:00:00+00:00", "2027-11-01T00:00:00+00:00",
               house=4, closest={"orb": 0.7, "date": "2027-10-01"}),
        _event("e4", "Chiron", "Sun", "2027-09-10T00:00:00+00:00", "2027-10-20T00:00:00+00:00",
               house=4, closest={"orb": 0.4, "date": "2027-10-01"}),
    ]


def test_discover_emits_findings_with_evidence():
    out = discover(_rich_events(), [
        {"start": "2027-01-15T00:00:00+00:00", "end": "2027-03-01T00:00:00+00:00",
         "contact_count": 2, "bodies": ["Pluto", "Uranus"], "event_ids": ["e1", "e2"]}])
    assert out["status"] == "ok"
    assert out["pattern_profile"] == "forecast_patterns_v1"
    assert out["ranking_profile"] == "technical_priority_v1"
    kinds = {f["type"] for f in out["patterns"]}
    assert {"highest_density", "repeated_targets", "axis_activation",
            "multi_body_convergence", "simultaneous_peak"} <= kinds
    # Every finding must be traceable to records — a finding with no evidence
    # cannot be cited, which breaks the rule the engine rests on.
    for finding in out["patterns"]:
        assert finding["finding_id"].startswith("f_")
        assert finding["evidence_ids"], f"{finding['type']} carries no evidence"


def test_findings_reference_only_real_event_ids():
    events = _rich_events()
    valid = {e["event_id"] for e in events}
    out = discover(events)
    for finding in out["patterns"]:
        assert set(finding["evidence_ids"]) <= valid


def test_scattered_activity_is_reportable_as_having_no_dominant_cluster():
    """A period without concentration must be statable as exactly that, not
    dressed up as a cluster."""
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00", "2027-01-05T00:00:00+00:00"),
        _event("b", "Uranus", "Moon", "2027-06-01T00:00:00+00:00", "2027-06-05T00:00:00+00:00"),
        _event("c", "Neptune", "Mars", "2027-12-01T00:00:00+00:00", "2027-12-05T00:00:00+00:00"),
    ]
    kinds = {f["type"] for f in discover(events)["patterns"]}
    assert "no_dominant_cluster" in kinds
    assert "highest_density" not in kinds


def test_empty_window_is_clean_and_noted():
    out = discover([])
    assert out["status"] == "ok"
    assert out["patterns"] == []
    assert out["executive_summary"]["event_count"] == 0
    assert "no_events_in_window" in out["technical_notes"]


def test_output_carries_no_interpretive_field():
    """The boundary is structural: there is no field that could hold meaning."""
    out = discover(_rich_events())
    blob = repr(out).lower()
    for word in ("meaning", "indicates", "suggests", "favorable", "challenging",
                 "personality", "career", "relationship"):
        assert word not in blob


def test_discover_is_deterministic():
    events = _rich_events()
    assert discover(events) == discover(events)


# --- the schema the model reads ------------------------------------------------

def test_tool_description_binds_the_boundary_and_citation_rules():
    desc = _tool()["description"].lower()
    assert "evidence_ids" in desc
    assert "never" in desc and "means" in desc          # reports what, not what it means
    assert "survey_transits" in desc


def test_tool_takes_no_chart_identifier():
    props = _tool()["parameters"]["properties"]
    assert not {"user_id", "chart_id", "survey_id"} & set(props)


def test_profiles_are_versioned():
    """Thresholds move; past findings must keep meaning."""
    assert PATTERN_PROFILE["id"].endswith("_v1")
    assert RANKING_PROFILE["id"].endswith("_v1")
    assert len(RANKING_PROFILE["sort_order"]) == 6
