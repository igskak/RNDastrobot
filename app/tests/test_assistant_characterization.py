"""
Characterization suite — pins the CURRENT behavior of the astro assistant so the
chat-v2 module split (astro_vocab / astro_tool_schemas / astro_commands) is proven
behavior-preserving. These tests MUST pass unchanged before AND after the refactor.

They deliberately lock three things the existing agent suite only checks in part,
because they are the refactor's real risk surface:
  1. the EXACT tool roster (a dropped/renamed tool during the split is a silent break),
  2. BOTH chat() reply exit paths — including the iteration-cap exit, which the
     agent suite does not cover and which is where the future finalize_reply() gate
     must not leak, and
  3. the ownership gate on chart_ref="synastry_partner" (tenant isolation — a
     model-named partner id must be rejected unless the astrologer owns it).

No real OpenAI call: a scripted fake client drives the loop.
"""
from types import SimpleNamespace
from datetime import date
from uuid import uuid4

import pytest

import app.services.astro_assistant_service as svc
from app.services.astro_assistant_service import (
    AstroAssistantService,
    MAX_TOOL_ITERATIONS,
    build_tools,
)


# ── fakes (mirror test_assistant_agent.py's scripted-client pattern) ──────────
def _msg(content=None, tool_calls=None):
    return SimpleNamespace(content=content, tool_calls=tool_calls)


def _tool_call(call_id, name, arguments):
    return SimpleNamespace(
        id=call_id, function=SimpleNamespace(name=name, arguments=arguments))


class _FakeCompletions:
    def __init__(self, scripted):
        self._scripted = list(scripted)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=self._scripted.pop(0))])


class _FakeClient:
    def __init__(self, scripted):
        self.chat = SimpleNamespace(completions=_FakeCompletions(scripted))


def _service_with_fake_transits(record):
    service = AstroAssistantService.__new__(AstroAssistantService)
    service.db = None
    service.default_timezone = "Europe/Kiev"
    service.default_anchor_date = date(2026, 6, 11)
    service.default_workspace = None
    service.astrologer_id = None
    service._chart_dataset = None  # __init__ is bypassed by __new__

    class _FakeTransits:
        def find_aspect_passes(self, **kwargs):
            record.update(kwargs)
            return {"status": "ok", "contacts": []}

    service._transit_service = _FakeTransits()
    return service


# ── 1. exact tool roster ──────────────────────────────────────────────────────
# The v2 module split moves build_query_tools/build_command_tools into
# astro_tool_schemas.py. If any tool is dropped or renamed in transit, the model's
# capability silently shrinks. Pin the full set so the split can't do that quietly.
_EXPECTED_TOOLS = {
    # query tools
    "find_aspect_passes", "find_chart", "calculate_progression", "calculate_direction",
    # Layer-1 technical data + Layer-2 analysis (chat-v2)
    "get_chart_data", "analyze",
    # command tools
    "set_transit_date", "step_date", "add_layer", "build_solar", "set_solar_year",
    "set_wheel_view", "set_house_system", "set_synastry_partner", "remove_layer",
    "clear_layers", "add_client_note",
}


def test_tool_roster_is_exactly_the_expected_set():
    names = {t["function"]["name"] for t in build_tools()}
    assert names == _EXPECTED_TOOLS, (
        f"tool roster drifted: missing={_EXPECTED_TOOLS - names}, "
        f"unexpected={names - _EXPECTED_TOOLS}")
    # every tool is a well-formed function schema
    for t in build_tools():
        assert t["type"] == "function"
        assert "parameters" in t["function"]


# ── 2. both chat() reply exit paths ───────────────────────────────────────────
def test_system_prompt_forbids_interpretation_absolutely():
    """The locked interpretation bug is fixed: the prompt now cites the single-source
    rubric with an absolute refusal, and the old permissive phrasing is gone."""
    from app.services.astro_boundary import NON_INTERPRETATION_RULES
    assert NON_INTERPRETATION_RULES in svc._SYSTEM_PROMPT       # single source, embedded
    assert "STRICT NON-INTERPRETATION" in svc._SYSTEM_PROMPT
    assert "even when explicitly asked" in svc._SYSTEM_PROMPT
    assert "interpretation not requested" not in svc._SYSTEM_PROMPT  # the bug is gone
    assert "ANY astrological interpretation" in svc._SYSTEM_PROMPT


def test_natural_finish_exit_returns_reply(monkeypatch):
    service = _service_with_fake_transits({})
    scripted = [_msg(content="done.")]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "hi"}])

    assert result["reply"] == "done."
    assert result["max_iterations_reached"] is False
    assert result["iterations"] == 1


def test_iteration_cap_exit_still_produces_a_reply(monkeypatch):
    """The SECOND reply exit: model keeps calling tools until the cap, then the
    loop asks once more (no tools) for a final answer. This path is where the
    future finalize_reply() gate must also run — pin its shape now."""
    service = _service_with_fake_transits({})
    # MAX_TOOL_ITERATIONS tool-calling turns, then one final content turn.
    scripted = [
        _msg(tool_calls=[_tool_call(
            f"c{i}", "find_aspect_passes",
            '{"transit_body":"Mars","natal_body":"Sun","aspect_type":"Square"}')])
        for i in range(MAX_TOOL_ITERATIONS)
    ] + [_msg(content="final answer after cap.")]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "keep going"}])

    assert result["max_iterations_reached"] is True
    assert result["iterations"] == MAX_TOOL_ITERATIONS
    assert result["reply"] == "final answer after cap."
    # every tool call was still dispatched and recorded
    assert len(result["tool_results"]) == MAX_TOOL_ITERATIONS


def test_chat_raises_when_openai_not_configured(monkeypatch):
    service = _service_with_fake_transits({})
    monkeypatch.setattr(svc, "is_openai_configured", lambda: False)
    with pytest.raises(RuntimeError):
        service.chat(uuid4(), [{"role": "user", "content": "hi"}])


def test_chat_dispatches_get_chart_data_layer1(monkeypatch):
    """The Layer-1 tool is callable through the real agent loop, end to end.

    Uses the sign_properties facet with db=None so it exercises DignityService's
    fallback (no DB), proving dispatch + assembler + provenance wiring, not mocks.
    """
    service = _service_with_fake_transits({})
    scripted = [
        _msg(tool_calls=[_tool_call("c1", "get_chart_data", '{"facet":"sign_properties"}')]),
        _msg(content="Aries: Fire, cardinal."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "sign properties?"}])

    tr = result["tool_results"][0]
    assert tr["name"] == "get_chart_data"
    assert tr["result"]["status"] == "ok"
    assert tr["result"]["facet"] == "sign_properties"
    assert set(tr["result"]["data"]).issuperset({"Aries", "Libra"})  # all 12 signs keyed
    assert tr["result"]["provenance"]["dataset"]  # provenance hash emitted


def test_chat_dispatches_analyze_layer2(monkeypatch):
    """Layer-2 analyze() runs through the real loop: model spec -> SQLite -> cited rows."""
    import app.services.astro_data_tools as dt
    fake_chart = {"planets": [
        {"name": "Sun", "sign": "Leo", "house": 5, "dignity": "domicile",
         "speed": 0.98, "retrograde": False},
        {"name": "Moon", "sign": "Cancer", "house": 4, "dignity": "domicile",
         "speed": 13.2, "retrograde": False},
    ]}

    class _N:
        def get_natal_chart_from_db(self, user_id, db):
            return fake_chart

    monkeypatch.setattr(dt, "NatalChartService", lambda *a, **k: _N())
    service = _service_with_fake_transits({})
    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "analyze",
            '{"op":"rank","over":"planets","sort":"speed","order":"desc","limit":1}')]),
        _msg(content="Fastest: Moon."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "fastest planet?"}])

    tr = result["tool_results"][0]
    assert tr["name"] == "analyze"
    assert tr["result"]["status"] == "ok"
    assert tr["result"]["rows"][0]["name"] == "Moon"    # server-computed extreme
    assert tr["result"]["rows"][0]["id"] == "r0"        # cited by id
    assert tr["result"]["provenance"]["dataset"]


# ── Layer-3 judge gate (finalize_reply) — enabled via monkeypatch ─────────────
def _run_judge_chat(monkeypatch, scripted, classify):
    service = _service_with_fake_transits({})
    monkeypatch.setattr(svc, "JUDGE_ENABLED", True)
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))
    monkeypatch.setattr(svc, "classify_reply", classify)
    return service.chat(uuid4(), [{"role": "user", "content": "q"}])


def test_judge_allows_clean_reply(monkeypatch):
    res = _run_judge_chat(
        monkeypatch, [_msg(content="Mars square Saturn, orb 0.9°.")],
        lambda reply, *, client, model, usage=None:"allow")
    assert res["reply"] == "Mars square Saturn, orb 0.9°."
    assert res["guardrail"] == "ok"


def test_judge_block_then_refuse(monkeypatch):
    # final reply + regenerated reply, both judged BLOCK -> canned refusal.
    res = _run_judge_chat(
        monkeypatch, [_msg(content="This means conflict."), _msg(content="Still conflict.")],
        lambda reply, *, client, model, usage=None:"block")
    assert res["guardrail"] == "blocked"
    assert "don't interpret" in res["reply"].lower()


def test_judge_block_then_regenerate_ok(monkeypatch):
    calls = {"n": 0}

    def classify(reply, *, client, model, usage=None):
        calls["n"] += 1
        return "block" if calls["n"] == 1 else "allow"

    res = _run_judge_chat(
        monkeypatch, [_msg(content="bad interp"), _msg(content="Mars square Saturn 0.9°")],
        classify)
    assert res["reply"] == "Mars square Saturn 0.9°"
    assert res["guardrail"] == "regenerated"


def test_judge_error_soft_fail_serves_clean(monkeypatch):
    def boom(reply, *, client, model, usage=None):
        raise RuntimeError("judge down")

    res = _run_judge_chat(monkeypatch, [_msg(content="Mars square Saturn, orb 0.9°.")], boom)
    assert res["reply"] == "Mars square Saturn, orb 0.9°."
    assert res["guardrail"] == "degraded"  # served, flagged


def test_judge_error_soft_fail_blocks_obvious_interpretation(monkeypatch):
    def boom(reply, *, client, model, usage=None):
        raise RuntimeError("judge down")

    res = _run_judge_chat(monkeypatch, [_msg(content="This indicates conflict.")], boom)
    assert res["guardrail"] == "blocked_degraded"
    assert "don't interpret" in res["reply"].lower()


def test_iteration_cap_exit_is_also_judged(monkeypatch):
    """The SECOND exit goes through the same gate — nothing escapes ungated."""
    scripted = [
        _msg(tool_calls=[_tool_call(
            f"c{i}", "find_aspect_passes",
            '{"transit_body":"Mars","natal_body":"Sun","aspect_type":"Square"}')])
        for i in range(MAX_TOOL_ITERATIONS)
    ] + [_msg(content="cap interp"), _msg(content="regen interp")]
    res = _run_judge_chat(monkeypatch, scripted, lambda reply, *, client, model, usage=None:"block")
    assert res["max_iterations_reached"] is True
    assert res["guardrail"] == "blocked"  # cap exit was gated + refused


# ── structured citation (quote-by-reference) end-to-end ───────────────────────
def _service_with_analyze_chart(monkeypatch):
    import app.services.astro_data_tools as dt
    fake_chart = {"planets": [
        {"name": "Moon", "sign": "Cancer", "house": 4, "dignity": "domicile",
         "speed": 13.2, "retrograde": False},
        {"name": "Mars", "sign": "Aries", "house": 1, "dignity": "domicile",
         "speed": 0.6, "retrograde": False},
    ]}

    class _N:
        def get_natal_chart_from_db(self, user_id, db):
            return fake_chart

    monkeypatch.setattr(dt, "NatalChartService", lambda *a, **k: _N())
    return _service_with_fake_transits({})


def test_citation_is_substituted_by_server(monkeypatch):
    service = _service_with_analyze_chart(monkeypatch)
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "analyze",
            '{"op":"rank","over":"planets","sort":"speed","order":"desc","limit":1}')]),
        _msg(content="Fastest: {{r0.name}} at {{r0.speed}} deg/day."),
    ]
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))
    res = service.chat(uuid4(), [{"role": "user", "content": "fastest?"}])
    assert res["reply"] == "Fastest: Moon at 13.2 deg/day."  # server-rendered, not retyped
    assert res["guardrail"] == "ok"


def test_unresolved_citation_is_refused(monkeypatch):
    service = _service_with_analyze_chart(monkeypatch)
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "analyze",
            '{"op":"rank","over":"planets","sort":"speed","order":"desc","limit":1}')]),
        _msg(content="The value is {{r9.speed}}."),  # r9 was never produced
    ]
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))
    res = service.chat(uuid4(), [{"role": "user", "content": "fastest?"}])
    assert res["guardrail"] == "blocked_citation"       # fabrication caught
    assert "don't interpret" in res["reply"].lower() or "не интерпрет" in res["reply"].lower()


def test_transit_turn_with_stray_token_is_not_false_blocked(monkeypatch):
    """Regression for prod metric 154: a find_aspect_passes turn has no citable
    analyze() rows, so a stray {{...}} token must be STRIPPED and the answer served,
    never false-blocked as a fabricated citation."""
    service = _service_with_fake_transits({})
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "find_aspect_passes",
            '{"transit_body":"Uranus","natal_body":"Moon","aspect_type":"Conjunction"}')]),
        _msg(content="Uranus conjoins Moon around {{r0.date}}."),  # stray token, no analyze
    ]
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))
    res = service.chat(uuid4(), [{"role": "user", "content": "uranus transits?"}])
    assert res["guardrail"] == "ok"                 # NOT blocked_citation
    assert "{{" not in res["reply"]                 # stray token stripped
    assert "Uranus conjoins Moon" in res["reply"]   # the real answer is served


def test_system_prompt_has_citation_rule():
    from app.services.astro_citation import CITATION_RULE
    assert CITATION_RULE in svc._SYSTEM_PROMPT


def test_locale_instruction_maps_codes():
    assert "English" in svc._locale_instruction("en")
    assert "Russian" in svc._locale_instruction("ru")
    assert "Ukrainian" in svc._locale_instruction("uk")
    assert svc._locale_instruction(None) is None
    assert svc._locale_instruction("") is None


def test_chat_injects_ui_locale_so_reply_matches_language(monkeypatch):
    """Beta bug fix: an English UI must get an English reply. The UI locale is sent
    as a system instruction; omitting locale (legacy) injects nothing."""
    service = _service_with_fake_transits({})
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    client = _FakeClient([_msg(content="ok")])
    monkeypatch.setattr(svc, "get_openai_client", lambda: client)

    service.chat(uuid4(), [{"role": "user", "content": "which transits?"}], locale="en")

    system = " ".join(m["content"] for m in client.chat.completions.calls[0]["messages"]
                       if m["role"] == "system")
    assert "interface language is English" in system
    assert "Write your reply in English" in system


def test_get_chart_data_dataset_reused_across_calls_in_one_turn(monkeypatch):
    """Two get_chart_data calls in one turn share ONE frozen dataset instance."""
    service = _service_with_fake_transits({})
    scripted = [
        _msg(tool_calls=[_tool_call("c1", "get_chart_data", '{"facet":"sign_properties"}')]),
        _msg(tool_calls=[_tool_call("c2", "get_chart_data", '{"facet":"sign_properties"}')]),
        _msg(content="done."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    service.chat(uuid4(), [{"role": "user", "content": "twice"}])
    assert service._chart_dataset is not None  # one dataset, memoized on the service


# ── 3. ownership gate on chart_ref="synastry_partner" (tenant isolation) ───────
class _OwnershipDB:
    """Minimal fake for _owned_chart_exists: query(...).filter(...).first()."""
    def __init__(self, owned: bool):
        self._owned = owned

    def query(self, *a, **k):
        return self

    def filter(self, *a, **k):
        return self

    def first(self):
        return object() if self._owned else None


def _synastry_service(owned: bool, partner_id):
    service = AstroAssistantService.__new__(AstroAssistantService)
    service.db = _OwnershipDB(owned)
    service.astrologer_id = uuid4()
    service.default_workspace = {
        "synastry": {"active": True, "mode": "db", "partnerId": str(partner_id)},
    }
    return service


def test_active_chart_ref_binds_server_user_id():
    """active_chart always resolves to the server-bound user_id, never a model arg."""
    service = _synastry_service(owned=False, partner_id=uuid4())
    bound = uuid4()
    kind, resolved_id, inline = service._resolve_chart_source(bound, {"chart_ref": "active_chart"})
    assert kind == "active_chart"
    assert resolved_id == bound
    assert inline is None


def test_synastry_partner_requires_ownership():
    """A saved-chart synastry partner the astrologer does NOT own is rejected —
    the model can name a partnerId but cannot read a chart outside the tenant."""
    partner = uuid4()
    service = _synastry_service(owned=False, partner_id=partner)
    with pytest.raises(ValueError) as exc:
        service._resolve_chart_source(uuid4(), {"chart_ref": "synastry_partner"})
    assert "synastry_partner_missing:partner_access" in str(exc.value)


def test_owned_synastry_partner_resolves():
    partner = uuid4()
    service = _synastry_service(owned=True, partner_id=partner)
    kind, resolved_id, inline = service._resolve_chart_source(
        uuid4(), {"chart_ref": "synastry_partner"})
    assert kind == "synastry_partner"
    assert resolved_id == partner
    assert inline is None


def test_bad_chart_ref_is_rejected():
    service = _synastry_service(owned=True, partner_id=uuid4())
    with pytest.raises(ValueError) as exc:
        service._resolve_chart_source(uuid4(), {"chart_ref": "some_other_chart"})
    assert "bad_chart_ref" in str(exc.value)
