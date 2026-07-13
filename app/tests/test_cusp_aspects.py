from app.services.aspect_service import AspectService


def test_cusp_aspects_only_pair_objects_with_house_cusps(monkeypatch):
    service = object.__new__(AspectService)
    monkeypatch.setattr(service, "_get_aspect_types", lambda: [object()])

    seen_pairs = []

    def fake_calculate(obj, cusp, _aspect_types, **_kwargs):
        seen_pairs.append((obj["name"], cusp["name"]))
        return {
            "planet_1": obj["name"],
            "planet_2": cusp["name"],
            "aspect_type": "Conjunction",
            "orb": 0.5,
            "max_orb": 2.0,
            "is_major": True,
            "harmonic_type": "neutral",
        }

    monkeypatch.setattr(service, "_calculate_aspect_between", fake_calculate)

    aspects = service.calculate_aspects_to_house_cusps(
        [
            {"name": "Sun", "longitude": 10.0, "type": "planet"},
            {"name": "Cusp99", "longitude": 20.0, "type": "house_cusp"},
        ],
        [
            {"number": 1, "longitude": 10.5},
            {"number": 2, "longitude": 40.0},
        ],
    )

    assert seen_pairs == [("Sun", "Cusp1"), ("Sun", "Cusp2")]
    assert [aspect["cusp_house"] for aspect in aspects] == [1, 2]
    assert all(aspect["planet_2"].startswith("Cusp") for aspect in aspects)
