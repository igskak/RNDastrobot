"""§21 — extended analyze: forecast tables plus aggregate and bucket_time."""
import pytest

from app.services.astro_analysis import ANALYSIS_OPS, ANALYSIS_TABLES, analyze
from app.services.astro_data_tools import ChartDataset


class _Dataset(ChartDataset):
    """Dataset with the DB read stubbed and forecast data attached directly."""

    def __init__(self, *, events=(), segments=(), findings=(), chart=None):
        super().__init__(user_id=None, astrologer_id=None, db=None)
        self._chart = chart
        self.forecast_events = list(events)
        self.forecast_segments = list(segments)
        self.forecast_findings = list(findings)

    def _natal_chart(self):
        return self._chart


def _event(eid, body, target, enter, leave, *, passes=(), stations=(),
           closest=0.5, house=4, aspect="Square", axis=None):
    return {
        "event_id": eid, "transit_body": body, "natal_body": target,
        "aspect_type": aspect, "target_type": "angle" if axis else "object",
        "target_natal_house": {"effective_value": house, "computed_value": house},
        "axis_group": axis, "enter": enter, "leave": leave,
        "passes": list(passes), "exact_pass_count": len(passes),
        "stations": list(stations),
        "closest_approach": {"orb": closest, "date": enter},
    }


def _events():
    return [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00",
               "2027-03-02T00:00:00+00:00",
               passes=[{"date": "2027-02-01T00:00:00+00:00", "orb": 0.0}], house=4),
        _event("b", "Uranus", "Moon", "2027-01-15T00:00:00+00:00",
               "2027-02-14T00:00:00+00:00", closest=0.4, house=7,
               stations=[{"date": "2027-02-01", "type": "R"}]),
        _event("c", "Neptune", "MC", "2027-06-01T00:00:00+00:00",
               "2027-07-01T00:00:00+00:00", closest=0.9, house=10, axis="MC-IC"),
    ]


# --- the declined operations, and why ------------------------------------------

def test_only_the_defensible_operations_exist():
    """overlap and cluster would be worse SQL versions of the sweep-line and the
    Pattern Engine; distribution is count with group_by; compare has no single
    correct semantics. Building them would give two answers to one question."""
    assert set(ANALYSIS_OPS) == {"count", "rank", "extreme", "aggregate", "bucket_time"}
    assert "overlap" not in ANALYSIS_OPS
    assert "cluster" not in ANALYSIS_OPS


def test_symbolic_events_table_is_absent_until_it_has_a_source():
    """Registering an always-empty table would invite the model to query it and
    get nothing back."""
    assert "symbolic_events" not in ANALYSIS_TABLES


# --- forecast tables -------------------------------------------------------------

def test_transit_events_flattens_nested_records():
    rows = _Dataset(events=_events()).table("transit_events")
    first = next(r for r in rows if r["event_id"] == "a")
    assert first["target_natal_house"] == 4        # unwrapped from the override block
    assert first["min_orb"] == 0.0                 # exact pass beats closest approach
    assert first["duration_days"] == 60.0
    assert first["exact_pass_count"] == 1
    second = next(r for r in rows if r["event_id"] == "b")
    assert second["min_orb"] == 0.4                # falls back to closest approach
    assert second["station_count"] == 1


def test_forecast_tables_are_empty_before_a_survey_runs():
    """Asking about transit events before surveying is a question with no data,
    not an error."""
    dataset = _Dataset()
    assert dataset.table("transit_events") == []
    out = analyze(dataset, {"op": "count", "over": "transit_events"})
    assert out["status"] == "ok"
    assert out["rows"][0]["n"] == 0


def test_time_segments_and_findings_tables():
    dataset = _Dataset(
        segments=[{"start": "2027-01-15T00:00:00+00:00", "end": "2027-03-02T00:00:00+00:00",
                   "contact_count": 2, "unique_target_count": 2, "unique_body_count": 2}],
        findings=[{"finding_id": "f_001", "type": "highest_density",
                   "evidence_ids": ["a", "b"]}])
    assert dataset.table("time_segments")[0]["contact_count"] == 2
    assert dataset.table("pattern_findings")[0]["evidence_count"] == 2


# --- aggregate --------------------------------------------------------------------

def test_aggregate_computes_over_a_numeric_column():
    dataset = _Dataset(events=_events())
    out = analyze(dataset, {"op": "aggregate", "over": "transit_events",
                            "sort": "duration_days", "aggregate": "avg"})
    assert out["status"] == "ok"
    assert out["rows"][0]["n"] == 3
    assert out["rows"][0]["value"] == pytest.approx((60.0 + 30.0 + 30.0) / 3)


def test_aggregate_groups_and_answers_busiest_house():
    dataset = _Dataset(events=_events() + [
        _event("d", "Pluto", "Venus", "2027-02-01T00:00:00+00:00",
               "2027-03-01T00:00:00+00:00", house=4)])
    out = analyze(dataset, {"op": "aggregate", "over": "transit_events",
                            "sort": "exact_pass_count", "aggregate": "sum",
                            "group_by": "target_natal_house"})
    buckets = {r["bucket"]: r["n"] for r in out["rows"]}
    assert buckets[4] == 2       # two events land in house 4


def test_aggregate_requires_a_column():
    out = analyze(_Dataset(events=_events()),
                  {"op": "aggregate", "over": "transit_events"})
    assert out["error"] == "sort_required"


def test_unknown_aggregate_function_is_rejected():
    out = analyze(_Dataset(events=_events()),
                  {"op": "aggregate", "over": "transit_events",
                   "sort": "min_orb", "aggregate": "median; DROP TABLE t"})
    assert out["error"] == "bad_aggregate"


# --- bucket_time -------------------------------------------------------------------

def test_bucket_time_groups_by_month():
    out = analyze(_Dataset(events=_events()),
                  {"op": "bucket_time", "over": "transit_events", "bucket": "month"})
    buckets = {r["bucket"]: r["n"] for r in out["rows"]}
    assert buckets == {"2027-01": 2, "2027-06": 1}


def test_bucket_time_can_target_a_named_time_column():
    out = analyze(_Dataset(events=_events()),
                  {"op": "bucket_time", "over": "transit_events",
                   "bucket": "month", "time_column": "leave"})
    buckets = {r["bucket"]: r["n"] for r in out["rows"]}
    assert buckets == {"2027-02": 1, "2027-03": 1, "2027-07": 1}


def test_bucket_time_by_year():
    out = analyze(_Dataset(events=_events()),
                  {"op": "bucket_time", "over": "transit_events", "bucket": "year"})
    assert out["rows"] == [{"bucket": "2027", "n": 3, "id": "r0"}]


def test_bucket_time_on_a_table_without_time_is_rejected():
    out = analyze(_Dataset(), {"op": "bucket_time", "over": "houses"})
    assert out["error"] == "table_has_no_time_column"


def test_bucket_time_rejects_a_non_time_column():
    out = analyze(_Dataset(events=_events()),
                  {"op": "bucket_time", "over": "transit_events",
                   "time_column": "transit_body"})
    assert out["error"] == "bad_time_column"


def test_bucket_time_rejects_an_unknown_granularity():
    out = analyze(_Dataset(events=_events()),
                  {"op": "bucket_time", "over": "transit_events",
                   "bucket": "week'; DROP TABLE t; --"})
    assert out["error"] == "bad_bucket"


# --- injection surface stays closed on the new paths --------------------------------

def test_new_ops_keep_filter_values_bound():
    out = analyze(_Dataset(events=_events()),
                  {"op": "aggregate", "over": "transit_events", "sort": "min_orb",
                   "filter": {"transit_body": "'; DROP TABLE t; --"}})
    assert out["status"] == "ok"
    assert out["rows"][0]["n"] == 0


def test_new_ops_reject_an_unallowlisted_group_by():
    out = analyze(_Dataset(events=_events()),
                  {"op": "aggregate", "over": "transit_events", "sort": "min_orb",
                   "group_by": "transit_body\"; DROP TABLE t; --"})
    assert out["error"] == "bad_group_by"


def test_rows_carry_citation_ids_on_the_new_ops():
    out = analyze(_Dataset(events=_events()),
                  {"op": "bucket_time", "over": "transit_events"})
    assert all(r["id"].startswith("r") for r in out["rows"])
