"""
EVAL: analysis-correctness (deterministic, runs everywhere).

Golden chart -> known count / rank / extreme / group / filter results. This is
the guardrail against Layer-2 logic bugs (the "wrong-but-plausible" failure the
extraction check can't catch). No LLM, no DB.
"""
from app.services.astro_analysis import analyze
from app.tests.eval.golden_charts import GoldenDataset


def test_count_total_is_eight():
    out = analyze(GoldenDataset(), {"op": "count", "over": "planets"})
    assert out["rows"] == [{"n": 8, "id": "r0"}]


def test_count_grouped_by_sign_leo_leads_with_two():
    out = analyze(GoldenDataset(), {"op": "count", "over": "planets", "group_by": "sign"})
    buckets = [(r["bucket"], r["n"]) for r in out["rows"]]
    assert buckets[0] == ("Leo", 2)          # Sun + Mercury
    assert ("Cancer", 1) in buckets
    assert sum(n for _, n in buckets) == 8    # totals reconcile


def test_rank_fastest_is_moon():
    out = analyze(GoldenDataset(), {"op": "rank", "over": "planets",
                                    "sort": "speed", "order": "desc", "limit": 3})
    assert [r["name"] for r in out["rows"]] == ["Moon", "Mercury", "Venus"]


def test_extreme_slowest_is_retrograde_pluto():
    out = analyze(GoldenDataset(), {"op": "extreme", "over": "planets",
                                    "sort": "speed", "order": "asc"})
    assert len(out["rows"]) == 1
    assert out["rows"][0]["name"] == "Pluto"
    assert out["rows"][0]["retrograde"] == 1


def test_filter_retrograde_returns_only_pluto():
    out = analyze(GoldenDataset(), {"op": "rank", "over": "planets",
                                    "sort": "name", "filter": {"retrograde": 1}})
    assert [r["name"] for r in out["rows"]] == ["Pluto"]


def test_filter_by_sign_leo_returns_sun_and_mercury():
    out = analyze(GoldenDataset(), {"op": "rank", "over": "planets",
                                    "sort": "name", "order": "asc",
                                    "filter": {"sign": "Leo"}})
    assert [r["name"] for r in out["rows"]] == ["Mercury", "Sun"]
