import threading
import time
from datetime import date
from uuid import uuid4

from app.services.period_ingress_summary_service import (
    NAIBOD_KEY,
    PeriodIngressSummaryService,
    _NatalContext,
)


def _fake_context(user_id):
    return _NatalContext(
        user_id=user_id,
        birth_jd=2448000.5,
        birth_date=date(1990, 1, 1),
        lat=50.45,
        lon=30.52,
        natal_planets={"Sun": 10.0},
        natal_special_points={"TrueNorthNode": 200.0},
        natal_houses=[{"number": i, "longitude": (i - 1) * 30.0} for i in range(1, 13)],
        natal_hash="natal_hash_1",
    )


def setup_function(_):
    PeriodIngressSummaryService._cache.clear()
    PeriodIngressSummaryService._in_flight.clear()


def test_period_summary_cache_hit(monkeypatch):
    service = PeriodIngressSummaryService()
    user_id = uuid4()

    calls = {"count": 0}

    monkeypatch.setattr(service, "_load_natal_context", lambda uid: _fake_context(uid))

    def _calc(**kwargs):
        calls["count"] += 1
        return {
            "period_start": kwargs["start_date"].isoformat(),
            "period_end": kwargs["end_date"].isoformat(),
            "direction_type": kwargs["direction_type"],
            "rows": [],
            "meta": {"calc_version": PeriodIngressSummaryService.CALC_VERSION},
        }

    monkeypatch.setattr(service, "_calculate_uncached", _calc)

    result1 = service.calculate_period_summary(user_id, date(2026, 1, 1), date(2026, 1, 3), "UTC", "solar_arc")
    result2 = service.calculate_period_summary(user_id, date(2026, 1, 1), date(2026, 1, 3), "UTC", "solar_arc")

    assert calls["count"] == 1
    assert result1["meta"]["cache_hit"] is False
    assert result2["meta"]["cache_hit"] is True


def test_period_summary_deduplicates_parallel_requests(monkeypatch):
    service = PeriodIngressSummaryService()
    user_id = uuid4()

    calls = {"count": 0}

    monkeypatch.setattr(service, "_load_natal_context", lambda uid: _fake_context(uid))

    def _calc(**kwargs):
        calls["count"] += 1
        time.sleep(0.15)
        return {
            "period_start": kwargs["start_date"].isoformat(),
            "period_end": kwargs["end_date"].isoformat(),
            "direction_type": kwargs["direction_type"],
            "rows": [],
            "meta": {"calc_version": PeriodIngressSummaryService.CALC_VERSION},
        }

    monkeypatch.setattr(service, "_calculate_uncached", _calc)

    results = []

    def _run():
        payload = service.calculate_period_summary(
            user_id,
            date(2026, 2, 1),
            date(2026, 2, 10),
            "UTC",
            "solar_arc",
        )
        results.append(payload)

    t1 = threading.Thread(target=_run)
    t2 = threading.Thread(target=_run)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert len(results) == 2
    assert calls["count"] == 1


def test_sort_priority_matches_required_order():
    assert PeriodIngressSummaryService._object_sort_priority("Sun") < PeriodIngressSummaryService._object_sort_priority("Moon")
    assert PeriodIngressSummaryService._object_sort_priority("Pluto") < PeriodIngressSummaryService._object_sort_priority("TrueNorthNode")
    assert PeriodIngressSummaryService._object_sort_priority("TrueNorthNode") < PeriodIngressSummaryService._object_sort_priority("Cusp1")
    assert PeriodIngressSummaryService._object_sort_priority("Cusp1") < PeriodIngressSummaryService._object_sort_priority("Cusp12")


def test_direction_type_normalization_uses_zodiacal_default_and_alias():
    assert PeriodIngressSummaryService._normalize_direction_type("") == "zodiacal"
    assert PeriodIngressSummaryService._normalize_direction_type("symbolic") == "zodiacal"
    assert PeriodIngressSummaryService._normalize_direction_type("solar_arc") == "solar_arc"


def test_period_summary_naibod_arc_uses_key_once():
    age_years = 57.56180581785621

    arc = PeriodIngressSummaryService._calculate_direction_arc("equatorial", 0, age_years)

    assert arc == age_years * NAIBOD_KEY
    assert arc < age_years
