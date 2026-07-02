"""
Tests for the Layer-2 analyze() executor (spec -> in-memory SQLite).

A lightweight fake dataset supplies planet rows so these isolate the analysis
compiler from the assembler. Covers correctness per op, filter/group, empty,
malformed-spec error codes, injection rejection, and citation ids.
"""
from app.services.astro_analysis import analyze, validate_spec


_PLANETS = [
    {"name": "Sun", "sign": "Leo", "house": 5, "dignity": "domicile", "speed": 0.98, "retrograde": 0},
    {"name": "Moon", "sign": "Cancer", "house": 4, "dignity": "domicile", "speed": 13.2, "retrograde": 0},
    {"name": "Mars", "sign": "Cancer", "house": 4, "dignity": "fall", "speed": -0.12, "retrograde": 1},
]


class _FakeDataset:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        return list(self._rows) if name == "planets" else []

    def provenance_hash(self):
        return "hashDEADBEEF"


def _ds(rows=_PLANETS):
    return _FakeDataset(rows)


# ── op correctness ────────────────────────────────────────────────────────────
def test_count_total():
    out = analyze(_ds(), {"op": "count", "over": "planets"})
    assert out["status"] == "ok"
    assert out["rows"] == [{"n": 3, "id": "r0"}]
    assert out["provenance"]["dataset"] == "hashDEADBEEF"


def test_count_grouped_by_sign_ordered_desc():
    out = analyze(_ds(), {"op": "count", "over": "planets", "group_by": "sign"})
    buckets = [(r["bucket"], r["n"]) for r in out["rows"]]
    assert buckets[0] == ("Cancer", 2)  # most populous first
    assert ("Leo", 1) in buckets


def test_rank_by_speed_desc_with_limit_and_ids():
    out = analyze(_ds(), {"op": "rank", "over": "planets", "sort": "speed",
                          "order": "desc", "limit": 2})
    names = [r["name"] for r in out["rows"]]
    assert names == ["Moon", "Sun"]  # fastest two
    assert [r["id"] for r in out["rows"]] == ["r0", "r1"]  # stable citation handles


def test_extreme_is_single_row():
    out = analyze(_ds(), {"op": "extreme", "over": "planets", "sort": "speed", "order": "asc"})
    assert len(out["rows"]) == 1
    assert out["rows"][0]["name"] == "Mars"  # slowest (most negative)


def test_filter_binds_value():
    out = analyze(_ds(), {"op": "rank", "over": "planets", "sort": "name",
                          "filter": {"retrograde": 1}})
    assert [r["name"] for r in out["rows"]] == ["Mars"]  # only retrograde planet


# ── empty ─────────────────────────────────────────────────────────────────────
def test_empty_dataset_is_clean_ok():
    out = analyze(_ds([]), {"op": "rank", "over": "planets", "sort": "speed"})
    assert out["status"] == "ok"
    assert out["rows"] == []  # never a fabricated number


# ── malformed spec -> machine error codes (never throws) ──────────────────────
def test_bad_op():
    assert analyze(_ds(), {"op": "delete", "over": "planets"}) == {"status": "error", "error": "bad_op"}


def test_bad_table():
    assert analyze(_ds(), {"op": "count", "over": "secrets"})["error"] == "bad_table"


def test_rank_requires_sort():
    assert analyze(_ds(), {"op": "rank", "over": "planets"})["error"] == "sort_required"


def test_bad_limit_rejected():
    assert analyze(_ds(), {"op": "rank", "over": "planets", "sort": "speed",
                           "limit": 9999})["error"] == "bad_limit"


# ── injection: model-controlled fields can't reach SQL as raw strings ─────────
def test_injection_via_sort_field_is_rejected():
    bad = {"op": "rank", "over": "planets", "sort": "name; DROP TABLE t"}
    assert validate_spec(bad) == "bad_sort"
    assert analyze(_ds(), bad)["error"] == "bad_sort"


def test_injection_via_filter_field_is_rejected():
    bad = {"op": "count", "over": "planets", "filter": {"name) OR 1=1 --": "x"}}
    assert analyze(_ds(), bad)["error"] == "bad_filter_field"


def test_injection_via_group_by_is_rejected():
    bad = {"op": "count", "over": "planets", "group_by": "sign); DROP TABLE t --"}
    assert analyze(_ds(), bad)["error"] == "bad_group_by"
