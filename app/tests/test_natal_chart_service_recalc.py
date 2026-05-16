from types import SimpleNamespace

import app.services.aspect_service as aspect_service_module
import app.services.balance_service as balance_service_module
import app.services.configuration_service as configuration_service_module
import app.services.cosmogram_service as cosmogram_service_module
import app.services.general_overview_service as general_overview_service_module
import app.services.planet_strength_service as planet_strength_service_module
import app.services.special_roles_service as special_roles_service_module
from app.services import natal_chart_service as natal_chart_service_module
from app.models.schemas import HousePosition


def test_persist_chart_for_user_uses_users_astrologer_id_for_dignity_service(monkeypatch):
    captured = {}

    class DummyRepo:
        def __init__(self, db_session):
            self.db_session = db_session

        def save_full_natal_chart(self, **kwargs):
            captured["saved"] = kwargs

    class DummyDependency:
        def __init__(self, *args, **kwargs):
            pass

        def calculate_aspects(self, *args, **kwargs):
            return None

        def detect_configurations(self, *args, **kwargs):
            return None

        def detect_stelliums(self, *args, **kwargs):
            return None

        def analyze_distribution(self, *args, **kwargs):
            return None

        def determine_jones_pattern(self, *args, **kwargs):
            return None

        def calculate_all_strengths(self, *args, **kwargs):
            return None

        def determine_all_roles(self, *args, **kwargs):
            return None

        def calculate_all_balances(self, *args, **kwargs):
            return None

        def build_general_overview(self, *args, **kwargs):
            return None

    class DummyDignityService:
        def __init__(self, db_session=None, astrologer_id=None):
            captured["dignity_astrologer_id"] = astrologer_id

    monkeypatch.setattr(natal_chart_service_module, "NatalChartRepository", DummyRepo)
    monkeypatch.setattr(natal_chart_service_module, "DignityService", DummyDignityService)
    monkeypatch.setattr(aspect_service_module, "AspectService", DummyDependency)
    monkeypatch.setattr(configuration_service_module, "ConfigurationService", DummyDependency)
    monkeypatch.setattr(cosmogram_service_module, "CosmogramService", DummyDependency)
    monkeypatch.setattr(planet_strength_service_module, "PlanetStrengthService", DummyDependency)
    monkeypatch.setattr(special_roles_service_module, "SpecialRolesService", DummyDependency)
    monkeypatch.setattr(balance_service_module, "BalanceService", DummyDependency)
    monkeypatch.setattr(general_overview_service_module, "GeneralOverviewService", DummyDependency)

    service = natal_chart_service_module.NatalChartService()
    service._enrich_houses_with_properties = lambda houses, db_session, astrologer_id=None: houses
    service._enrich_planets_with_properties = lambda planets, houses, aspects, db_session, astrologer_id=None, angles=None, special_points=None: planets
    service._enrich_house_planet_relations = lambda planets, houses: (planets, houses)
    service._attach_house_ruler_groups = lambda houses, planets, dignity_service: houses
    service._update_planet_aspect_characteristics = lambda user_id, db_session: None

    user = SimpleNamespace(user_id="user-1", astrologer_id="astrologer-123")

    returned_user_id = service._persist_chart_for_user(
        db_session=object(),
        user=user,
        planets=[],
        houses=[],
        angles={},
        special_points={},
        configurations={},
    )

    assert returned_user_id == "user-1"
    assert captured["dignity_astrologer_id"] == "astrologer-123"


def test_attach_house_ruler_groups_clears_stale_legacy_rulers():
    class DummyDignityService:
        def get_house_ruler(self, sign_name):
            return None if sign_name == "Scorpio" else "Mars"

        def get_sign_co_ruler(self, sign_name):
            return None

    service = natal_chart_service_module.NatalChartService()
    houses = [{
        "number": 6,
        "sign": "Scorpio",
        "longitude": 228.3,
        "ruler_planet": "Pluto",
        "ruler_in_house": 5,
        "co_rulers": ["Mars"],
    }]
    planets = [
        {"name": "Pluto", "house": 5},
        {"name": "Mars", "house": 12},
    ]

    [house] = service._attach_house_ruler_groups(houses, planets, DummyDignityService())

    assert house["ruler_planet"] is None
    assert house["ruler_in_house"] is None
    assert house["co_rulers"] == []
    assert house["ruler_groups"] == []


def test_house_position_api_model_preserves_ruler_groups():
    house = HousePosition(
        number=6,
        longitude=228.3,
        sign="Scorpio",
        degree_in_sign=18.3,
        ruler_groups=[{
            "scope": "cusp",
            "sign": "Scorpio",
            "entries": [{"planet": "Mars", "role": "secondary", "house": 12}],
        }],
    )

    assert house.model_dump()["ruler_groups"] == [{
        "scope": "cusp",
        "sign": "Scorpio",
        "entries": [{"planet": "Mars", "role": "secondary", "house": 12}],
    }]
