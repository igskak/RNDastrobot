from app.services.dominants_service import DominantsService


def _chart():
    return {
        "planets": [
            {"name": "Sun", "sign": "Aries", "house": 1},      # fire, cardinal, angular
            {"name": "Moon", "sign": "Leo", "house": 5},       # fire, fixed
            {"name": "Mercury", "sign": "Aries", "house": 1},  # fire, cardinal
            {"name": "Saturn", "sign": "Cancer", "house": 4},  # water, cardinal
        ],
        "angles": {
            "ASC": {"sign": "Aries"},
            "MC": {"sign": "Capricorn"},
        },
    }


def test_dominant_element_is_fire():
    res = DominantsService.compute(_chart())
    assert res["dominant"]["element"] == "fire"
    assert res["elements"][0]["key"] == "fire"


def test_dominant_sign_aries_from_planets_plus_asc():
    res = DominantsService.compute(_chart())
    # Sun(3)+Mercury(2)+ASC(2) = 7 for Aries — highest.
    assert res["dominant"]["sign"] == "Aries"


def test_planets_ranked_by_weight_and_angularity():
    res = DominantsService.compute(_chart())
    names = [p["key"] for p in res["planets"]]
    # Sun (3 + angular bonus 1 = 4) outranks the rest.
    assert names[0] == "Sun"
    assert "Saturn" in names


def test_strength_score_used_when_present():
    chart = {
        "planets": [
            {"name": "Pluto", "sign": "Scorpio", "house": 8, "strength_score": 40.0},
            {"name": "Sun", "sign": "Leo", "house": 10, "strength_score": 5.0},
        ],
        "angles": {},
    }
    res = DominantsService.compute(chart)
    assert res["dominant"]["planet"] == "Pluto"


def test_modes_and_houses_present():
    res = DominantsService.compute(_chart())
    assert res["dominant"]["mode"] in {"cardinal", "fixed", "mutable"}
    assert any(h["key"] == "1" for h in res["houses"])
