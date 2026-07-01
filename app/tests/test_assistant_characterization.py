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
    # command tools
    "set_transit_date", "step_date", "add_layer", "build_solar", "set_solar_year",
    "set_wheel_view", "set_house_system", "set_synastry_partner", "remove_layer",
    "clear_layers",
}


def test_tool_roster_is_exactly_the_fourteen():
    names = {t["function"]["name"] for t in build_tools()}
    assert names == _EXPECTED_TOOLS, (
        f"tool roster drifted: missing={_EXPECTED_TOOLS - names}, "
        f"unexpected={names - _EXPECTED_TOOLS}")
    # every tool is a well-formed function schema
    for t in build_tools():
        assert t["type"] == "function"
        assert "parameters" in t["function"]


# ── 2. both chat() reply exit paths ───────────────────────────────────────────
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
