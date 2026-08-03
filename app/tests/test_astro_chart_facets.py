"""PR4 — natal structure facets + the analyze tables built on them."""
import pytest

from app.services.astro_analysis import ANALYSIS_TABLES, analyze
from app.services.astro_data_tools import CHART_DATA_FACETS, ChartDataset, get_chart_data

_NEW_FACETS = (
    "natal_aspects", "angles_and_points", "planet_roles",
    "house_details", "configurations",
)


class _FakeDataset(ChartDataset):
    """ChartDataset with the DB read stubbed out.

    Facet builders only ever touch ``_natal_chart()``; substituting it keeps
    these tests on the shaping logic instead of a live Postgres chart.
    """

    def __init__(self, chart):
        super().__init__(user_id=None, astrologer_id=None, db=None)
        self._chart = chart

    def _natal_chart(self):
        return self._chart


def _chart():
    return {
        "planets": [
            {"name": "Mars", "sign": "Leo", "house": 9, "dignity": "neutral",
             "speed": 0.64, "retrograde": False, "ruled_houses": [5, 12],
             "special_roles": ["chart_ruler"], "is_elevated": True,
             "is_peregrine": False, "sun_relation": "free", "strength_score": 16.0},
            {"name": "Saturn", "sign": "Pisces", "house": 5, "dignity": "fall",
             "speed": -0.02, "retrograde": True, "ruled_houses": [],
             "special_roles": [], "is_elevated": False, "is_peregrine": True,
             "sun_relation": None, "strength_score": 4.0},
        ],
        "houses": [
            {"number": 1, "sign": "Cancer", "degree_in_sign_formatted": "21°54'22\"",
             "ruler_planet": "Moon", "co_rulers": ["Neptune"], "ruler_in_house": 7,
             "house_group": "angular", "significator": "Mars",
             "included_sign": "Leo", "planets_in_house": ["Mars", "Saturn"]},
            {"number": 2, "sign": "Leo", "degree_in_sign_formatted": "3°10'00\"",
             "ruler_planet": "Sun", "co_rulers": [], "ruler_in_house": 4,
             "house_group": "succedent", "significator": None,
             "included_sign": None, "planets_in_house": []},
        ],
        "angles": {
            "ASC": {"name": "ASC", "sign": "Cancer", "longitude": 111.906256,
                    "degree_in_sign_formatted": "21°54'22\""},
            "MC": {"name": "MC", "sign": "Pisces", "longitude": 351.2,
                   "degree_in_sign_formatted": "21°12'00\""},
        },
        "special_points": {
            "TrueNorthNode": {"name": "TrueNorthNode", "sign": "Aries",
                              "longitude": 9.387839, "house": 10,
                              "degree_in_sign_formatted": "9°23'16\""},
        },
        "aspects": [
            {"left_planet": "Sun", "right_planet": "Saturn", "aspect_type": "Square",
             "orb": 1.42, "is_major": True, "harmonic_type": "tense",
             "is_partile": False, "applying": True},
            {"left_planet": "Moon", "right_planet": "Mars", "aspect_type": "Trine",
             "orb": 0.08, "is_major": True, "harmonic_type": "harmonious",
             "is_partile": True, "applying": False},
            {"left_planet": "Sun", "right_planet": "Mars", "aspect_type": "Sextile",
             "orb": 3.10, "is_major": True, "harmonic_type": "harmonious",
             "is_partile": False, "applying": False},
        ],
        "aspect_configurations": [
            {"type": "Bisextile", "planets_involved": ["Moon", "Neptune", "Pluto"],
             "apex_planet": "Neptune", "strength_score": 8.0},
        ],
    }


# --- criterion 6: every facet is reachable and shaped ------------------------

@pytest.mark.parametrize("facet", _NEW_FACETS)
def test_new_facet_is_registered_and_returns_ok(facet):
    assert facet in CHART_DATA_FACETS
    out = get_chart_data(_FakeDataset(_chart()), facet)
    assert out["status"] == "ok"
    assert out["facet"] == facet
    assert "dataset" in out["provenance"]


# --- criterion 7: aspects survive the trip intact ----------------------------

def test_natal_aspects_facet_preserves_every_row_sorted_by_orb():
    data = _FakeDataset(_chart()).facet("natal_aspects")
    assert len(data["aspects"]) == 3
    assert [a["orb"] for a in data["aspects"]] == [0.08, 1.42, 3.10]
    tightest = data["aspects"][0]
    assert tightest["left"] == "Moon" and tightest["right"] == "Mars"
    assert tightest["is_partile"] is True


def test_angles_and_points_split_correctly():
    data = _FakeDataset(_chart()).facet("angles_and_points")
    assert {a["name"] for a in data["angles"]} == {"ASC", "MC"}
    assert data["points"][0]["name"] == "TrueNorthNode"
    assert data["points"][0]["house"] == 10          # points have houses
    assert "house" not in data["angles"][0]          # angles define them


def test_planet_roles_emits_house_as_overridable():
    """House must ship in the computed/effective shape so a later manual
    override cannot silently replace the engine's value."""
    data = _FakeDataset(_chart()).facet("planet_roles")
    mars = next(p for p in data["planets"] if p["name"] == "Mars")
    assert mars["house"]["computed_value"] == 9
    assert mars["house"]["effective_value"] == 9
    assert mars["house"]["override_applied"] is False
    assert mars["ruled_houses"] == [5, 12]
    assert mars["special_roles"] == ["chart_ruler"]


def test_house_details_carries_rulership_fields():
    data = _FakeDataset(_chart()).facet("house_details")
    first = data["houses"][0]
    assert first["co_rulers"] == ["Neptune"]     # intercepted-sign rulers ride here
    assert first["ruler_in_house"] == 7
    assert first["significator"] == "Mars"
    assert first["included_sign"] == "Leo"


def test_configurations_drops_duplicated_aspect_detail():
    data = _FakeDataset(_chart()).facet("configurations")
    cfg = data["configurations"][0]
    assert cfg["type"] == "Bisextile"
    assert cfg["apex_planet"] == "Neptune"
    assert "aspects" not in cfg          # lives in natal_aspects, not duplicated


# --- criterion 10: empty chart degrades cleanly ------------------------------

@pytest.mark.parametrize("facet", _NEW_FACETS)
def test_facet_on_chartless_user_is_empty_not_an_error(facet):
    out = get_chart_data(_FakeDataset(None), facet)
    assert out["status"] == "ok"
    assert all(v == [] for v in out["data"].values())


# --- criteria 8-9: the new analyze tables ------------------------------------

def test_analysis_tables_registered():
    assert "natal_aspects" in ANALYSIS_TABLES
    assert "houses" in ANALYSIS_TABLES


def test_count_group_by_answers_most_aspected_body():
    """Criterion 8 — the question the astrologers actually ask."""
    out = analyze(_FakeDataset(_chart()), {
        "op": "count", "over": "natal_aspects", "group_by": "left"})
    assert out["status"] == "ok"
    buckets = {r["bucket"]: r["n"] for r in out["rows"]}
    assert buckets["Sun"] == 2
    assert buckets["Moon"] == 1


def test_rank_by_orb_answers_tightest_aspects():
    """Criterion 9."""
    out = analyze(_FakeDataset(_chart()), {
        "op": "rank", "over": "natal_aspects", "sort": "orb",
        "order": "asc", "limit": 2})
    assert [r["orb"] for r in out["rows"]] == [0.08, 1.42]
    assert out["rows"][0]["id"] == "r0"      # citation handle


def test_reserved_sql_words_survive_as_column_names():
    """`left`, `right` and `group` are SQL keywords. The compiler quotes every
    column, but a regression here would break silently at query time."""
    out = analyze(_FakeDataset(_chart()), {
        "op": "rank", "over": "natal_aspects", "sort": "right", "order": "asc"})
    assert out["status"] == "ok"
    grouped = analyze(_FakeDataset(_chart()), {
        "op": "count", "over": "houses", "group_by": "group"})
    assert grouped["status"] == "ok"
    assert {r["bucket"] for r in grouped["rows"]} == {"angular", "succedent"}


def test_houses_table_counts_occupants():
    out = analyze(_FakeDataset(_chart()), {
        "op": "extreme", "over": "houses", "sort": "planet_count", "order": "desc"})
    assert out["rows"][0]["number"] == 1
    assert out["rows"][0]["planet_count"] == 2


def test_boolean_columns_are_filterable_as_0_1():
    out = analyze(_FakeDataset(_chart()), {
        "op": "count", "over": "natal_aspects", "filter": {"is_partile": 1}})
    assert out["rows"][0]["n"] == 1


# --- criterion 11: no model string reaches SQL -------------------------------

def test_injection_in_filter_value_stays_a_bound_parameter():
    """A hostile filter VALUE must bind, not execute."""
    out = analyze(_FakeDataset(_chart()), {
        "op": "count", "over": "natal_aspects",
        "filter": {"aspect": "'; DROP TABLE t; --"}})
    assert out["status"] == "ok"
    assert out["rows"][0]["n"] == 0          # matched nothing, table intact


def test_injection_in_filter_field_is_rejected_by_allowlist():
    out = analyze(_FakeDataset(_chart()), {
        "op": "count", "over": "natal_aspects",
        "filter": {"orb\"; DROP TABLE t; --": 1}})
    assert out == {"status": "error", "error": "bad_filter_field"}


def test_injection_in_sort_and_group_by_is_rejected():
    assert analyze(_FakeDataset(_chart()), {
        "op": "rank", "over": "natal_aspects",
        "sort": "orb\"; DROP TABLE t; --"})["error"] == "bad_sort"
    assert analyze(_FakeDataset(_chart()), {
        "op": "count", "over": "houses",
        "group_by": "sign\"; DROP TABLE t; --"})["error"] == "bad_group_by"


def test_unknown_table_is_rejected():
    assert analyze(_FakeDataset(_chart()), {
        "op": "count", "over": "sqlite_master"})["error"] == "bad_table"
