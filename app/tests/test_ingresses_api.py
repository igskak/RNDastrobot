import os
from datetime import date
from uuid import uuid4

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_ingresses_test.db")

from app.api.main import app  # noqa: E402
from app.services.period_ingress_summary_service import PeriodIngressSummaryService  # noqa: E402


def test_ingresses_period_summary_route(monkeypatch):
    expected = {
        "period_start": "2026-01-01",
        "period_end": "2026-01-03",
        "direction_type": "solar_arc",
        "rows": [
            {
                "object_key": "Sun",
                "object": "Sun",
                "method": "progressions",
                "method_class": "progression",
                "transition": "Aries / H1 -> Taurus / H2",
                "hover_lines": ["Sign: Aries -> Taurus | -1° x | 0° y | +1° z"],
                "hover_details": [
                    {
                        "ingress_type": "sign",
                        "from": "Aries",
                        "to": "Taurus",
                        "times": {"before": "x", "exact": "y", "after": "z"},
                        "text": "Sign: Aries -> Taurus | -1° x | 0° y | +1° z",
                    }
                ],
            }
        ],
        "meta": {"calc_version": "test", "cache_hit": False, "latency_ms": 1},
    }

    def _fake(self, user_id, start_date, end_date, timezone, direction_type):
        assert isinstance(user_id, type(uuid4()))
        assert start_date == date(2026, 1, 1)
        assert end_date == date(2026, 1, 3)
        assert timezone == "UTC"
        assert direction_type == "solar_arc"
        return expected

    monkeypatch.setattr(PeriodIngressSummaryService, "calculate_period_summary", _fake)

    client = TestClient(app)
    user_id = str(uuid4())
    response = client.post(
        "/api/v1/ingresses/period-summary",
        json={
            "user_id": user_id,
            "start_date": "2026-01-01",
            "end_date": "2026-01-03",
            "timezone": "UTC",
            "direction_type": "solar_arc",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["period_start"] == expected["period_start"]
    assert payload["period_end"] == expected["period_end"]
    assert payload["direction_type"] == expected["direction_type"]
    assert len(payload["rows"]) == 1
    assert payload["rows"][0]["object_key"] == "Sun"
