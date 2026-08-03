"""PR2 — survey_transits: the hybrid bulk transit survey."""
from datetime import date
from uuid import uuid4

import pytest

import app.services.astro_assistant_service as svc
from app.services.astro_assistant_service import (
    MAX_SURVEY_EVENTS,
    AstroAssistantService,
    _build_survey_event,
    _monthly_summary,
)
from app.services.astro_profiles import (
    DEFAULT_ASPECT_TYPES,
    NATAL_TARGET_PROFILES,
    TRANSIT_BODY_PROFILES,
    axis_group_for,
    resolve_natal_targets,
    resolve_transit_bodies,
)
from app.services.astro_tool_schemas import build_query_tools
from app.services.astro_vocab import ASPECT_TYPE_NAMES, NATAL_BODY_NAMES, TRANSIT_BODY_NAMES


def _tool():
    return next(f["function"] for f in build_query_tools()
                if f["function"]["name"] == "survey_transits")


def _contact(enter, leave, passes=(), stations=(), orb=0.1):
    return {
        "enter": enter, "enter_complete": True,
        "leave": leave, "leave_complete": True,
        "passes": list(passes), "exact_pass_count": len(passes),
        "stations": list(stations),
        "closest_approach": {"orb": orb, "date": enter},
    }


class _FakeTransits:
    """Discovery returns triples; refinement returns real contact shapes."""

    def __init__(self, discovered, refined):
        self._discovered = discovered
        self._refined = refined
        self.refine_calls = []

    def find_transit_events(self, **kw):
        self.discovery_kw = kw
        return self._discovered

    def find_aspect_passes(self, **kw):
        self.refine_calls.append(kw)
        key = (kw["transit_body"], kw["natal_body"], kw["aspect_type"])
        return self._refined.get(key, {"status": "no_contact_in_window", "contacts": []})


def _service(fake):
    s = AstroAssistantService(
        db_session=None, default_timezone="Europe/Kyiv",
        default_anchor_date=date(2026, 8, 3), astrologer_id=uuid4())
    s._transit_service = fake
    s._natal_lookup = {
        "planets": {
            "Pluto": {"name": "Pluto", "house": {"effective_value": 3},
                      "ruled_houses": [4, 11]},
            "Sun": {"name": "Sun", "house": {"effective_value": 4},
                    "ruled_houses": [2]},
        },
        "angle_houses": {"ASC": 1, "IC": 4, "DSC": 7, "MC": 10},
        "points": {"TrueNorthNode": 10},
    }
    return s


# --- profiles (criterion 17) --------------------------------------------------

def test_outer_planets_profile_includes_chiron():
    """Product decision: schools differ, this profile does not."""
    assert resolve_transit_bodies("outer_planets") == (
        "Uranus", "Neptune", "Pluto", "Chiron")


def test_broad_default_targets_match_the_approved_set():
    targets = set(resolve_natal_targets("broad_default_v1"))
    assert {"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
            "Uranus", "Neptune", "Pluto"} <= targets
    assert {"ASC", "DSC", "MC", "IC"} <= targets
    assert {"TrueNorthNode", "TrueSouthNode", "BlackMoon"} <= targets
    assert "Fortune" not in targets                       # excluded by decision
    assert "Vertex" not in targets and "AntiVertex" not in targets
    assert len(targets) == 17


def test_no_non_angle_cusps_in_default_targets():
    """Only the four angles are default aspect targets."""
    assert not any(t.startswith("Cusp") or t.startswith("House")
                   for t in resolve_natal_targets("broad_default_v1"))


def test_explicit_lists_override_profiles():
    assert resolve_transit_bodies("outer_planets", ["Mars"]) == ("Mars",)
    assert resolve_natal_targets("broad_default_v1", ["ASC"]) == ("ASC",)


def test_unknown_profile_raises_instead_of_defaulting():
    """A model typo must surface, not quietly survey the wrong bodies and hand
    back a confident answer about the wrong set."""
    with pytest.raises(ValueError, match="unknown_transit_profile:outer_planet"):
        resolve_transit_bodies("outer_planet")
    with pytest.raises(ValueError, match="unknown_target_profile"):
        resolve_natal_targets("broad_default")


def test_every_profile_member_is_a_valid_vocabulary_name():
    """A profile naming a body the engine cannot resolve would fail at runtime."""
    for bodies in TRANSIT_BODY_PROFILES.values():
        assert set(bodies) <= TRANSIT_BODY_NAMES
    for targets in NATAL_TARGET_PROFILES.values():
        assert set(targets) <= NATAL_BODY_NAMES
    assert set(DEFAULT_ASPECT_TYPES) <= ASPECT_TYPE_NAMES


# --- axis grouping (criterion 21) --------------------------------------------

def test_axis_groups_pair_the_angles():
    assert axis_group_for("ASC") == axis_group_for("DSC") == "ASC-DSC"
    assert axis_group_for("MC") == axis_group_for("IC") == "MC-IC"
    assert axis_group_for("Sun") is None


# --- event construction (criteria 19, 23) ------------------------------------

def test_retrograde_triple_pass_is_one_event_with_three_passes():
    """Criterion 19 — the discovery layer would collapse this into one
    approximate crossing; refinement must keep all three."""
    passes = [
        {"date": "2027-03-01T00:00:00+02:00", "motion": "direct", "orb": 0.0},
        {"date": "2027-07-14T00:00:00+03:00", "motion": "retrograde", "orb": 0.0},
        {"date": "2027-12-02T00:00:00+02:00", "motion": "direct", "orb": 0.0},
    ]
    event = _build_survey_event(
        chart_key="c1", transit_body="Pluto", natal_body="MC",
        aspect_type="Conjunction",
        contact=_contact("2027-01-10", "2028-02-20", passes),
        orb_used=1.0, target_house=10,
        transit_body_natal={"house": {"effective_value": 3}, "ruled_houses": [4, 11]})
    assert event["exact_pass_count"] == 3
    assert len(event["passes"]) == 3
    assert [p["motion"] for p in event["passes"]] == ["direct", "retrograde", "direct"]


def test_event_id_is_stable_across_identical_runs():
    """Criterion 23 — the citation and full-table layers key off this."""
    kw = dict(chart_key="c1", transit_body="Pluto", natal_body="MC",
              aspect_type="Conjunction", contact=_contact("2027-01-10", "2028-02-20"),
              orb_used=1.0, target_house=10, transit_body_natal=None)
    assert _build_survey_event(**kw)["event_id"] == _build_survey_event(**kw)["event_id"]


def test_event_id_differs_per_contact_not_per_position():
    a = _build_survey_event(
        chart_key="c1", transit_body="Pluto", natal_body="MC", aspect_type="Conjunction",
        contact=_contact("2027-01-10", "2027-06-01"), orb_used=1.0,
        target_house=10, transit_body_natal=None)
    b = _build_survey_event(
        chart_key="c1", transit_body="Pluto", natal_body="MC", aspect_type="Conjunction",
        contact=_contact("2028-01-10", "2028-06-01"), orb_used=1.0,
        target_house=10, transit_body_natal=None)
    assert a["event_id"] != b["event_id"]


def test_event_carries_the_full_aspect_formula_fields():
    event = _build_survey_event(
        chart_key="c1", transit_body="Pluto", natal_body="MC", aspect_type="Conjunction",
        contact=_contact("2027-01-10", "2028-02-20"), orb_used=1.0, target_house=10,
        transit_body_natal={"house": {"effective_value": 3}, "ruled_houses": [4, 11]})
    assert event["transit_body_natal_house"]["effective_value"] == 3
    assert event["transit_body_ruled_houses"] == [4, 11]
    assert event["target_natal_house"] == 10
    assert event["target_type"] == "angle"
    assert event["axis_group"] == "MC-IC"


# --- monthly distribution ----------------------------------------------------

def test_monthly_summary_counts_exact_passes_not_events():
    """An event can span many months; counting it once at its start would hide
    where the activity actually lands."""
    event = _build_survey_event(
        chart_key="c", transit_body="Pluto", natal_body="MC", aspect_type="Conjunction",
        contact=_contact("2027-01-10", "2028-02-20", [
            {"date": "2027-03-01", "motion": "direct", "orb": 0.0},
            {"date": "2027-07-14", "motion": "retrograde", "orb": 0.0},
            {"date": "2027-07-30", "motion": "direct", "orb": 0.0},
        ]), orb_used=1.0, target_house=10, transit_body_natal=None)
    assert _monthly_summary([event]) == [
        {"month": "2027-03", "exact_passes": 1},
        {"month": "2027-07", "exact_passes": 2},
    ]


def test_monthly_summary_keeps_contacts_that_never_perfect():
    """An in-orb period with no exact hit must not vanish from the distribution."""
    event = _build_survey_event(
        chart_key="c", transit_body="Neptune", natal_body="Sun", aspect_type="Trine",
        contact=_contact("2027-05-01", "2027-09-01", passes=(), orb=0.48),
        orb_used=1.0, target_house=4, transit_body_natal=None)
    assert _monthly_summary([event]) == [{"month": "2027-05", "exact_passes": 1}]


# --- the hybrid end to end ---------------------------------------------------

def _survey_service():
    discovered = [
        {"transit_body": "Pluto", "natal_body": "MC", "aspect_type": "Conjunction"},
        {"transit_body": "Pluto", "natal_body": "IC", "aspect_type": "Opposition"},
        # duplicate rows for one triple must collapse into a single refinement
        {"transit_body": "Pluto", "natal_body": "MC", "aspect_type": "Conjunction"},
    ]
    refined = {
        ("Pluto", "MC", "Conjunction"): {
            "status": "ok", "orb_used": 1.0,
            "contacts": [_contact("2027-01-10", "2028-02-20", [
                {"date": "2027-06-01", "motion": "direct", "orb": 0.0}])],
        },
        ("Pluto", "IC", "Opposition"): {
            "status": "ok", "orb_used": 1.0,
            "contacts": [_contact("2027-01-10", "2028-02-20", [
                {"date": "2027-06-01", "motion": "direct", "orb": 0.0}])],
        },
    }
    fake = _FakeTransits(discovered, refined)
    return _service(fake), fake


def test_survey_refines_each_discovered_triple_exactly_once():
    """Criterion 18 — one bulk call, and discovery duplicates must not cause
    duplicate refinement work."""
    service, fake = _survey_service()
    out = service._exec_survey_transits(uuid4(), {
        "start_date": "2026-08-03", "end_date": "2028-08-03"})
    assert out["status"] == "ok"
    assert len(fake.refine_calls) == 2
    assert all(c["start_date"] == date(2026, 8, 3) for c in fake.refine_calls)


def test_axis_contacts_are_two_events_sharing_one_group():
    """Criterion 21 — Pluto conjunct IC and opposite MC are separate records
    that describe one axis activation."""
    service, _ = _survey_service()
    out = service._exec_survey_transits(uuid4(), {
        "start_date": "2026-08-03", "end_date": "2028-08-03"})
    assert len(out["events"]) == 2
    assert {e["axis_group"] for e in out["events"]} == {"MC-IC"}
    assert len({e["event_id"] for e in out["events"]}) == 2


def test_survey_defaults_to_the_approved_profiles():
    """Criterion 16/17 — no profile named means outer planets vs broad_default_v1."""
    service, fake = _survey_service()
    out = service._exec_survey_transits(uuid4(), {
        "start_date": "2026-08-03", "end_date": "2028-08-03"})
    assert out["profile"]["transit"] == "outer_planets"
    assert out["profile"]["target"] == "broad_default_v1"
    assert fake.discovery_kw["transit_bodies"] == ["Uranus", "Neptune", "Pluto", "Chiron"]
    assert "Fortune" not in fake.discovery_kw["natal_bodies"]
    assert fake.discovery_kw["aspect_types"] == list(DEFAULT_ASPECT_TYPES)


def test_no_grid_derived_exact_time_escapes(monkeypatch):
    """Criterion 20 — the discovery layer's t_exact is a sampled minimum, not a
    root. It must never reach the model."""
    service, _ = _survey_service()
    out = service._exec_survey_transits(uuid4(), {
        "start_date": "2026-08-03", "end_date": "2028-08-03"})
    blob = repr(out)
    assert "t_exact" not in blob and "t_enter" not in blob and "t_leave" not in blob


def test_survey_is_deterministic_across_runs():
    """Criterion 23 at survey level."""
    s1, _ = _survey_service()
    s2, _ = _survey_service()
    uid = uuid4()
    a = s1._exec_survey_transits(uid, {"start_date": "2026-08-03", "end_date": "2028-08-03"})
    b = s2._exec_survey_transits(uid, {"start_date": "2026-08-03", "end_date": "2028-08-03"})
    assert a["survey_id"] == b["survey_id"]
    assert [e["event_id"] for e in a["events"]] == [e["event_id"] for e in b["events"]]


def test_truncation_is_announced_not_silent():
    """Criterion 24 — a shortened survey that reads as complete is worse than
    a short one that says so."""
    many = [{"transit_body": "Pluto", "natal_body": "MC", "aspect_type": "Conjunction"}]
    contacts = [_contact(f"20{27 + i // 12:02d}-{i % 12 + 1:02d}-01",
                         f"20{27 + i // 12:02d}-{i % 12 + 1:02d}-20")
                for i in range(MAX_SURVEY_EVENTS + 25)]
    fake = _FakeTransits(many, {
        ("Pluto", "MC", "Conjunction"): {"status": "ok", "orb_used": 1.0,
                                         "contacts": contacts}})
    out = _service(fake)._exec_survey_transits(uuid4(), {
        "start_date": "2026-01-01", "end_date": "2032-01-01"})
    assert out["truncated"] is True
    assert len(out["events"]) == MAX_SURVEY_EVENTS
    assert any("truncated" in w for w in out["warnings"])


def test_empty_survey_is_a_clean_result_not_an_error():
    fake = _FakeTransits([], {})
    out = _service(fake)._exec_survey_transits(uuid4(), {
        "start_date": "2026-08-03", "end_date": "2028-08-03"})
    assert out["status"] == "ok"
    assert out["events"] == []
    assert out["summary"]["event_count"] == 0
    assert out["truncated"] is False


def test_provenance_and_calc_version_are_present():
    """Criterion 22 — every survey must be reconcilable to a methodology."""
    service, _ = _survey_service()
    service._methodology = {"methodology_hash": "abc", "resolved_settings": {}}
    out = svc.attach_provenance(
        service._exec_survey_transits(uuid4(), {
            "start_date": "2026-08-03", "end_date": "2028-08-03"}),
        service._methodology)
    assert out["calc_version"] == "survey_transits_v1"
    assert out["provenance"]["methodology_hash"] == "abc"


# --- argument validation ------------------------------------------------------

def test_reversed_window_is_rejected():
    service, _ = _survey_service()
    with pytest.raises(ValueError, match="bad_window"):
        service._exec_survey_transits(uuid4(), {
            "start_date": "2028-01-01", "end_date": "2026-01-01"})


def test_unknown_body_names_are_rejected():
    service, _ = _survey_service()
    with pytest.raises(ValueError, match="bad_transit_body"):
        service._exec_survey_transits(uuid4(), {
            "start_date": "2026-01-01", "end_date": "2027-01-01",
            "transit_bodies": ["Nibiru"]})
    with pytest.raises(ValueError, match="bad_natal_body"):
        service._exec_survey_transits(uuid4(), {
            "start_date": "2026-01-01", "end_date": "2027-01-01",
            "natal_targets": ["'; DROP TABLE t; --"]})


# --- the schema the model reads ----------------------------------------------

def test_tool_never_accepts_a_chart_identifier():
    props = _tool()["parameters"]["properties"]
    assert not {"user_id", "chart_id", "astrologer_id"} & set(props)


def test_description_steers_broad_requests_here_and_forbids_emulation():
    """The engine already had a bulk path; nothing told the model to use it, so
    it kept firing one-pair calls. The description has to say both things."""
    desc = _tool()["description"].lower()
    assert "find_aspect_passes" in desc          # names the tool not to loop
    assert "do not emulate" in desc
    assert "на год" in desc                       # the exact phrase that failed
