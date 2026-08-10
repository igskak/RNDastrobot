"""PR7b — declarative visualization specs (§9.8, §17)."""
from app.services.assistant_visualization import (
    CHART_TYPES,
    GROUPABLE_FIELDS,
    MIN_ROWS_FOR_CHART,
    build_visualization,
    validate_spec,
)
from app.services.astro_tool_schemas import build_query_tools


def _event(eid, body, target, enter, leave, *, passes=(), house=4,
           aspect="Square", axis=None, closest=0.5):
    return {
        "event_id": eid, "transit_body": body, "natal_body": target,
        "aspect_type": aspect, "target_type": "angle" if axis else "object",
        "target_natal_house": {"effective_value": house}, "axis_group": axis,
        "enter": enter, "leave": leave, "passes": list(passes),
        "exact_pass_count": len(passes),
        "closest_approach": {"orb": closest, "date": enter},
    }


def _events(n=5):
    bodies = ["Pluto", "Uranus", "Neptune", "Chiron", "Pluto"]
    targets = ["Sun", "Moon", "MC", "Venus", "Mars"]
    return [
        _event(f"e{i}", bodies[i % 5], targets[i % 5],
               f"2027-{i + 1:02d}-01T00:00:00+00:00",
               f"2027-{i + 2:02d}-01T00:00:00+00:00",
               passes=[{"date": f"2027-{i + 1:02d}-15T00:00:00+00:00", "orb": 0.1 * i}],
               axis="MC-IC" if targets[i % 5] == "MC" else None)
        for i in range(n)
    ]


def _tool():
    return next(f["function"] for f in build_query_tools()
                if f["function"]["name"] == "create_astro_visualization")


# --- the spec is data, never code ---------------------------------------------

def test_tool_takes_a_type_and_a_field_never_code():
    props = _tool()["parameters"]["properties"]
    assert set(props["type"]["enum"]) == set(CHART_TYPES)
    assert set(props["group_by"]["enum"]) == set(GROUPABLE_FIELDS)
    # No free-form expression, script, template or field-path parameter exists.
    assert not {"code", "script", "expression", "template", "js"} & set(props)


def test_unknown_chart_type_is_rejected():
    assert validate_spec({"type": "pie_of_destiny"}, row_count=10) == "bad_chart_type"


def test_unknown_group_by_is_rejected_not_ignored():
    """A typo must surface rather than silently producing a different chart."""
    assert validate_spec(
        {"type": "bar", "group_by": "secret_field"}, row_count=10) == "bad_group_by"


def test_bar_without_a_grouping_field_is_rejected():
    assert validate_spec({"type": "bar"}, row_count=10) == "group_by_required"


def test_labels_are_stripped_of_markup():
    """Labels reach the DOM; the client builds text nodes, so this is defence in
    depth rather than the only guard."""
    events = _events(4)
    events[0]["transit_body"] = '<img src=x onerror="alert(1)">'
    chart = build_visualization({"type": "aspect_timeline"}, events)["chart"]
    joined = repr(chart["series"])
    assert "<" not in joined and ">" not in joined and '"' not in joined


# --- §10.2: a chart is sometimes the wrong answer ------------------------------

def test_too_few_rows_is_a_judgement_not_a_failure():
    """Below four rows a sentence carries it better; the caller reports this and
    writes prose instead."""
    out = build_visualization({"type": "orb_line"}, _events(MIN_ROWS_FOR_CHART - 1))
    assert out["error"] == "too_few_rows_for_a_chart"


def test_enough_rows_draws():
    out = build_visualization({"type": "orb_line"}, _events(MIN_ROWS_FOR_CHART))
    assert out["status"] == "ok"


def test_tool_description_carries_the_conditional_policy():
    desc = _tool()["description"].lower()
    assert "fewer than four" in desc
    assert "do not duplicate a small table" in desc
    assert "never encode favourable or unfavourable meaning" in desc
    assert "you do not write" in desc


# --- series are built server-side from the same data the answer uses -----------

def test_timeline_carries_windows_and_exact_passes():
    chart = build_visualization({"type": "aspect_timeline"}, _events())["chart"]
    assert chart["shape"] == "intervals"
    first = chart["series"][0]
    assert first["start"] and first["end"]
    assert first["exact"]                       # exact passes marked, per §9.8


def test_heatmap_counts_passes_and_keeps_contacts_that_never_perfect():
    """Counting only passes would drop an in-orb period that never perfects;
    counting only windows would smear a long contact across every month."""
    events = _events(4)
    events[0]["passes"] = []                    # never perfects
    chart = build_visualization({"type": "monthly_heatmap"}, events)["chart"]
    total = sum(b["value"] for b in chart["series"])
    assert total == 4                           # the non-perfecting one still counted


def test_orb_line_is_ordered_in_time():
    chart = build_visualization({"type": "orb_line"}, _events())["chart"]
    xs = [p["x"] for p in chart["series"]]
    assert xs == sorted(xs)


def test_bar_groups_and_unwraps_the_override_block():
    chart = build_visualization(
        {"type": "bar", "group_by": "target_natal_house"}, _events())["chart"]
    assert chart["series"][0]["bucket"] == "4"   # unwrapped from effective_value


def test_bar_ranks_by_count():
    chart = build_visualization(
        {"type": "bar", "group_by": "transit_body"}, _events())["chart"]
    values = [b["value"] for b in chart["series"]]
    assert values == sorted(values, reverse=True)
    assert chart["series"][0]["bucket"] == "Pluto"     # appears twice


def test_network_collapses_an_axis_into_one_node():
    chart = build_visualization({"type": "network"}, _events())["chart"]
    labels = {n["label"] for n in chart["series"]["nodes"]}
    assert "MC-IC" in labels
    assert "MC" not in labels


def test_network_weights_repeated_contacts():
    events = _events(4) + [_event("dup", "Pluto", "Sun",
                                  "2027-09-01T00:00:00+00:00",
                                  "2027-10-01T00:00:00+00:00")]
    chart = build_visualization({"type": "network"}, events)["chart"]
    edge = next(e for e in chart["series"]["edges"]
                if e["source"] == "t:Pluto" and e["target"] == "n:Sun")
    assert edge["weight"] == 2


# --- §17 alt text ---------------------------------------------------------------

def test_every_chart_carries_alt_text_describing_what_was_plotted():
    for kind in CHART_TYPES:
        spec = {"type": kind}
        if kind == "bar":
            spec["group_by"] = "transit_body"
        chart = build_visualization(spec, _events())["chart"]
        assert chart["alt"]
        assert len(chart["alt"]) > 20


def test_alt_text_reports_the_real_count():
    chart = build_visualization({"type": "monthly_heatmap"}, _events())["chart"]
    months = len(chart["series"])
    assert str(months) in chart["alt"]


# --- degenerate data ---------------------------------------------------------------

def test_unplottable_data_is_an_error_not_an_empty_chart():
    """An empty chart looks like a finding of 'nothing'; an error says the chart
    could not be drawn."""
    events = [_event(f"e{i}", "Pluto", "Sun", None, None) for i in range(5)]
    out = build_visualization({"type": "aspect_timeline"}, events)
    assert out["error"] == "no_plottable_data"
