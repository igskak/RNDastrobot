"""PR8 — symbolic aspect windows + period ingresses exposed to the assistant."""
from datetime import date, time
from uuid import uuid4

import pytest

from app.services.astro_assistant_service import AstroAssistantService
from app.services.astro_tool_schemas import build_query_tools


def _tool(name):
    return next(f["function"] for f in build_query_tools()
                if f["function"]["name"] == name)


def _service(**kw):
    return AstroAssistantService(
        db_session=None,
        default_timezone=kw.pop("tz", "Europe/Kyiv"),
        default_anchor_date=kw.pop("anchor", date(2026, 8, 3)),
        astrologer_id=uuid4(),
        **kw,
    )


# --- criterion 14: the model can never name the chart ------------------------

@pytest.mark.parametrize("name", ["find_symbolic_aspect_passes", "survey_symbolic_ingresses"])
def test_tool_never_accepts_a_chart_identifier(name):
    """user_id is server-bound. A model-supplied chart id would cross the
    tenancy boundary, so it must not exist in the schema at all."""
    props = _tool(name)["parameters"]["properties"]
    assert not {"user_id", "chart_id", "astrologer_id"} & set(props)
    assert _tool(name)["parameters"]["additionalProperties"] is False


def test_symbolic_passes_schema_shape():
    fn = _tool("find_symbolic_aspect_passes")
    props = fn["parameters"]["properties"]
    assert props["method"]["enum"] == ["progression", "direction"]
    assert set(fn["parameters"]["required"]) == {
        "method", "source_body", "target_body", "aspect_type"}
    # Window is optional: omitting it must fall back to a wide default window
    # rather than failing, because "when does X aspect Y" carries no dates.
    assert "contact_start" not in fn["parameters"]["required"]


def test_ingress_survey_requires_an_explicit_period():
    fn = _tool("survey_symbolic_ingresses")
    assert set(fn["parameters"]["required"]) == {"start_date", "end_date"}


def test_symbolic_description_steers_away_from_the_snapshot_tools():
    """The snapshot tools cannot answer 'when'. If the description does not say
    so, the model keeps reaching for calculate_progression — the same failure
    mode that left the bulk transit path unused."""
    desc = _tool("find_symbolic_aspect_passes")["description"].lower()
    assert "snapshot" in desc
    assert "calculate_progression" in desc


# --- argument validation happens before any engine work ----------------------

def test_bad_method_is_rejected():
    with pytest.raises(ValueError, match="bad_method"):
        _service()._exec_find_symbolic_aspect_passes(
            uuid4(), {"method": "transit", "source_body": "Moon",
                      "target_body": "Saturn", "aspect_type": "Square"})


def test_bad_direction_type_is_rejected():
    with pytest.raises(ValueError, match="bad_direction_type"):
        _service()._exec_find_symbolic_aspect_passes(
            uuid4(), {"method": "direction", "source_body": "Moon",
                      "target_body": "Saturn", "aspect_type": "Square",
                      "direction_type": "'; DROP TABLE t; --"})


def test_ingress_rejects_reversed_window():
    with pytest.raises(ValueError, match="bad_window"):
        _service()._exec_survey_symbolic_ingresses(
            uuid4(), {"start_date": "2028-01-01", "end_date": "2026-01-01"})


def test_ingress_rejects_malformed_date():
    with pytest.raises(ValueError, match="bad_target_date"):
        _service()._exec_survey_symbolic_ingresses(
            uuid4(), {"start_date": "not-a-date", "end_date": "2028-01-01"})


def test_ingress_rejects_bad_direction_type():
    with pytest.raises(ValueError, match="bad_direction_type"):
        _service()._exec_survey_symbolic_ingresses(
            uuid4(), {"start_date": "2026-01-01", "end_date": "2028-01-01",
                      "direction_type": "made_up"})


# --- criterion 12: the contact window reaches the model ----------------------

def test_symbolic_passes_forwards_bound_context_and_drops_series(monkeypatch):
    """series is hundreds of orb samples for the UI curve. Useful for a chart,
    ruinous for a 300-token completion, so it must not reach the model."""
    captured = {}

    class _FakeDynamics:
        def __init__(self, **kw):
            pass

        def context_from_user_id(self, user_id):
            captured["user_id"] = user_id
            return "ctx"

        def calculate(self, **kw):
            captured.update(kw)
            return {
                "status": "ok",
                "contacts": [{"enter": "2027-01-01", "exact_pass_count": 2}],
                "series": [{"t": i} for i in range(360)],
            }

    monkeypatch.setattr(
        "app.services.astro_assistant_service.AspectDynamicsService", _FakeDynamics)

    bound_uid = uuid4()
    out = _service()._exec_find_symbolic_aspect_passes(bound_uid, {
        "method": "progression", "source_body": "Moon",
        "target_body": "Saturn", "aspect_type": "Square",
        "contact_start": "2026-01-01", "contact_end": "2030-01-01",
    })

    assert "series" not in out
    assert out["contacts"][0]["exact_pass_count"] == 2
    assert out["contact_count"] == 1
    # The chart came from the server, not the model's arguments.
    assert captured["user_id"] == bound_uid
    assert captured["primary_context"] == "ctx"
    assert captured["method"] == "progression"
    assert captured["contact_start"] == date(2026, 1, 1)
    assert captured["contact_end"] == date(2030, 1, 1)
    assert captured["timezone"] == "Europe/Kyiv"
    assert captured["selected_date"] == date(2026, 8, 3)
    assert captured["selected_time"] == time(12, 0)   # midday, not a DST edge


def test_contact_count_survives_a_misleading_engine_status(monkeypatch):
    """The engine reports selected_not_in_orb about the ANCHOR date, even when
    the window holds contacts. Without an explicit count the model reads that as
    'nothing found' and reports no contacts while holding two."""
    class _FakeDynamics:
        def __init__(self, **kw):
            pass

        def context_from_user_id(self, user_id):
            return "ctx"

        def calculate(self, **kw):
            return {
                "status": "selected_not_in_orb",
                "contacts": [{"enter": "2010-01-18"}, {"enter": "2023-03-10"}],
            }

    monkeypatch.setattr(
        "app.services.astro_assistant_service.AspectDynamicsService", _FakeDynamics)

    out = _service()._exec_find_symbolic_aspect_passes(uuid4(), {
        "method": "progression", "source_body": "Moon",
        "target_body": "Saturn", "aspect_type": "Square"})

    assert out["status"] == "selected_not_in_orb"   # engine semantics preserved
    assert out["contact_count"] == 2                # …but findings are unambiguous


def test_symbolic_passes_defaults_the_window_when_omitted(monkeypatch):
    captured = {}

    class _FakeDynamics:
        def __init__(self, **kw):
            pass

        def context_from_user_id(self, user_id):
            return "ctx"

        def calculate(self, **kw):
            captured.update(kw)
            return {"status": "ok", "contacts": []}

    monkeypatch.setattr(
        "app.services.astro_assistant_service.AspectDynamicsService", _FakeDynamics)

    _service()._exec_find_symbolic_aspect_passes(uuid4(), {
        "method": "direction", "source_body": "Sun",
        "target_body": "ASC", "aspect_type": "Conjunction"})

    assert captured["contact_start"] is None       # service picks its own span
    assert captured["contact_end"] is None
    assert captured["direction_type"] == "zodiacal"   # documented default


def test_ingress_survey_binds_the_server_side_chart(monkeypatch):
    captured = {}

    class _FakeIngress:
        def calculate_period_summary(self, **kw):
            captured.update(kw)
            return {"period_start": "2026-01-01", "rows": [], "meta": {}}

    import app.services.period_ingress_summary_service as mod
    monkeypatch.setattr(mod, "PeriodIngressSummaryService", lambda: _FakeIngress())

    bound_uid = uuid4()
    out = _service()._exec_survey_symbolic_ingresses(bound_uid, {
        "start_date": "2026-01-01", "end_date": "2028-01-01",
        "direction_type": "solar_arc"})

    assert out["rows"] == []
    assert captured["user_id"] == bound_uid
    assert captured["start_date"] == date(2026, 1, 1)
    assert captured["direction_type"] == "solar_arc"
    assert captured["timezone"] == "Europe/Kyiv"


# --- criterion 15: no import-time database requirement -----------------------

def test_service_imports_without_a_database_url():
    """PeriodIngressSummaryService pulls in db_manager, which constructs at
    import time and raises without DATABASE_URL. A top-level import would make
    the assistant un-importable wherever no database is configured."""
    import subprocess
    import sys

    proc = subprocess.run(
        [sys.executable, "-c",
         "import sys; sys.path.insert(0,'.');"
         "import app.services.astro_assistant_service as m;"
         "print('ok')"],
        capture_output=True, text=True,
        env={"PATH": "/usr/bin:/bin", "HOME": "/root"},
    )
    assert proc.returncode == 0, proc.stderr
    assert "ok" in proc.stdout
