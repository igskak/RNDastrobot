"""PR7a — the full analysis table over a persisted survey (§9.9)."""
import pytest

from app.services.assistant_table_service import (
    MAX_PAGE_SIZE,
    TABLE_COLUMNS,
    build_table,
    describe_table,
    event_to_row,
    to_csv,
    validate_query,
)
from app.services.astro_tool_schemas import build_query_tools


def _event(eid, body, target, enter, leave, *, passes=(), stations=(),
           closest=0.5, house=4, aspect="Square", axis=None):
    return {
        "event_id": eid, "transit_body": body, "natal_body": target,
        "aspect_type": aspect,
        "target_natal_house": {"effective_value": house, "computed_value": house},
        "axis_group": axis, "enter": enter, "leave": leave,
        "passes": list(passes), "exact_pass_count": len(passes),
        "stations": list(stations),
        "closest_approach": {"orb": closest, "date": enter},
    }


def _events():
    return [
        _event("a", "Pluto", "Sun", "2027-03-01T00:00:00+00:00",
               "2027-05-01T00:00:00+00:00",
               passes=[{"date": "2027-04-01T00:00:00+00:00", "orb": 0.0}], house=4),
        _event("b", "Uranus", "Moon", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", closest=0.4, house=7,
               stations=[{"date": "2027-01-15", "type": "R"}]),
        _event("c", "Neptune", "MC", "2027-06-01T00:00:00+00:00",
               "2027-07-01T00:00:00+00:00", closest=0.9, house=10, axis="MC-IC"),
    ]


def _tool():
    return next(f["function"] for f in build_query_tools()
                if f["function"]["name"] == "open_full_analysis_table")


# --- row shaping -----------------------------------------------------------------

def test_row_flattens_the_nested_record():
    row = event_to_row(_events()[0])
    assert row["target_natal_house"] == 4          # unwrapped from the override block
    assert row["min_orb"] == 0.0                   # exact pass beats closest approach
    assert row["duration_days"] == 61.0
    assert row["exact_dates"] == "2027-04-01"


def test_multiple_exact_passes_collapse_into_one_cell():
    """A cell cannot hold a nested structure, and the retrograde triple pass is
    exactly what an astrologer scans this column for."""
    event = _event("x", "Pluto", "MC", "2027-01-01T00:00:00+00:00",
                   "2028-01-01T00:00:00+00:00", passes=[
                       {"date": "2027-03-01T00:00:00+00:00", "orb": 0.0},
                       {"date": "2027-07-01T00:00:00+00:00", "orb": 0.0},
                       {"date": "2027-11-01T00:00:00+00:00", "orb": 0.0}])
    row = event_to_row(event)
    assert row["exact_dates"] == "2027-03-01, 2027-07-01, 2027-11-01"
    assert row["exact_pass_count"] == 3


def test_contact_without_an_exact_pass_falls_back_to_closest_approach():
    row = event_to_row(_events()[1])
    assert row["exact_dates"] is None
    assert row["min_orb"] == 0.4


# --- sorting ---------------------------------------------------------------------

def test_default_sort_is_chronological():
    table = build_table(_events())
    assert [r["event_id"] for r in table["rows"]] == ["b", "a", "c"]


def test_sorting_by_a_numeric_column_both_ways():
    asc = build_table(_events(), sort="min_orb", order="asc")["rows"]
    desc = build_table(_events(), sort="min_orb", order="desc")["rows"]
    assert [r["event_id"] for r in asc] == ["a", "b", "c"]
    assert [r["event_id"] for r in desc] == ["c", "b", "a"]


def test_empty_cells_sort_last_in_either_direction():
    """An empty cell is not 'the smallest value', and a None must not crash the
    comparison."""
    events = _events() + [_event("d", "Chiron", "Venus", "2027-08-01T00:00:00+00:00",
                                 "2027-09-01T00:00:00+00:00", closest=None)]
    for order in ("asc", "desc"):
        rows = build_table(events, sort="min_orb", order=order)["rows"]
        assert rows[-1]["event_id"] == "d"


# --- filtering -------------------------------------------------------------------

def test_text_filter_is_a_case_insensitive_substring():
    """Filtering 'plu' means Pluto."""
    table = build_table(_events(), filters={"transit_body": "plu"})
    assert [r["event_id"] for r in table["rows"]] == ["a"]
    assert table["total_rows"] == 1
    assert table["unfiltered_rows"] == 3


def test_numeric_filter_is_exact():
    """House 4 must not also match 14."""
    events = _events() + [_event("d", "Pluto", "Venus", "2027-08-01T00:00:00+00:00",
                                 "2027-09-01T00:00:00+00:00", house=14)]
    table = build_table(events, filters={"target_natal_house": 4})
    assert [r["event_id"] for r in table["rows"]] == ["a"]


def test_filter_matching_nothing_is_an_empty_page_not_an_error():
    table = build_table(_events(), filters={"transit_body": "Nibiru"})
    assert table["rows"] == []
    assert table["total_rows"] == 0
    assert table["page_count"] == 1


# --- paging ----------------------------------------------------------------------

def test_paging_reports_totals_needed_to_navigate():
    table = build_table(_events(), page=1, page_size=2)
    assert len(table["rows"]) == 2
    assert table["page_count"] == 2
    assert table["total_rows"] == 3


def test_page_beyond_the_end_clamps_to_the_last_page():
    table = build_table(_events(), page=99, page_size=2)
    assert table["page"] == 2
    assert len(table["rows"]) == 1


def test_page_size_is_capped():
    table = build_table(_events(), page_size=100000)
    assert table["page_size"] <= MAX_PAGE_SIZE


# --- validation is the allowlist --------------------------------------------------

def test_unknown_sort_column_is_rejected():
    assert validate_query(sort="'; DROP TABLE t; --", filters=None,
                          page_size=None) == "bad_sort_column"


def test_unknown_filter_column_is_rejected():
    assert validate_query(sort=None, filters={"secret_field": 1},
                          page_size=None) == "bad_filter_column"


def test_out_of_range_page_size_is_rejected():
    assert validate_query(sort=None, filters=None, page_size=0) == "bad_page_size"
    assert validate_query(sort=None, filters=None,
                          page_size=MAX_PAGE_SIZE + 1) == "bad_page_size"


def test_a_valid_query_passes():
    assert validate_query(sort="min_orb", filters={"transit_body": "Pluto"},
                          page_size=25) == ""


# --- CSV ---------------------------------------------------------------------------

def test_csv_exports_the_whole_filtered_set_not_one_page():
    """An export that paged would be useless."""
    csv_text = to_csv(_events())
    lines = [line for line in csv_text.strip().splitlines() if line]
    assert len(lines) == 4                     # header + 3 rows
    assert lines[0].startswith("event_id,")
    assert "Pluto" in csv_text and "Uranus" in csv_text


def test_csv_respects_filters_and_sort():
    csv_text = to_csv(_events(), filters={"transit_body": "Neptune"})
    lines = [line for line in csv_text.strip().splitlines() if line]
    assert len(lines) == 2
    assert "Neptune" in lines[1]


# --- the model-facing descriptor ------------------------------------------------------

def test_descriptor_carries_no_rows():
    """A 400-event survey would swamp the completion budget, and the model does
    not need the rows to say a table exists."""
    descriptor = describe_table(_events(), "ts_abc")
    assert "rows" not in descriptor
    assert descriptor["row_count"] == 3
    assert descriptor["survey_id"] == "ts_abc"
    assert descriptor["table_available"] is True
    assert descriptor["csv_available"] is True
    assert {c["key"] for c in descriptor["columns"]} == set(TABLE_COLUMNS)


def test_tool_tells_the_model_not_to_retype_the_table():
    desc = _tool()["description"].lower()
    assert "descriptor, not the rows" in desc
    assert "do not attempt to reproduce it in text" in desc


def test_tool_takes_no_chart_identifier():
    props = _tool()["parameters"]["properties"]
    assert not {"user_id", "chart_id", "astrologer_id"} & set(props)
    assert "survey_id" in props


# --- the engine defect this slice surfaced --------------------------------------

def test_transit_service_dedupes_duplicate_roots():
    """Every aspect but conjunction and opposition is scanned on BOTH sides
    (+angle and -angle), so one crossing can register on both branches. Observed
    in production: Pluto square Sun reported exact_pass_count=2 for a single
    crossing, both stamped 2027-01-03T07:49:44+01:00.

    The count feeds the ranking profile, the monthly distribution, the survey
    statistics and this table, so a duplicate inflates all of them.
    """
    from app.services.transit_service import TransitService

    contact = {
        "jd_enter": 2461000.0, "enter_complete": True,
        "jd_leave": 2461100.0, "leave_complete": True,
        "min_orb": 0.0, "min_orb_jd": 2461050.0,
        "passes": [
            {"jd": 2461050.0, "motion": "direct", "orb": 0.0},
            {"jd": 2461050.0, "motion": "direct", "orb": 0.0},   # same root, other branch
            {"jd": 2461080.0, "motion": "retrograde", "orb": 0.0},
        ],
        "stations": [],
    }
    formatted = TransitService._format_aspect_contact(
        TransitService.__new__(TransitService), contact, "UTC")
    assert formatted["exact_pass_count"] == 2
    assert len({p["date"] for p in formatted["passes"]}) == 2


def test_dedupe_keeps_genuinely_separate_passes():
    """A retrograde loop perfecting three times must survive intact — the guard
    must not collapse real repeats."""
    from app.services.transit_service import TransitService

    items = [
        {"jd": 2461000.0}, {"jd": 2461040.0}, {"jd": 2461090.0},
    ]
    assert len(TransitService._dedupe_jd_items(items)) == 3
