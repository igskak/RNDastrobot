"""
Tests for the function-calling agent loop (astro_assistant_service).

No real OpenAI call: a scripted fake client drives the loop. Verifies tool
dispatch, that the active chart's user_id is injected server-side (never a
model argument), and that the tool schema exposes deterministic enums.
"""
from types import SimpleNamespace
from datetime import date
from uuid import uuid4

import app.services.astro_assistant_service as svc
from app.services.astro_assistant_service import (
    ASPECT_TYPE_NAMES,
    AstroAssistantService,
    NATAL_BODY_NAMES,
    TRANSIT_BODY_NAMES,
    build_tools,
)


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
        msg = self._scripted.pop(0)
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


class _FakeClient:
    def __init__(self, scripted):
        self.chat = SimpleNamespace(completions=_FakeCompletions(scripted))


def test_build_tools_exposes_enums_and_hides_user_id():
    tools = build_tools()
    assert len(tools) == 1
    params = tools[0]["function"]["parameters"]
    props = params["properties"]
    assert "user_id" not in props  # server-bound, never model-controlled
    assert set(props["transit_body"]["enum"]) == set(TRANSIT_BODY_NAMES)
    assert set(props["natal_body"]["enum"]) == set(NATAL_BODY_NAMES)
    assert set(props["aspect_type"]["enum"]) == set(ASPECT_TYPE_NAMES)
    assert params["required"] == ["transit_body", "natal_body", "aspect_type"]


def test_assistant_defaults_to_compact_modern_model():
    assert svc._MODEL == "gpt-5.4-mini"
    assert "at most 80 words" in svc._SYSTEM_PROMPT


def _service_with_fake_transits(record):
    service = AstroAssistantService.__new__(AstroAssistantService)
    service.db = None
    service.default_timezone = "Europe/Kiev"
    service.default_anchor_date = date(2026, 6, 11)

    class _FakeTransits:
        def find_aspect_passes(self, **kwargs):
            record.update(kwargs)
            return {"status": "ok", "contacts": [], "exact_angle": 0.0}

    service._transit_service = _FakeTransits()
    return service


def test_chat_dispatches_tool_and_injects_active_chart_user_id(monkeypatch):
    bound_user = uuid4()
    captured = {}
    service = _service_with_fake_transits(captured)

    scripted = [
        _msg(tool_calls=[_tool_call(
            "call_1", "find_aspect_passes",
            '{"transit_body":"Uranus","natal_body":"Venus","aspect_type":"Conjunction"}',
        )]),
        _msg(content="Uranus first perfects conjunction to Venus on ..."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    client = _FakeClient(scripted)
    monkeypatch.setattr(svc, "get_openai_client", lambda: client)

    result = service.chat(bound_user, [{"role": "user", "content": "when uranus conj venus?"}])

    assert result["iterations"] == 2
    assert result["max_iterations_reached"] is False
    assert result["reply"].startswith("Uranus first perfects")
    # user_id was injected from context, not from the model's tool args.
    assert captured["user_id"] == bound_user
    assert captured["transit_body"] == "Uranus"
    assert captured["timezone"] == "Europe/Kiev"  # default applied when model omits it
    assert captured["start_date"] == date(2016, 6, 11)
    assert captured["end_date"] == date(2036, 6, 11)
    assert len(result["tool_results"]) == 1
    assert result["tool_results"][0]["name"] == "find_aspect_passes"
    assert all("reasoning_effort" not in call for call in client.chat.completions.calls)
    assert all(call["verbosity"] == "low" for call in client.chat.completions.calls)


def test_chat_handles_tool_error_without_crashing(monkeypatch):
    service = AstroAssistantService.__new__(AstroAssistantService)
    service.db = None
    service.default_timezone = "UTC"
    service.default_anchor_date = date(2026, 6, 11)

    class _RaisingTransits:
        def find_aspect_passes(self, **kwargs):
            raise ValueError("Natal chart not found for user_id=x")

    service._transit_service = _RaisingTransits()

    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "find_aspect_passes",
            '{"transit_body":"Mars","natal_body":"Sun","aspect_type":"Square"}')]),
        _msg(content="I couldn't find that chart."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "mars square sun?"}])
    assert result["tool_results"][0]["result"]["status"] == "error"
    assert result["reply"] == "I couldn't find that chart."


def test_periodless_fast_body_uses_one_year_overview():
    captured = {}
    service = _service_with_fake_transits(captured)

    service._exec_find_aspect_passes(uuid4(), {
        "transit_body": "Mars",
        "natal_body": "Sun",
        "aspect_type": "Square",
    })

    assert captured["start_date"] == date(2025, 6, 11)
    assert captured["end_date"] == date(2027, 6, 11)


def test_explicit_next_contact_is_not_rewritten():
    captured = {}
    service = _service_with_fake_transits(captured)

    service._exec_find_aspect_passes(uuid4(), {
        "transit_body": "Uranus",
        "natal_body": "Venus",
        "aspect_type": "Conjunction",
        "mode": "next_contact",
        "anchor_date": "2028-01-15",
    })

    assert captured["anchor_date"] == date(2028, 1, 15)
    assert captured["start_date"] is None
    assert captured["end_date"] is None
