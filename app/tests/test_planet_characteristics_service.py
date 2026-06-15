from app.services.planet_characteristics_service import PlanetCharacteristicsService


def test_calculate_speed_percent_for_proserpina():
    PlanetCharacteristicsService.MEAN_SPEEDS = {}

    assert PlanetCharacteristicsService.calculate_speed_percent("Proserpina", 0.00126) == 85.25
