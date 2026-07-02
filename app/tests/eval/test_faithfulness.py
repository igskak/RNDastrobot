"""
EVAL: faithfulness (deterministic, runs everywhere).

The structural property T4 buys: every CITED number renders to a value that came
from the dataset — never a fabricated one. We assert it end-to-end over the golden
chart: cite every field of every analyze row, render, and confirm each rendered
value is an engine value; and confirm a reference the dataset never produced is
refused (unresolved), not silently rendered.
"""
from app.services.astro_analysis import analyze
from app.services.astro_citation import build_citation_index, render_citations
from app.tests.eval.golden_charts import GoldenDataset


def _analyze_rows():
    out = analyze(GoldenDataset(), {"op": "rank", "over": "planets",
                                    "sort": "speed", "order": "desc", "limit": 5})
    return out["rows"], [{"result": out}]


def test_every_cited_value_comes_from_the_dataset():
    rows, tool_results = _analyze_rows()
    idx = build_citation_index(tool_results)
    dataset_values = {
        str(v) for r in rows for k, v in r.items() if k != "id"
    } | {"yes", "no", "n/a"}  # boolean/None renderings

    for key in idx:  # cite each field individually and render it
        text, unresolved = render_citations("{{" + key + "}}", idx)
        assert unresolved == [], f"cited key did not resolve: {key}"
        assert text in dataset_values, f"rendered value {text!r} is not a dataset value"


def test_fabricated_reference_is_never_rendered():
    _, tool_results = _analyze_rows()
    idx = build_citation_index(tool_results)
    text, unresolved = render_citations("The speed is {{r99.speed}}.", idx)
    assert unresolved == ["r99.speed"]      # caught, not silently filled
    assert "{{r99.speed}}" in text          # left raw -> caller refuses


def test_mixed_reply_only_substitutes_real_rows():
    rows, tool_results = _analyze_rows()
    idx = build_citation_index(tool_results)
    text, unresolved = render_citations(
        "Fastest {{r0.name}} ({{r0.speed}}), slowest {{r4.name}}.", idx)
    assert unresolved == []
    assert text == f"Fastest {rows[0]['name']} ({rows[0]['speed']}), slowest {rows[4]['name']}."
