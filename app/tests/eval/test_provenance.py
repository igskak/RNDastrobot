"""
EVAL: provenance (deterministic, runs everywhere).

Every Layer-2 result carries a provenance hash for the frozen dataset it was
computed over, and a cited value reconciles to that same dataset — so a shown
number is always traceable to one snapshot. No LLM, no DB.
"""
from app.services.astro_analysis import analyze
from app.services.astro_citation import build_citation_index, render_citations
from app.tests.eval.golden_charts import GoldenDataset


def test_analyze_result_carries_provenance_and_row_ids():
    out = analyze(GoldenDataset(), {"op": "rank", "over": "planets",
                                    "sort": "speed", "order": "desc", "limit": 3})
    assert out["provenance"]["dataset"]                 # non-empty hash
    assert all("id" in r for r in out["rows"])          # every row is citable


def test_provenance_hash_is_stable_for_same_data():
    a = analyze(GoldenDataset(), {"op": "count", "over": "planets"})
    b = analyze(GoldenDataset(), {"op": "count", "over": "planets"})
    assert a["provenance"]["dataset"] == b["provenance"]["dataset"]


def test_cited_value_reconciles_to_the_dataset():
    out = analyze(GoldenDataset(), {"op": "rank", "over": "planets",
                                    "sort": "speed", "order": "desc", "limit": 1})
    idx = build_citation_index([{"result": out}])
    text, unresolved = render_citations("{{r0.name}} at {{r0.speed}} deg/day", idx)
    assert unresolved == []
    # rendered values equal the engine-computed dataset values (Moon = fastest)
    assert text == "Moon at 13.2 deg/day"
