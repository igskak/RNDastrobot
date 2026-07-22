from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.routes import places
from app.services.geocoding_service import GeocodingServiceError, GeocodingTimeoutError


def test_reverse_place_validates_coordinate_ranges():
    app = FastAPI()
    app.include_router(places.router, prefix="/api/v1")
    client = TestClient(app)

    assert client.get("/api/v1/places/reverse?lat=91&lon=30").status_code == 422
    assert client.get("/api/v1/places/reverse?lat=50&lon=-181").status_code == 422


def test_reverse_place_uses_requested_locale(monkeypatch):
    calls = {}

    def fake_reverse(lat, lon, language):
        calls.update(lat=lat, lon=lon, language=language)
        return {
            "short_name": "Kyiv",
            "display_name": "Kyiv, Ukraine",
            "lat": lat,
            "lon": lon,
            "source_id": None,
        }

    monkeypatch.setattr(places.geocoding_service, "reverse_geocode", fake_reverse)

    result = places.reverse_place(50.45, 30.52, "en", "ru")

    assert result["short_name"] == "Kyiv"
    assert calls == {"lat": 50.45, "lon": 30.52, "language": "en"}


def test_reverse_place_maps_service_errors(monkeypatch):
    def unavailable(*_args, **_kwargs):
        raise GeocodingServiceError("offline")

    monkeypatch.setattr(places.geocoding_service, "reverse_geocode", unavailable)

    try:
        places.reverse_place(50.45, 30.52, "en", None)
        raise AssertionError("Expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 503


def test_reverse_place_maps_timeouts(monkeypatch):
    def timeout(*_args, **_kwargs):
        raise GeocodingTimeoutError("slow")

    monkeypatch.setattr(places.geocoding_service, "reverse_geocode", timeout)

    try:
        places.reverse_place(50.45, 30.52, None, "uk-UA")
        raise AssertionError("Expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 408
