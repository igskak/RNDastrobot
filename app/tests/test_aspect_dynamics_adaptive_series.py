from datetime import date, time
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.routes.transits import AspectDynamicsRequest
from app.services.aspect_dynamics_service import AspectDynamicsService


def build_series(provider, *, max_points=320, required_jds=None, body="Pluto"):
    service = AspectDynamicsService.__new__(AspectDynamicsService)
    return service._build_series(
        2450000.0,
        2450010.0,
        "UTC",
        provider,
        0.0,
        8.0,
        0.0,
        max_points,
        source_body=body,
        required_jds=required_jds,
    )


def test_linear_series_stays_below_budget():
    series = build_series(lambda jd: (jd - 2450000.0, 0.0), max_points=320)
    assert len(series) == 65
    assert len(series) < 320


def test_curvature_and_direction_change_add_detail_without_exceeding_budget():
    def provider(jd):
        x = jd - 2450005.0
        return (4.0 * x * x, 0.0)

    series = build_series(provider, max_points=180, body="Moon")
    assert 65 < len(series) <= 180
    closest = min(series, key=lambda point: abs(point["julian_day"] - 2450005.0))
    assert closest["abs_orb"] == pytest.approx(0.0, abs=1e-4)


def test_required_points_are_sorted_deduplicated_and_preserved():
    required = [2450001.25, 2450005.5, 2450005.5, 2450008.75]
    series = build_series(
        lambda jd: (jd - 2450000.0, 0.0),
        max_points=120,
        required_jds=required,
    )
    jds = [point["julian_day"] for point in series]
    assert jds == sorted(set(jds))
    assert set(required).issubset(jds)
    assert len(series) <= 120


def request_payload(**overrides):
    return {
        "user_id": uuid4(),
        "transit_body": "Mars",
        "natal_body": "Sun",
        "aspect_type": "Square",
        "selected_date": date(2026, 1, 1),
        "selected_time": time(12, 0),
        "timezone": "UTC",
        **overrides,
    }


def test_api_accepts_1200_points_and_keeps_default():
    assert AspectDynamicsRequest(**request_payload()).max_points == 320
    assert AspectDynamicsRequest(**request_payload(max_points=1200)).max_points == 1200


def test_api_rejects_more_than_1200_points():
    with pytest.raises(ValidationError):
        AspectDynamicsRequest(**request_payload(max_points=1201))
