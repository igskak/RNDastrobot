"""§13 master prompt — analytical narrative, conditional shape, evidence-bound detail."""
import app.services.astro_assistant_service as svc
from app.services.astro_narrative import _SYSTEM as NARRATOR_PROMPT
from app.services.astro_patterns import discover
from app.services.astro_provenance import build_methodology_provenance


P = svc._SYSTEM_PROMPT


def _event(eid, body, target, enter, leave, passes=()):
    return {
        "event_id": eid, "transit_body": body, "natal_body": target,
        "aspect_type": "Square", "axis_group": None, "target_natal_house": 4,
        "transit_body_natal_house": {"effective_value": 3}, "transit_body_ruled_houses": [5],
        "enter": enter, "leave": leave, "passes": list(passes),
        "exact_pass_count": len(passes), "stations": [],
        "closest_approach": {"orb": 0.2, "date": enter},
    }


# --- the sections the spec requires -------------------------------------------

def test_master_prompt_carries_every_required_section():
    for section in ("TOOL RULES", "METHODOLOGY", "FULL ASPECT FORMULA",
                    "ANALYTICAL BEHAVIOR", "RANKING", "ANSWER SHAPE",
                    "ANTI-HALLUCINATION", "OUTPUT"):
        assert section in P, f"missing {section}"


def test_the_calculator_dump_format_is_gone():
    """The old rules were written for a UI hover tooltip and forbade the very
    overview the analytical report needs."""
    assert "timeline hover format" not in P
    assert "no greeting, preamble, or conclusion" not in P


def test_narrative_order_is_specified():
    for step in ("Scope:", "Overview", "Main objective patterns",
                 "Time clusters", "Structural observations", "Relevant counts",
                 "Detailed supporting records", "Technical notes"):
        assert step in P


def test_prompt_shows_the_dry_versus_analytical_contrast():
    """Rules alone did not move the register; a worked contrast does."""
    assert "Poor (a calculator dump)" in P
    assert "Good (an analyst)" in P
    assert "Uranus square Venus. Pluto opposite MC" in P     # the bad example


def test_allowed_analytical_language_is_listed():
    for phrase in ("the highest concentration occurs",
                   "three independent windows overlap",
                   "the period is structured into"):
        assert phrase in P
    # And the reason it is allowed, so caution does not win by default.
    assert "it is measurement, and refusing to say it is a failure" in P


def test_full_aspect_formula_is_instructed():
    """PR2 shipped transit house and ruled houses in every event and never told
    the model to use them."""
    assert "transiting natal house" in P
    assert "rules house(s)" in P


def test_conditional_shape_keeps_simple_lookups_short():
    assert "A simple lookup" in P
    assert "No overview, no structure section, no ceremony" in P


def test_tool_rules_forbid_emulating_a_survey():
    assert "survey_transits" in P
    assert "NEVER emulate a survey with repeated one-pair calls" in P
    assert "discover_patterns" in P


def test_ranking_forbids_a_synthetic_score():
    assert "Never invent an overall importance score" in P


def test_detail_is_bound_to_records_that_exist():
    """The live run's failure: told to produce contact detail it had not been
    given, the model invented eight fully-formed enter/exact/leave records."""
    assert "ONLY for" in P and "supporting_events" in P
    assert "Never write an entry, exact or exit date that is not in the data" in P


def test_reader_format_hides_internal_metadata_in_both_prompts():
    for prompt in (P, NARRATOR_PROMPT):
        assert "Keep methodology fingerprints" in prompt
        assert "the person's forecast orb settings" in prompt.replace("\n", " ")
        assert "methodology_version" not in prompt
        assert "Executive overview" not in prompt
        assert "Statistical summary" not in prompt


# --- the data side of the same failure ----------------------------------------

def test_discover_ships_the_records_behind_its_findings():
    """evidence_ids alone point at nothing the model can read; without the
    records it fabricates them."""
    events = [
        _event("a", "Pluto", "Sun", "2027-01-01T00:00:00+00:00",
               "2027-03-01T00:00:00+00:00", [{"date": "2027-02-01T00:00:00+00:00",
                                              "orb": 0.0, "motion": "direct"}]),
        _event("b", "Uranus", "Moon", "2027-01-10T00:00:00+00:00",
               "2027-02-20T00:00:00+00:00", [{"date": "2027-02-05T00:00:00+00:00",
                                              "orb": 0.0, "motion": "direct"}]),
    ]
    out = discover(events)
    supporting = out["supporting_events"]
    assert len(supporting) == 2
    assert all("enter" in e and "leave" in e and "passes" in e for e in supporting)
    assert out["supporting_events_omitted"] == 0


def test_supporting_events_are_bounded_and_the_cut_is_stated():
    events = [
        _event(f"e{i:03d}", "Pluto", "Sun",
               f"2027-{i % 12 + 1:02d}-01T00:00:00+00:00",
               f"2027-{i % 12 + 1:02d}-20T00:00:00+00:00")
        for i in range(30)
    ]
    out = discover(events)
    assert len(out["supporting_events"]) == 12
    assert out["supporting_events_omitted"] == 18


def test_supporting_events_follow_ranked_order():
    """The records a reply is most likely to detail come first."""
    events = [
        _event("wide", "Neptune", "Sun", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00"),
        _event("tight", "Pluto", "Moon", "2027-01-01T00:00:00+00:00",
               "2027-02-01T00:00:00+00:00", [{"date": "2027-01-15T00:00:00+00:00",
                                              "orb": 0.0, "motion": "direct"}]),
    ]
    out = discover(events)
    assert out["supporting_events"][0]["event_id"] == "tight"


class _StubRuntime:
    def get_astrologer_id_for_user(self, user_id):
        return "a"

    def get_methodology_hash_for_user(self, user_id, *, default_house_system="P"):
        return "2b7193bcf64e1576eebdf88a5e16c6a51285f02132f8416610414c7e740f01e1"

    def get_stationary_threshold_for_user(self, user_id, *, default_house_system="P"):
        return 10.0

    def get_dignity_settings_for_astrologer(self, aid, *, default_house_system="P"):
        return {"signs": {}}

    def build_default_methodology(self):
        return {"dignities": {"signs": {}}}


def test_provenance_offers_a_short_version_for_display():
    """Given only the 64-character hash, a reply quotes all of it at the
    astrologer."""
    settings = build_methodology_provenance(_StubRuntime(), "u")["resolved_settings"]
    assert settings["methodology_version"] == "2b7193bcf64e"
    assert len(settings["methodology_version"]) == 12


def test_output_asks_for_human_dates_not_tool_timestamps():
    """Replies pasted tool timestamps verbatim ("2025-05-03 23:59:59-07:00") and
    narrated the search window, which buried the three exact dates asked for."""
    assert '"17 Feb 2027"' in P
    assert "no UTC" in P and "offsets such as -07:00" in P
    assert "Do not narrate search mechanics" in P


def test_output_formatting_matches_what_the_chat_renders():
    """The chat renders a small markdown subset; anything else shows up raw."""
    assert "**bold** for a" in P
    assert "No # headings, no" in P and "markdown tables" in P


def test_window_rule_no_longer_demands_auto_expansion_in_every_answer():
    """The tool rules told the model to always report auto-expansion, which beat
    the OUTPUT rule and put "Auto-expanded: no." at the end of every reply."""
    assert "whether the search auto-expanded" not in P
    assert "Mention that the search window grew only when" in P


def test_current_transit_prompt_clarifies_ambiguous_dates_and_uses_slow_planets():
    assert "call clarify_transit_period by itself" in P
    assert "A selected forecast date does not answer this question" in P
    assert "with slow_planets unless the astrologer restricts" in P
    assert "Include actual Saturn and Jupiter contacts when present" in P
    assert "nearest applying and separating contacts" in P
    assert "clearly labelling those outside the configured orb" in P


def test_current_progression_uses_complete_snapshot_not_named_pass_search():
    assert "call calculate_progression for the requested date" in P
    assert "ALL aspects to natal returned within the configured prognostic orbs" in P
    assert "Never guess or pick pairs to test" in P
    assert "find_symbolic_aspect_passes only for a named relationship with a timing question" in P


def test_natal_summary_is_backed_by_the_complete_placement_facet():
    assert "facet=natal_positions" in P
    assert "degree, house and R for every retrograde planet" in P
    assert "Leave that list to the server" in P


def test_profection_questions_use_the_engine_tool():
    assert "call calculate_profections for the requested date" in P
    assert "profected house, sign and traditional ruler" in P



def test_standard_counts_are_fetched_together():
    assert "call get_chart_data once with facet=natal_aspects" in P
    assert "and summary_only=true" in P
    assert "never split these standard counts into separate analyze calls" in P


def test_output_filters_only_debug_fingerprints_and_counters():
    from app.services.assistant_reply_text import strip_report_diagnostics

    reply = strip_report_diagnostics(
        "21 November 2026, Placidus, methodology version 15b78c0af609.\n\n"
        "No contacts in the selected window.\n"
        "0 contacts, 0 exact passes, 0 clusters, 0 simultaneous contacts.\n"
        "Statistical summary: Natal planets listed: 12\n"
        "Applying: Pluto opposition Mercury, 2.8°."
    )
    assert "15b78c0af609" not in reply
    assert "0 clusters" not in reply
    assert "Natal planets listed" not in reply
    assert "No contacts in the selected window." in reply
    assert "Pluto opposition Mercury, 2.8°." in reply
