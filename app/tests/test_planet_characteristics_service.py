from app.services.planet_characteristics_service import PlanetCharacteristicsService


def test_calculate_speed_percent_for_proserpina():
    PlanetCharacteristicsService.MEAN_SPEEDS = {}

    assert PlanetCharacteristicsService.calculate_speed_percent("Proserpina", 0.00126) == 85.25


def test_solar_phase_oriental_when_behind_sun():
    # Планета позади Солнца (меньшая долгота) → восходит раньше → ориентальная.
    phase = PlanetCharacteristicsService.calculate_solar_phase("Venus", 100.0, 130.0)
    assert phase == "oriental"


def test_solar_phase_occidental_when_ahead_of_sun():
    # Планета впереди Солнца → садится позже → окцидентальная.
    phase = PlanetCharacteristicsService.calculate_solar_phase("Mercury", 160.0, 130.0)
    assert phase == "occidental"


def test_solar_phase_handles_wraparound_at_zero_aries():
    # Солнце 350°, планета 10° → планета на 20° впереди (через 0° Овна) → окцидентальная.
    assert PlanetCharacteristicsService.calculate_solar_phase("Mars", 10.0, 350.0) == "occidental"
    # Солнце 10°, планета 350° → планета на 20° позади → ориентальная.
    assert PlanetCharacteristicsService.calculate_solar_phase("Mars", 350.0, 10.0) == "oriental"


def test_solar_phase_none_for_luminaries_and_conjunction():
    assert PlanetCharacteristicsService.calculate_solar_phase("Sun", 100.0, 100.0) is None
    assert PlanetCharacteristicsService.calculate_solar_phase("Moon", 120.0, 130.0) is None
    assert PlanetCharacteristicsService.calculate_solar_phase("Jupiter", 130.0, 130.0) is None


def test_enrich_planets_sets_solar_phase():
    planets = [
        {"name": "Sun", "longitude": 130.0, "sign": "Leo", "degree_in_sign": 10.0, "speed": 1.0},
        {"name": "Mercury", "longitude": 160.0, "sign": "Virgo", "degree_in_sign": 10.0, "speed": 1.2},
        {"name": "Venus", "longitude": 100.0, "sign": "Cancer", "degree_in_sign": 10.0, "speed": 1.1},
    ]
    enriched = PlanetCharacteristicsService.enrich_planets(planets)
    by_name = {p["name"]: p for p in enriched}
    assert by_name["Sun"]["solar_phase"] is None
    assert by_name["Mercury"]["solar_phase"] == "occidental"
    assert by_name["Venus"]["solar_phase"] == "oriental"
