from app.services.karmic_analysis_service import KarmicAnalysisService


def _base_chart_data():
    return {
        "planets": [
            {
                "name": "Sun",
                "house": 1,
                "sign": "Aries",
                "dignity": "domicile",
                "special_roles": [],
                "karmic_plus_score": 4,
                "karmic_minus_score": 0,
                "karmic_score": 5.0,
            },
            {
                "name": "Moon",
                "house": 2,
                "sign": "Taurus",
                "dignity": "exaltation",
                "special_roles": ["charioteer"],
                "karmic_plus_score": 1,
                "karmic_minus_score": 4,
                "karmic_score": -5.0,
            },
            {
                "name": "Mercury",
                "house": 3,
                "sign": "Gemini",
                "dignity": "domicile",
                "special_roles": [],
                "karmic_plus_score": 0,
                "karmic_minus_score": 0,
                "karmic_score": 1.0,
            },
            {
                "name": "Venus",
                "house": 4,
                "sign": "Libra",
                "dignity": "domicile",
                "special_roles": ["doryphoros"],
                "karmic_plus_score": 0,
                "karmic_minus_score": 3,
                "karmic_score": 5.0,
            },
            {
                "name": "Mars",
                "house": 5,
                "sign": "Capricorn",
                "dignity": "exaltation",
                "special_roles": [],
                "karmic_plus_score": 3,
                "karmic_minus_score": 0,
                "karmic_score": 2.0,
            },
            {
                "name": "Jupiter",
                "house": 6,
                "sign": "Sagittarius",
                "dignity": "domicile",
                "special_roles": [],
                "karmic_plus_score": 0,
                "karmic_minus_score": 0,
                "karmic_score": 0.5,
            },
            {
                "name": "Saturn",
                "house": 7,
                "sign": "Libra",
                "dignity": "exaltation",
                "special_roles": [],
                "karmic_plus_score": 0,
                "karmic_minus_score": 0,
                "karmic_score": -1.0,
            },
        ],
        "special_points": {
            "TrueNorthNode": {"sign": "Aries", "house": 10},
            "TrueSouthNode": {"sign": "Libra", "house": 4},
            "BlackMoon": {"sign": "Scorpio", "house": 8},
            "WhiteMoon": {"sign": "Pisces", "house": 12},
        },
        "aspects": [
            {"planet_1": "Sun", "planet_2": "TrueNorthNode", "aspect_type": "Conjunction", "orb": 2.0, "is_major": True},
            {"planet_1": "Mercury", "planet_2": "TrueNorthNode", "aspect_type": "Conjunction", "orb": 3.5, "is_major": True},
            {"planet_1": "Venus", "planet_2": "TrueNorthNode", "aspect_type": "Trine", "orb": 1.0, "is_major": True},
            {"planet_1": "Mars", "planet_2": "TrueNorthNode", "aspect_type": "Sextile", "orb": 2.0, "is_major": True},
            {"planet_1": "Saturn", "planet_2": "TrueNorthNode", "aspect_type": "Square", "orb": 1.5, "is_major": True},
            {"planet_1": "Moon", "planet_2": "TrueNorthNode", "aspect_type": "Opposition", "orb": 2.0, "is_major": True},
            {"planet_1": "ASC", "planet_2": "TrueNorthNode", "aspect_type": "Conjunction", "orb": 1.0, "is_major": True},
            {"planet_1": "Jupiter", "planet_2": "Saturn", "aspect_type": "Sextile", "orb": 0.8, "is_major": True},
            {"planet_1": "Sun", "planet_2": "Saturn", "aspect_type": "Square", "orb": 1.2, "is_major": True},
            {"planet_1": "Sun", "planet_2": "BlackMoon", "aspect_type": "Conjunction", "orb": 1.0, "is_major": True},
            {"planet_1": "Moon", "planet_2": "BlackMoon", "aspect_type": "Square", "orb": 2.0, "is_major": True},
            {"planet_1": "Venus", "planet_2": "BlackMoon", "aspect_type": "Quincunx", "orb": 1.0, "is_major": False},
            {"planet_1": "Mars", "planet_2": "WhiteMoon", "aspect_type": "Trine", "orb": 2.0, "is_major": True},
            {"planet_1": "Sun", "planet_2": "Venus", "aspect_type": "Trine", "orb": 1.1, "is_major": True},
            {"planet_1": "Sun", "planet_2": "Moon", "aspect_type": "Opposition", "orb": 2.2, "is_major": True},
            {"planet_1": "Mercury", "planet_2": "Jupiter", "aspect_type": "Square", "orb": 1.0, "is_major": True},
            {"planet_1": "ASC", "planet_2": "Sun", "aspect_type": "Trine", "orb": 0.5, "is_major": True},
        ],
        "stelliums": [
            {
                "type": "house",
                "house_number": 1,
                "sign": None,
                "planets": ["Sun", "Moon", "Mercury"],
                "count": 3,
                "strength_score": 5.0,
            }
        ],
        "cosmogram_pattern": {
            "pattern_type": "Bucket",
            "leading_planet": "Mercury",
            "handle_planet": "Moon",
        },
        "houses": [{"number": i} for i in range(1, 13)],
    }


def test_karmic_analysis_full_aggregation():
    service = KarmicAnalysisService()
    result = service.build(_base_chart_data())

    assert result["nodes"]["north_node"]["sign"] == "Aries"
    assert result["nodes"]["north_node"]["dispositor_planet"] == "Mars"
    assert result["nodes"]["north_node"]["conjunctions_orb3"] == ["Sun"]
    assert result["nodes"]["north_node"]["helper_planets"] == ["Mars", "Venus"]
    assert result["nodes"]["north_node"]["blocker_planets"] == ["Moon", "Saturn"]

    assert result["saturn_analysis"]["sign"] == "Libra"
    assert result["saturn_analysis"]["dispositor_planet"] == "Venus"
    assert result["saturn_analysis"]["helper_planets"] == ["Jupiter"]
    assert result["saturn_analysis"]["blocker_planets"] == ["Sun"]

    assert result["lunar_points_analysis"]["black_moon"]["dispositor_planet"] == "Pluto"
    assert result["lunar_points_analysis"]["black_moon"]["aspected_planets"] == ["Moon", "Sun"]
    assert result["lunar_points_analysis"]["white_moon"]["aspected_planets"] == ["Mars"]

    assert result["karmic_status"]["support_planets_plus_3"] == ["Mars", "Sun"]
    assert result["karmic_status"]["development_planets_minus_3"] == ["Moon", "Venus"]
    assert result["karmic_status"]["top_karmic_planets"] == ["Moon", "Sun", "Venus"]

    assert result["karmic_support"]["first_house_planets"] == ["Sun"]
    assert result["karmic_support"]["south_node_sign_dispositor"] == "Venus"
    assert result["karmic_support"]["charioteer_planet"] == "Moon"
    assert result["karmic_support"]["harmonic_trines"] == [
        {"planet_1": "Sun", "planet_2": "Venus", "aspect_type": "Trine", "orb": 1.1}
    ]
    assert result["karmic_support"]["stelliums"] == _base_chart_data()["stelliums"]

    assert result["karmic_development"]["north_node_sign_dispositor"] == "Mars"
    assert result["karmic_development"]["doryphoros_planet"] == "Venus"
    assert result["karmic_development"]["black_moon_dispositor"] == "Pluto"
    assert result["karmic_development"]["challenging_aspects"] == [
        {"planet_1": "Jupiter", "planet_2": "Mercury", "aspect_type": "Square", "orb": 1.0},
        {"planet_1": "Moon", "planet_2": "Sun", "aspect_type": "Opposition", "orb": 2.2},
        {"planet_1": "Saturn", "planet_2": "Sun", "aspect_type": "Square", "orb": 1.2},
    ]

    assert result["jones_pattern"] == {
        "type": "Bucket",
        "leading_planet": "Mercury",
        "handle_planet": "Moon",
    }


def test_top_karmic_planets_tie_break_deterministic():
    service = KarmicAnalysisService()
    chart_data = {
        "planets": [
            {"name": "Venus", "karmic_score": -4},
            {"name": "Moon", "karmic_score": 4},
            {"name": "Sun", "karmic_score": -4},
            {"name": "Mars", "karmic_score": 2},
        ],
        "special_points": {},
        "aspects": [],
        "stelliums": [],
        "cosmogram_pattern": {},
        "houses": [],
    }

    result = service.build(chart_data)
    assert result["karmic_status"]["top_karmic_planets"] == ["Moon", "Sun", "Venus"]


def test_karmic_analysis_returns_null_and_empty_defaults():
    service = KarmicAnalysisService()
    result = service.build(
        {
            "planets": [],
            "special_points": {},
            "aspects": [],
            "stelliums": None,
            "cosmogram_pattern": None,
            "houses": [],
        }
    )

    assert result["nodes"]["north_node"] == {
        "sign": None,
        "house": None,
        "dispositor_planet": None,
        "conjunctions_orb3": [],
        "helper_planets": [],
        "blocker_planets": [],
    }
    assert result["nodes"]["south_node"]["dispositor_planet"] is None
    assert result["saturn_analysis"] == {
        "sign": None,
        "house": None,
        "dispositor_planet": None,
        "helper_planets": [],
        "blocker_planets": [],
    }
    assert result["lunar_points_analysis"]["black_moon"]["aspected_planets"] == []
    assert result["karmic_status"] == {
        "support_planets_plus_3": [],
        "development_planets_minus_3": [],
        "top_karmic_planets": [],
    }
    assert result["karmic_support"]["stelliums"] == []
    assert result["karmic_development"]["challenging_aspects"] == []
    assert result["jones_pattern"] == {
        "type": None,
        "leading_planet": None,
        "handle_planet": None,
    }
