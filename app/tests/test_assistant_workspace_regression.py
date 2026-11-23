"""Synthetic regression chart for the workspace assistant."""
import json
from datetime import date, datetime, time
from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.services.astro_assistant_service as assistant
from app.services.astro_data_tools import ChartDataset
from app.services.natal_chart_service import NatalChartService
from app.services.natal_context import NatalContext
from app.services.transit_service import TransitService

from app.tests.test_assistant_characterization import _FakeClient, _msg, _tool_call


REFERENCE_DATE = date(2026, 11, 21)
TIMEZONE = "Asia/Bangkok"


@pytest.fixture(scope="module")
def chart():
    return NatalChartService().calculate_natal_chart(
        date(1993, 8, 17), time(13), TIMEZONE,
        latitude=13.75, longitude=100.5,
    )


@pytest.fixture
def aspect_types():
    return [
        SimpleNamespace(aspect_type=name, exact_angle=angle, class_="major", character="neutral")
        for name, angle in zip(assistant.DEFAULT_ASPECT_TYPES, (0, 60, 90, 120, 180))
    ]


@pytest.fixture
def service(monkeypatch, chart, aspect_types):
    class ReferenceClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls.combine(REFERENCE_DATE, time(12), tz)

    monkeypatch.setattr(assistant, "datetime", ReferenceClock)
    monkeypatch.setattr(assistant, "build_methodology_provenance", lambda *a: None)
    service = assistant.AstroAssistantService(
        db_session=None, default_timezone=TIMEZONE, default_anchor_date=REFERENCE_DATE,
    )
    # Only persistence/reference reads are substituted. The real transit and
    # natal engines use the same geometry, aspects and orb settings as the synthetic chart.
    context = NatalContext.from_inline(chart, astrologer_id=None, apply_exclusions=False)
    ds = ChartDataset(user_id=uuid4(), astrologer_id=None, db=None)
    monkeypatch.setattr(ds, "_natal_chart", lambda: chart)
    service._chart_dataset = ds
    transits = TransitService(db_session=None)
    monkeypatch.setattr(transits, "_build_context_from_user_id", lambda *a, **k: context)
    monkeypatch.setattr(transits, "_load_natal_data", lambda *a, **k: context.natal_data)
    monkeypatch.setattr(transits, "_get_aspect_types", lambda: aspect_types)
    monkeypatch.setattr(transits.preferences_runtime, "get_astrologer_id_for_user", lambda _: None)
    monkeypatch.setattr(transits, "get_cached_transit_events", lambda *a: None)
    monkeypatch.setattr(transits, "_save_transit_events_cache", lambda *a, **k: None)
    service._transit_service = transits
    return service


def test_right_now_clarification_stops_before_calculating_and_returns_buttons(
    service, monkeypatch,
):
    client = _FakeClient([_msg(tool_calls=[_tool_call("1", "clarify_transit_period", "{}")])])
    monkeypatch.setattr(assistant, "is_openai_configured", lambda: True)
    monkeypatch.setattr(assistant, "get_openai_client", lambda: client)
    service.default_workspace = {"resources": {"layers": [{
        "selected": True,
        "config": {"startDate": "2026-10-01", "endDate": "2027-02-01"},
    }]}}

    result = service.chat(uuid4(), [{"role": "user", "content": "key transits right now"}], locale="en")

    assert result["iterations"] == 1
    assert result["reply"].count("?") == 1
    assert result["quick_replies"] == [
        "Today only (aspects in orb)", "±1 week", "±1 month",
        "The forecast period (2026-10-01 to 2027-02-01)",
    ]
    assert all(choice in result["reply"] for choice in result["quick_replies"])
    assert [row["name"] for row in result["tool_results"]] == ["clarify_transit_period"]


def test_selected_month_uses_real_survey_and_shows_nearby_aspects(service, monkeypatch):
    args = {
        "start_date": "2026-10-21", "end_date": "2026-12-21",
        "profile": "slow_planets", "reference_date": "2026-11-21",
    }
    client = _FakeClient([
        _msg(tool_calls=[_tool_call("1", "survey_transits", json.dumps(args))]),
        _msg(content="Contacts for the selected month."),
    ])
    monkeypatch.setattr(assistant, "is_openai_configured", lambda: True)
    monkeypatch.setattr(assistant, "get_openai_client", lambda: client)
    reply, _ = service._transit_period_question("en")
    result = service.chat(uuid4(), [
        {"role": "user", "content": "key transits right now"},
        {"role": "assistant", "content": reply},
        {"role": "user", "content": "±месяц"},
    ], locale="en")

    assert result["iterations"] == 2
    data = result["tool_results"][0]["result"]
    assert {"Saturn", "Jupiter"} <= set(data["profile"]["transit_bodies"])
    assert {"Jupiter", "Saturn"} <= {event["transit_body"] for event in data["events"]}
    outside = data["nearby_contacts"]["outside_orb"]
    assert {"applying", "separating"} == {item["phase"] for item in outside}
    contacts = {
        (item["transit_body"], item["aspect_type"], item["natal_body"]): round(item["orb"], 1)
        for item in outside
    }
    assert contacts["Jupiter", "Conjunction", "Sun"] == 1.9
    assert contacts["Neptune", "Opposition", "Mars"] == 1.5
    assert contacts["Chiron", "Trine", "Sun"] == 2.9


def test_empty_outer_planet_day_still_carries_applying_and_separating_contacts(service):
    data = service._dispatch("survey_transits", {
        "start_date": "2026-11-21", "end_date": "2026-11-21",
        "profile": "outer_planets", "natal_targets": ["Sun"],
    }, uuid4())

    assert data["events"] == []
    outside = data["nearby_contacts"]["outside_orb"]
    assert {"applying", "separating"} == {item["phase"] for item in outside}
    assert all(not item["in_orb"] and item["orb_used"] == 1 for item in outside)


def test_current_progressions_return_engine_aspects_within_configured_orbs(
    service, chart, aspect_types, monkeypatch,
):
    from app.services.progression_service import ProgressionService

    engine = ProgressionService(db_session=None)
    context = NatalContext.from_inline(chart, astrologer_id=None)
    monkeypatch.setattr(engine, "_build_context_from_user_id", lambda _: context)
    monkeypatch.setattr(engine, "_get_aspect_types", lambda: aspect_types)
    service._progression_service = engine

    result = service._dispatch("calculate_progression", {"target_date": "2026-11-21"}, uuid4())

    assert result["progression_info"]["target_date"] == "2026-11-21"
    assert result["progression_info"]["target_time"] == "12:00:00"
    assert any(body["name"] == "Moon" and body["degree"] for body in result["progressed_planets"])
    aspects = {
        (item["left"], item["aspect"], item["right"]): round(item["orb"], 2)
        for item in result["aspects_to_natal"]
    }
    assert aspects["Venus", "Opposition", "Saturn"] == 0.30
    assert aspects["Moon", "Square", "Mercury"] == 2.08
    assert all(orb <= (3 if left == "Moon" else 1)
               for (left, _, _), orb in aspects.items())


def test_progression_snapshot_does_not_truncate_aspects_or_positions(service):
    aspects = [
        {"progressed_planet": "Moon", "natal_object": str(i), "aspect_type": "Trine", "orb": i / 100}
        for i in range(assistant._SUMMARY_ASPECT_LIMIT + 1)
    ]
    positions = [{"name": str(i)} for i in range(assistant._SUMMARY_OBJECT_LIMIT + 1)]
    result = service._compact_progression_result(
        {"aspects_to_natal": aspects, "progressed_planets": positions}, "active_chart",
    )

    assert len(result["aspects_to_natal"]) == len(aspects)
    assert len(result["progressed_planets"]) == len(positions)


def test_natal_summary_renders_all_signs_degrees_houses_and_retrogrades(
    service, chart, monkeypatch,
):
    client = _FakeClient([
        _msg(tool_calls=[_tool_call("1", "get_chart_data", '{"facet":"natal_positions"}')]),
        _msg(content=""),
    ])
    monkeypatch.setattr(assistant, "is_openai_configured", lambda: True)
    monkeypatch.setattr(assistant, "get_openai_client", lambda: client)

    reply = service.chat(
        uuid4(), [{"role": "user", "content": "Give me a natal overview"}], locale="en",
    )["reply"]

    assert "**Natal placements**" in reply
    for planet in chart["planets"]:
        name = planet["name"] + (" R" if planet["retrograde"] else "")
        assert f"**{name}** — {planet['sign']} {planet['degree_in_sign_formatted']}, house {planet['house']}" in reply
    assert all(f"**{name} R**" in reply for name in ("Saturn", "Uranus", "Neptune"))


@pytest.mark.parametrize("args", [{}, {"target_date": "2026-11-21"}])
def test_annual_and_monthly_profections_on_the_synthetic_chart(service, args):
    result = service._dispatch("calculate_profections", args, uuid4())

    assert result["target_date"] == REFERENCE_DATE.isoformat()
    assert result["age"] == 33
    assert result["annual"] == {"house": 10, "sign": "Virgo", "lord": "Mercury"}
    assert result["monthly"] == {"house": 1, "sign": "Sagittarius", "lord": "Jupiter", "month_index": 4}


def test_profections_reject_a_malformed_date(service):
    result = service._dispatch("calculate_profections", {"target_date": "2026-11-31"}, uuid4())

    assert result == {"status": "error", "error": "bad_target_date"}


def test_natal_aspect_counts_need_one_tool_call_and_keep_raw_audit_fields(service, chart, monkeypatch):
    methodology = {
        "methodology_hash": "15b78c0af609" + "a" * 52,
        "resolved_settings": {"methodology_version": "15b78c0af609", "house_system": "P"},
    }
    client = _FakeClient([
        _msg(tool_calls=[_tool_call("1", "get_chart_data", '{"facet":"natal_aspects","summary_only":true}')]),
        _msg(content="Here are the natal aspect counts."),
    ])
    monkeypatch.setattr(assistant, "build_methodology_provenance", lambda *a: methodology)
    monkeypatch.setattr(assistant, "is_openai_configured", lambda: True)
    monkeypatch.setattr(assistant, "get_openai_client", lambda: client)

    result = service.chat(uuid4(), [
        {"role": "user", "content": "How many natal aspects are there? How many major and minor?"},
    ], locale="en")

    assert result["iterations"] == 2
    tool, = result["tool_results"]
    assert tool["name"] == "get_chart_data"
    data = tool["result"]["data"]
    summary = data["summary"]
    assert "aspects" not in data
    assert summary["total"] == len(chart["aspects"])
    assert summary["major"] + summary["minor"] == summary["total"]
    assert summary["natal_planets"] == len(chart["planets"])
    assert sum(summary["by_aspect"].values()) == summary["total"]
    assert result["methodology"] == methodology
    assert tool["result"]["provenance"]["methodology_hash"] == methodology["methodology_hash"]
    model_result = json.loads(client.chat.completions.calls[-1]["messages"][-1]["content"])
    assert model_result["provenance"] == {"resolved_settings": {"house_system": "P"}}


def test_empty_transit_window_never_ends_with_only_no_contacts(service, monkeypatch):
    args = {
        "start_date": "2026-11-21", "end_date": "2026-11-21",
        "profile": "outer_planets", "natal_targets": ["Sun"],
    }
    client = _FakeClient([
        _msg(tool_calls=[_tool_call("1", "survey_transits", json.dumps(args))]),
        _msg(content="No contacts. 0 contacts, 0 exact passes, 0 clusters, 0 simultaneous contacts."),
    ])
    monkeypatch.setattr(assistant, "is_openai_configured", lambda: True)
    monkeypatch.setattr(assistant, "get_openai_client", lambda: client)

    reply = service.chat(
        uuid4(), [{"role": "user", "content": "Outer-planet transits today only?"}], locale="en",
    )["reply"]

    assert "There are no contacts within your forecast orbs in the selected period." in reply
    assert "- Applying" in reply
    assert "- Separating" in reply
    assert "0 clusters" not in reply
