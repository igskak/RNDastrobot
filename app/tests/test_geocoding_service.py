from app.services import geocoding_service as geocoding_module
from app.services.geocoding_service import GeocodingService, _BoundedTTLCache


def _city_item(name: str, display: str, lat: float, lon: float, source_id: str):
    return {
        "short_name": name,
        "display_name": display,
        "lat": lat,
        "lon": lon,
        "importance": 0.5,
        "place_rank": 30.0,
        "source_id": source_id,
    }


def test_geocode_cache_hit_ignores_db_session_identity(monkeypatch):
    service = GeocodingService()
    calls = {"count": 0}

    def fake_autocomplete(query, limit=5, language="en", db_session=None):
        calls["count"] += 1
        return [_city_item("Testopolis", "Testopolis, QA", 10.0, 20.0, "db:1")]

    monkeypatch.setattr(service, "autocomplete", fake_autocomplete)

    result_1 = service.geocode("  Testopolis  ", db_session=object())
    result_2 = service.geocode("testopolis", db_session=object())

    assert result_1 == (10.0, 20.0, "Testopolis, QA")
    assert result_2 == result_1
    assert calls["count"] == 1


def test_geocode_cache_ttl_miss(monkeypatch):
    service = GeocodingService()
    service._geocode_cache = _BoundedTTLCache(maxsize=1000, ttl_seconds=1)
    calls = {"count": 0}
    now = [1000.0]

    def fake_time():
        return now[0]

    def fake_autocomplete(query, limit=5, language="en", db_session=None):
        calls["count"] += 1
        return [_city_item("A", "A, B", 1.0, 2.0, "db:1")]

    monkeypatch.setattr(geocoding_module.time, "time", fake_time)
    monkeypatch.setattr(service, "autocomplete", fake_autocomplete)

    service.geocode("A-town", db_session=object())
    now[0] += 2.0
    service.geocode("A-town", db_session=object())

    assert calls["count"] == 2


def test_autocomplete_cache_bounded_ttl_and_lru(monkeypatch):
    service = GeocodingService()
    service._autocomplete_cache = _BoundedTTLCache(maxsize=2, ttl_seconds=3600)
    now = [2000.0]
    fetch_calls = {"count": 0}

    monkeypatch.setattr(geocoding_module.time, "time", lambda: now[0])
    monkeypatch.setattr(service, "_city_cache_autocomplete", lambda query, limit, language: [])
    monkeypatch.setattr(service, "_autocomplete_local_db", lambda query, limit, language, db_session: [])
    monkeypatch.setattr(service, "_rate_limit", lambda: None)

    def fake_fetch_raw(query, limit, language):
        fetch_calls["count"] += 1
        return [
            {
                "lat": 50.45,
                "lon": 30.52,
                "importance": 0.9,
                "place_rank": 30,
                "osm_type": "R",
                "osm_id": 1,
                "class": "place",
                "type": "city",
                "display_name": f"{query}, Country",
                "address": {"city": query, "country": "Country"},
            }
        ]

    monkeypatch.setattr(service, "_fetch_raw", fake_fetch_raw)

    service.autocomplete("alpha", db_session=object())
    service.autocomplete("alpha", db_session=object())
    assert fetch_calls["count"] == 1

    service.autocomplete("beta", db_session=object())
    service.autocomplete("gamma", db_session=object())
    service.autocomplete("alpha", db_session=object())
    assert fetch_calls["count"] == 4


def test_autocomplete_deduplicates_and_is_stably_sorted(monkeypatch):
    service = GeocodingService()

    primary = [
        _city_item("Kyiv", "Kyiv, Ukraine", 50.4501, 30.5234, "cache:kyiv"),
        _city_item("Kyiv", "Kyiv, Ukraine", 50.4501, 30.5234, "cache:kyiv-dup"),
    ]
    local = [
        _city_item("Kyiv", "Kyiv, Ukraine", 50.4501, 30.5234, "db:kyiv"),
        _city_item("Kharkiv", "Kharkiv, Ukraine", 49.99, 36.23, "db:kharkiv"),
    ]

    monkeypatch.setattr(service, "_city_cache_autocomplete", lambda query, limit, language: list(primary))
    monkeypatch.setattr(service, "_autocomplete_local_db", lambda query, limit, language, db_session: list(local))

    first = service.autocomplete("ky", limit=10, language="en", db_session=object())
    second = service.autocomplete("ky", limit=10, language="en", db_session=object())

    assert [item["display_name"] for item in first] == [item["display_name"] for item in second]
    assert len([item for item in first if item["display_name"] == "Kyiv, Ukraine"]) == 1


def test_autocomplete_deduplicates_nearby_same_short_name(monkeypatch):
    service = GeocodingService()

    monkeypatch.setattr(service, "_city_cache_autocomplete", lambda query, limit, language: [
        _city_item("Харьков", "Харьков, Украина", 49.9935, 36.2304, "cache:kharkiv"),
    ])
    monkeypatch.setattr(service, "_autocomplete_local_db", lambda query, limit, language, db_session: [
        _city_item("Харьков", "Харьков, Kharkivs’ka Oblast’, Ukraine", 49.98177, 36.25475, "db:706483"),
    ])

    items = service.autocomplete("харь", limit=5, language="ru", db_session=object())

    assert len(items) == 1
    assert items[0]["short_name"] == "Харьков"


def test_city_cache_localizes_kyiv_for_ru_uk_en():
    service = GeocodingService()

    ru = service.autocomplete("киев", language="ru")
    uk = service.autocomplete("київ", language="uk")
    en = service.autocomplete("kyiv", language="en")

    assert ru[0]["short_name"] == "Киев"
    assert ru[0]["display_name"] == "Киев, Украина"
    assert uk[0]["short_name"] == "Київ"
    assert uk[0]["display_name"] == "Київ, Україна"
    assert en[0]["short_name"] == "Kyiv"
    assert en[0]["display_name"] == "Kyiv, Ukraine"


def test_split_alternate_names_keeps_entries_after_40th_position():
    names = [f"name{i}" for i in range(45)] + ["Бухарест"] + [f"name{i}" for i in range(46, 60)]
    raw = ",".join(names)

    out = GeocodingService._split_alternate_names(raw)

    assert "Бухарест" in out
