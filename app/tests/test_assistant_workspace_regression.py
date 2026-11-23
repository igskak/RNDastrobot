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
