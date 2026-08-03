"""§16 Narrative Analyst — the writing stage, isolated from tool selection."""
import app.services.astro_narrative as nar
from app.services.astro_narrative import _SYSTEM, is_analytical_turn, narrate


def _flat(text):
    """Prose in the prompt is hard-wrapped; assert on meaning, not line breaks."""
    return " ".join(text.split())


FLAT = _flat(_SYSTEM)


class _FakeClient:
    def __init__(self, content="написанный отчёт", explode=False):
        self._content = content
        self._explode = explode
        self.captured = None

        class _Completions:
            def create(inner, **kw):
                self.captured = kw
                if self._explode:
                    raise RuntimeError("upstream down")
                return type("R", (), {
                    "choices": [type("C", (), {
                        "message": type("M", (), {"content": self._content})()})()],
                    "usage": None,
                })()

        self.chat = type("Chat", (), {"completions": _Completions()})()


# --- when the stage applies ----------------------------------------------------

def test_only_analytical_turns_are_narrated():
    """A lookup has nothing to narrate and must not pay for a second completion."""
    assert is_analytical_turn([{"name": "discover_patterns"}])
    assert is_analytical_turn([{"name": "survey_transits"}])
    assert is_analytical_turn([{"name": "intersect_forecast_windows"}])
    assert not is_analytical_turn([{"name": "get_chart_data"}])
    assert not is_analytical_turn([{"name": "find_aspect_passes"}])
    assert not is_analytical_turn([])


def test_stage_is_off_in_code_and_enabled_explicitly():
    """The code default stays off so tests and local runs never pay for the extra
    completion; production opts in through render.yaml. That split is what lets
    the stage be switched off in prod without a code change."""
    import os
    from pathlib import Path

    assert os.getenv("ASSISTANT_NARRATIVE_ENABLED") in (None, "", "false")
    assert nar.NARRATIVE_ENABLED is False
    render = Path("render.yaml").read_text()
    assert "ASSISTANT_NARRATIVE_ENABLED" in render


# --- isolation is the point ----------------------------------------------------

def test_narrator_gets_no_tools():
    """It cannot call anything, so it cannot misreport a call."""
    client = _FakeClient()
    narrate(client=client, tool_results=[{"name": "discover_patterns", "result": {"a": 1}}],
            user_question="что важного?")
    assert "tools" not in client.captured
    assert "tool_choice" not in client.captured


def test_only_analytical_results_reach_the_narrator():
    """Its context should be findings, not the whole tool transcript."""
    client = _FakeClient()
    narrate(client=client, user_question="q", tool_results=[
        {"name": "discover_patterns", "result": {"marker": "KEEP"}},
        {"name": "get_chart_data", "result": {"marker": "DROP"}},
    ])
    payload = client.captured["messages"][-1]["content"]
    assert "KEEP" in payload
    assert "DROP" not in payload


def test_user_question_travels_with_the_findings():
    client = _FakeClient()
    narrate(client=client, user_question="Что важного за два года?",
            tool_results=[{"name": "discover_patterns", "result": {}}])
    assert "Что важного за два года?" in client.captured["messages"][-1]["content"]


def test_locale_line_is_forwarded():
    client = _FakeClient()
    narrate(client=client, user_question="q", locale_line="Reply in Russian.",
            tool_results=[{"name": "discover_patterns", "result": {}}])
    systems = [m["content"] for m in client.captured["messages"] if m["role"] == "system"]
    assert any("Reply in Russian." in s for s in systems)


# --- failure must not cost the turn --------------------------------------------

def test_failure_returns_none_so_the_tool_stage_answer_survives():
    """The caller already holds a serviceable answer; a narration failure must
    degrade to it rather than losing the astrologer's turn."""
    client = _FakeClient(explode=True)
    assert narrate(client=client, user_question="q",
                   tool_results=[{"name": "discover_patterns", "result": {}}]) is None


def test_empty_output_is_treated_as_failure():
    client = _FakeClient(content="   ")
    assert narrate(client=client, user_question="q",
                   tool_results=[{"name": "discover_patterns", "result": {}}]) is None


# --- the prompt itself ----------------------------------------------------------

def test_prompt_forbids_creating_facts():
    assert "do NOT calculate astrology" in FLAT
    assert "do NOT create new findings" in FLAT
    assert "Report ONLY numbers present in the data you were given" in FLAT
    assert "never continue a series by analogy" in FLAT


def test_prompt_demands_structure_before_aspects():
    assert "Begin with the STRUCTURE of the data, not a list of aspects" in FLAT
    assert "one short paragraph of PROSE" in FLAT


def test_prompt_carries_the_boundary_rubric():
    from app.services.astro_boundary import NON_INTERPRETATION_RULES
    assert NON_INTERPRETATION_RULES in _SYSTEM


def test_prompt_states_the_no_pattern_case():
    assert "distributed without a dominant cluster" in FLAT


def test_prompt_fixes_the_two_cosmetic_warts_seen_live():
    assert "never a full hash" in FLAT
    assert 'rather than writing "not specified"' in FLAT
    assert "write every heading in the astrologer's language" in FLAT


def test_narrative_defaults_to_the_measured_winner():
    """The flag is the only gate, so the default has to be the configuration that
    actually won: pointing it at the assistant model would mean flipping the flag
    alone buys the weakest variant tried (see the comparison in model_config)."""
    from app.services.model_config import model_for
    assert model_for("narrative") == "gpt-5.6-luna"
    assert model_for("narrative") != model_for("assistant")
    assert nar.NARRATIVE_REASONING_EFFORT == "low"


def test_reasoning_stage_gets_a_far_larger_token_ceiling():
    """Reasoning tokens bill from the SAME completion budget and are emitted
    BEFORE any content, so reusing the plain ceiling yields no answer at all.
    Measured live on a real findings payload: at 1800 the model spent all 1800
    on reasoning, hit finish_reason=length and returned an empty string; at 8000
    it reasoned for 267 and wrote the whole report."""
    import importlib
    import os

    original = dict(os.environ)
    try:
        os.environ.pop("ASSISTANT_NARRATIVE_TOKENS", None)

        os.environ["ASSISTANT_NARRATIVE_REASONING"] = ""
        plain = importlib.reload(nar).MAX_NARRATIVE_TOKENS

        os.environ["ASSISTANT_NARRATIVE_REASONING"] = "medium"
        reasoning = importlib.reload(nar).MAX_NARRATIVE_TOKENS

        assert plain == 1800
        assert reasoning >= 8000, "a reasoning stage starves at the plain ceiling"
    finally:
        os.environ.clear()
        os.environ.update(original)
        importlib.reload(nar)


def test_reasoning_effort_replaces_verbosity_not_joins_it():
    """A reasoning parameter sent to a plain chat model is rejected outright, and
    verbosity is not the knob a reasoning model takes."""
    import importlib
    import os

    original = dict(os.environ)
    try:
        os.environ["ASSISTANT_NARRATIVE_REASONING"] = "medium"
        mod = importlib.reload(nar)
        client = _FakeClient()
        mod.narrate(client=client, user_question="q",
                    tool_results=[{"name": "discover_patterns", "result": {}}])
        assert client.captured["reasoning_effort"] == "medium"
        assert "verbosity" not in client.captured
    finally:
        os.environ.clear()
        os.environ.update(original)
        importlib.reload(nar)
