"""PR3 — sweep-line intersection of forecast windows."""
from uuid import uuid4

import pytest

from app.services.astro_intervals import intersect_windows
from app.services.astro_tool_schemas import build_query_tools


def _event(eid, body, target, enter, leave, axis=None):
    return {
        "event_id": eid, "transit_body": body, "natal_body": target,
        "axis_group": axis, "enter": enter, "leave": leave,
    }


def _tool():
    return next(f["function"] for f in build_query_tools()
                if f["function"]["name"] == "intersect_forecast_windows")


# --- the core reason this is a sweep and not a merge -------------------------

def test_a_gap_between_contacts_is_not_reported_as_overlap():
    """Merging overlapping windows would claim continuous activity across a gap
    where nothing actually overlapped. That is the failure this exists to avoid."""
    events = [
        _event("a", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-03-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "2027-04-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00"),
    ]
    out = intersect_windows(events, min_contacts=2)
    assert out["segments"] == []
    assert out["summary"]["max_simultaneous_contacts"] == 0


def test_touching_intervals_do_not_count_as_simultaneous():
    """Half-open windows: a contact ending exactly when another begins is a
    handover, not an overlap."""
    events = [
        _event("a", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-03-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "2027-03-01T00:00:00+00:00", "2027-05-01T00:00:00+00:00"),
    ]
    assert intersect_windows(events, min_contacts=2)["segments"] == []


def test_overlap_produces_a_segment_with_both_event_ids():
    events = [
        _event("a", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-04-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "2027-03-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00"),
    ]
    out = intersect_windows(events, min_contacts=2)
    assert len(out["segments"]) == 1
    seg = out["segments"][0]
    assert seg["start"].startswith("2027-03-01")
    assert seg["end"].startswith("2027-04-01")
    assert sorted(seg["event_ids"]) == ["a", "b"]
    assert seg["bodies"] == ["Pluto", "Uranus"]


# --- segmentation on active-set change (spec §9.3) ---------------------------

def test_timeline_splits_wherever_the_active_set_changes():
    """Three staggered contacts must yield distinct segments, not one blob:
    which bodies are involved changes across the period."""
    events = [
        _event("a", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-07-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "2027-03-01T00:00:00+00:00", "2027-09-01T00:00:00+00:00"),
        _event("c", "Neptune", "Mars", "2027-05-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00"),
    ]
    out = intersect_windows(events, min_contacts=2)
    sets = [tuple(sorted(s["event_ids"])) for s in out["segments"]]
    # a+b, then c joins, then c leaves and a+b resume. The last segment is a
    # SEPARATE record from the first even though the set matches: they are not
    # adjacent, and joining them would erase the c interval between.
    assert sets == [("a", "b"), ("a", "b", "c"), ("a", "b")]
    bounds = [(s["start"][:10], s["end"][:10]) for s in out["segments"]]
    assert bounds == [("2027-03-01", "2027-05-01"),
                      ("2027-05-01", "2027-06-01"),
                      ("2027-06-01", "2027-07-01")]
    assert out["summary"]["max_simultaneous_contacts"] == 3


def test_segments_with_different_active_sets_are_never_merged():
    events = [
        _event("a", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-12-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "2027-02-01T00:00:00+00:00", "2027-05-01T00:00:00+00:00"),
        _event("c", "Neptune", "Mars", "2027-06-01T00:00:00+00:00", "2027-09-01T00:00:00+00:00"),
    ]
    out = intersect_windows(events, min_contacts=2)
    id_sets = [tuple(sorted(s["event_ids"])) for s in out["segments"]]
    assert ("a", "b") in id_sets and ("a", "c") in id_sets
    assert len(set(id_sets)) == len(id_sets)      # no set repeated by fragmentation


# --- axis collapsing (spec §2.5) ---------------------------------------------

def test_axis_contacts_count_twice_raw_but_once_as_a_target():
    """Pluto conjunct IC and opposite MC are two real contacts describing ONE
    axis activation. Counting two targets would overstate chart involvement."""
    events = [
        _event("a", "Pluto", "IC", "2027-01-01T00:00:00+00:00",
               "2027-06-01T00:00:00+00:00", axis="MC-IC"),
        _event("b", "Pluto", "MC", "2027-01-01T00:00:00+00:00",
               "2027-06-01T00:00:00+00:00", axis="MC-IC"),
    ]
    seg = intersect_windows(events, min_contacts=2)["segments"][0]
    assert seg["contact_count"] == 2
    assert seg["unique_target_count"] == 1
    assert seg["axis_groups"] == ["MC-IC"]


# --- criteria ----------------------------------------------------------------

def test_min_bodies_distinguishes_one_busy_body_from_several():
    """Four contacts from Pluto alone is not the same finding as four contacts
    from four planets."""
    events = [
        _event(f"p{i}", "Pluto", t, "2027-01-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00")
        for i, t in enumerate(["Sun", "Moon", "Mars", "Venus"])
    ]
    assert intersect_windows(events, min_contacts=2)["segments"]          # overlaps
    assert intersect_windows(events, min_contacts=2, min_bodies=2)["segments"] == []


def test_required_bodies_answers_the_named_pair_question():
    """Spec §25 Test 4 — 'когда Уран и Плутон одновременно аспектируют карту'."""
    events = [
        _event("u", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00"),
        _event("n", "Neptune", "Moon", "2027-01-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00"),
        _event("p", "Pluto", "Mars", "2027-04-01T00:00:00+00:00", "2027-08-01T00:00:00+00:00"),
    ]
    out = intersect_windows(events, min_contacts=2, bodies=["Uranus", "Pluto"])
    assert len(out["segments"]) == 1
    seg = out["segments"][0]
    assert seg["start"].startswith("2027-04-01")
    assert seg["end"].startswith("2027-06-01")
    assert {"Uranus", "Pluto"} <= set(seg["bodies"])
    assert out["criteria"]["required_bodies"] == ["Pluto", "Uranus"]


def test_densest_segment_is_reported():
    events = [
        _event("a", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-12-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "2027-02-01T00:00:00+00:00", "2027-11-01T00:00:00+00:00"),
        _event("c", "Neptune", "Mars", "2027-03-01T00:00:00+00:00", "2027-04-01T00:00:00+00:00"),
    ]
    out = intersect_windows(events, min_contacts=2)
    assert out["summary"]["max_simultaneous_contacts"] == 3
    assert out["summary"]["densest_segment"]["start"].startswith("2027-03-01")


# --- robustness ---------------------------------------------------------------

def test_unparseable_windows_are_skipped_and_reported():
    """A bad window must never be treated as zero-length or as spanning
    everything — either would silently distort every segment."""
    events = [
        _event("a", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "not-a-date", "also-bad"),
    ]
    out = intersect_windows(events, min_contacts=1)
    assert any("unparseable_window" in w for w in out["warnings"])
    assert all("b" not in s["event_ids"] for s in out["segments"])


def test_reversed_window_is_skipped():
    events = [_event("a", "Uranus", "Sun",
                     "2027-06-01T00:00:00+00:00", "2027-01-01T00:00:00+00:00")]
    out = intersect_windows(events, min_contacts=1)
    assert out["segments"] == []
    assert out["warnings"]


def test_mixed_aware_and_naive_timestamps_do_not_crash():
    """Comparing aware and naive datetimes raises. Rather than guess a timezone
    for the naive ones, drop them and say so."""
    events = [
        _event("a", "Uranus", "Sun", "2027-01-01T00:00:00+00:00", "2027-06-01T00:00:00+00:00"),
        _event("b", "Pluto", "Moon", "2027-02-01T00:00:00", "2027-05-01T00:00:00"),
    ]
    out = intersect_windows(events, min_contacts=1)
    assert out["status"] == "ok"
    assert any("unparseable_window" in w for w in out["warnings"])


def test_dst_offset_change_inside_a_window_is_handled():
    """Engine output carries local offsets that shift across DST; comparisons
    must happen on aware datetimes, not on the strings."""
    events = [
        _event("a", "Uranus", "Sun", "2027-01-10T23:00:00+01:00", "2027-07-01T00:00:00+02:00"),
        _event("b", "Pluto", "Moon", "2027-06-01T00:00:00+02:00", "2027-09-01T00:00:00+02:00"),
    ]
    out = intersect_windows(events, min_contacts=2)
    assert len(out["segments"]) == 1
    assert not out["warnings"]


def test_empty_input_is_a_clean_result():
    out = intersect_windows([], min_contacts=2)
    assert out["status"] == "ok"
    assert out["segments"] == []
    assert out["summary"]["densest_segment"] is None


# --- the schema the model reads ----------------------------------------------

def test_tool_takes_survey_arguments_so_no_survey_id_is_needed():
    """There is no survey store yet; a survey_id parameter would be a promise
    the server cannot keep."""
    props = _tool()["parameters"]["properties"]
    assert "survey_id" not in props
    assert {"start_date", "end_date"} <= set(props)
    assert not {"user_id", "chart_id"} & set(props)


def test_description_names_the_questions_it_answers():
    desc = _tool()["description"].lower()
    assert "одновременно" in desc
    assert "survey_transits" in desc
