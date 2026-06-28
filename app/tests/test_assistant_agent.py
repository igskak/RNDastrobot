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
    COMMAND_REGISTRY,
    NATAL_BODY_NAMES,
    TRANSIT_BODY_NAMES,
    WORKSPACE_LAYER_METHODS,
    build_tools,
    handle_command,
    validate_command,
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


def _tool_by_name(tools, name):
    return next(t for t in tools if t["function"]["name"] == name)


def test_build_tools_exposes_enums_and_hides_user_id():
    tools = build_tools()
    by_name = {t["function"]["name"] for t in tools}
    aspect = _tool_by_name(tools, "find_aspect_passes")
    params = aspect["function"]["parameters"]
    props = params["properties"]
    assert "user_id" not in props  # server-bound, never model-controlled
    assert set(props["transit_body"]["enum"]) == set(TRANSIT_BODY_NAMES)
    assert set(props["natal_body"]["enum"]) == set(NATAL_BODY_NAMES)
    assert set(props["aspect_type"]["enum"]) == set(ASPECT_TYPE_NAMES)
    assert params["required"] == ["transit_body", "natal_body", "aspect_type"]
    # PR2: command tools sit alongside the query tool, generated from the registry.
    assert set(COMMAND_REGISTRY).issubset(by_name)
    assert "restore_workspace" not in by_name  # internal undo inverse is never exposed
    assert "find_chart" in by_name  # PR4 grounding query tool
    assert "set_synastry_partner" in by_name
    add_layer = _tool_by_name(tools, "add_layer")
    assert set(add_layer["function"]["parameters"]["properties"]["method"]["enum"]) \
        == set(WORKSPACE_LAYER_METHODS)


def test_validate_command_enforces_enums_and_ranges():
    assert validate_command("set_wheel_view", {"view": "single"}) == ""
    assert validate_command("set_wheel_view", {"view": "triple"}) == "bad_view"
    assert validate_command("add_layer", {"method": "transit"}) == ""
    assert validate_command("add_layer", {"method": "lunar"}) == "bad_method"
    assert validate_command("set_solar_year", {"year": 2027}) == ""
    assert validate_command("set_solar_year", {"year": 1700}) == "bad_year"
    assert validate_command("set_solar_year", {"year": True}) == "bad_year"  # bool is not a year
    assert validate_command("set_transit_date", {"date": "2026-03-14"}) == ""
    assert validate_command("set_transit_date", {"date": "2026-02-30"}) == "bad_date"
    assert validate_command("set_transit_date", {"date": "2026-03-14", "time": "25:00"}) == "bad_time"
    assert validate_command("step_date", {"amount": 2, "unit": "week", "direction": "backward"}) == ""
    assert validate_command("step_date", {"amount": 0, "unit": "day", "direction": "forward"}) == "bad_amount"
    assert validate_command("remove_layer", {}) == "bad_target"
    assert validate_command("remove_layer", {"layer_id": "transit-2"}) == ""


def test_handle_command_emits_action_or_error():
    receipt, action = handle_command("set_wheel_view", {"view": "single"})
    assert receipt == {"status": "applied_clientside", "command": "set_wheel_view"}
    assert action == {"name": "set_wheel_view", "args": {"view": "single"}, "confirm": "auto"}

    receipt, action = handle_command("remove_layer", {"method": "transit"})
    assert action["confirm"] == "confirm"  # destructive → client shows a confirm chip

    receipt, action = handle_command("set_solar_year", {"year": 1700})
    assert receipt["status"] == "error" and action is None  # invalid → no action emitted


def test_set_synastry_partner_command():
    assert validate_command("set_synastry_partner", {"chart_id": "abc"}) == ""
    assert validate_command("set_synastry_partner", {}) == "bad_chart_id"
    assert validate_command("set_synastry_partner", {"chart_id": "   "}) == "bad_chart_id"
    receipt, action = handle_command(
        "set_synastry_partner", {"chart_id": " abc ", "title": "Алёна"})
    assert receipt["status"] == "applied_clientside"
    assert action == {
        "name": "set_synastry_partner",
        "args": {"chart_id": "abc", "title": "Алёна"},
        "confirm": "auto",
    }


class _FakeChartQuery:
    def __init__(self, rows, calls):
        self._rows, self._calls = rows, calls

    def filter(self, *a, **k):
        self._calls["filtered"] = True
        return self

    def order_by(self, *a, **k):
        return self

    def limit(self, n):
        self._calls["limit"] = n
        return self

    def all(self):
        return self._rows


class _FakeChartDB:
    def __init__(self, rows, calls):
        self._rows, self._calls = rows, calls

    def query(self, model):
        self._calls["model"] = model
        return _FakeChartQuery(self._rows, self._calls)


def test_find_chart_returns_scoped_compact_matches():
    calls = {}
    rows = [SimpleNamespace(
        user_id=uuid4(), title=None, first_name="Алёна", last_name="К",
        birth_date=date(1990, 6, 26), birth_place="Kyiv")]
    service = AstroAssistantService.__new__(AstroAssistantService)
    service.db = _FakeChartDB(rows, calls)
    service.astrologer_id = uuid4()

    out = service._exec_find_chart(uuid4(), {"query": "Алёна"})

    assert out["status"] == "ok" and out["count"] == 1
    m = out["matches"][0]
    assert m["title"] == "Алёна К"
    assert m["birth_date"] == "1990-06-26"
    assert m["birth_place"] == "Kyiv"
    assert calls["limit"] == 8 and calls["model"].__name__ == "User"


def test_find_chart_requires_astrologer_and_query():
    service = AstroAssistantService.__new__(AstroAssistantService)
    service.db = None
    service.astrologer_id = None
    assert service._exec_find_chart(uuid4(), {"query": "x"})["status"] == "error"
    service.astrologer_id = uuid4()
    assert service._exec_find_chart(uuid4(), {"query": "  "})["status"] == "error"


def test_assistant_defaults_to_compact_modern_model():
    assert svc._MODEL == "gpt-5.4-mini"
    assert "at most 80 words" in svc._SYSTEM_PROMPT
    assert "every `Точно` pass" in svc._SYSTEM_PROMPT
    assert "`Вход`" in svc._SYSTEM_PROMPT
    assert "`Выход`" in svc._SYSTEM_PROMPT
    assert "`D` (direct) or `R` (retrograde)" in svc._SYSTEM_PROMPT
    assert "`Станция R/D`" in svc._SYSTEM_PROMPT
    assert "Многослойный режим" in svc._SYSTEM_PROMPT


def _service_with_fake_transits(record):
    service = AstroAssistantService.__new__(AstroAssistantService)
    service.db = None
    service.default_timezone = "Europe/Kiev"
    service.default_anchor_date = date(2026, 6, 11)
    service.default_workspace = None

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


def test_chat_emits_command_action_without_server_mutation(monkeypatch):
    captured = {}
    service = _service_with_fake_transits(captured)  # transit service must NOT be touched

    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "set_wheel_view", '{"view":"single"}')]),
        _msg(content="Показал одиночную карту."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "покажи одиночную карту"}])

    assert result["actions"] == [
        {"name": "set_wheel_view", "args": {"view": "single"}, "confirm": "auto"}]
    assert result["reply"] == "Показал одиночную карту."
    assert result["tool_results"][0]["result"]["status"] == "applied_clientside"
    assert captured == {}  # command never reached the deterministic transit service


def test_chat_coerces_multi_layer_mode_to_wheel_view(monkeypatch):
    service = _service_with_fake_transits({})

    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "add_layer", '{"method":"transit"}')]),
        _msg(content="Добавил транзиты."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "Перейди в многослойный режим."}])

    assert result["actions"] == [
        {"name": "set_wheel_view", "args": {"view": "multi"}, "confirm": "auto"}]
    assert result["reply"] == "Перешёл в многослойный режим."
    assert result["tool_results"][0]["name"] == "add_layer"


def test_chat_keeps_explicit_add_transit_layer(monkeypatch):
    service = _service_with_fake_transits({})

    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "add_layer", '{"method":"transit"}')]),
        _msg(content="Добавил транзиты."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "Добавь транзиты."}])

    assert result["actions"] == [
        {"name": "add_layer", "args": {"method": "transit"}, "confirm": "auto"}]
    assert result["reply"] == "Добавил транзиты."


def test_chat_rejects_invalid_command_arg_and_emits_no_action(monkeypatch):
    service = _service_with_fake_transits({})

    scripted = [
        _msg(tool_calls=[_tool_call(
            "c1", "set_solar_year", '{"year":1700}')]),
        _msg(content="Год вне диапазона."),
    ]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    monkeypatch.setattr(svc, "get_openai_client", lambda: _FakeClient(scripted))

    result = service.chat(uuid4(), [{"role": "user", "content": "построй соляр на 1700"}])

    assert result["actions"] == []
    assert result["tool_results"][0]["result"]["status"] == "error"
    assert result["tool_results"][0]["result"]["error"] == "bad_year"


def test_chat_injects_workspace_context_for_grounding(monkeypatch):
    service = _service_with_fake_transits({})
    service.default_workspace = {
        "wheelView": "single",
        "layers": ["transit", "solar_return", "bogus"],  # bogus must be filtered out
        "date": "2026-03-14",
        "houseSystem": "K",
    }
    scripted = [_msg(content="Ок.")]
    monkeypatch.setattr(svc, "is_openai_configured", lambda: True)
    client = _FakeClient(scripted)
    monkeypatch.setattr(svc, "get_openai_client", lambda: client)

    service.chat(uuid4(), [{"role": "user", "content": "что активно?"}])

    sent = client.chat.completions.calls[0]["messages"]
    context = next(
        m["content"] for m in sent
        if m["role"] == "system" and "Current workspace state" in m["content"])
    assert "wheel view: single" in context
    assert "active layers: transit, solar_return" in context  # bogus filtered
    assert "transit date: 2026-03-14" in context
    assert "house system: K" in context
