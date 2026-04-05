from app.services.preferences_runtime import (
    apply_fixed_prognostic_defaults,
    build_default_orb_settings,
    build_default_visual_settings,
    normalize_methodology_settings,
    normalize_orb_settings,
    resolve_orb_pair_value,
)


def test_normalize_orb_settings_expands_legacy_matrix_into_both_profiles():
    default_orbs = {
        "version": 2,
        "profiles": {
            "natal": {"matrix": {"Conjunction": {"Sun": 5.0}}},
            "prognostic": {"matrix": {"Conjunction": {"Sun": 5.0}}},
        },
    }

    normalized = normalize_orb_settings(
        {
            "version": 1,
            "matrix": {
                "Conjunction": {"Sun": 8.0},
            },
        },
        default_orbs=default_orbs,
    )

    assert normalized["version"] == 2
    assert normalized["pair_strategy"] == "larger"
    assert normalized["profiles"]["natal"]["matrix"]["Conjunction"]["Sun"] == 8.0
    assert normalized["profiles"]["prognostic"]["matrix"]["Conjunction"]["Sun"] == 8.0


def test_normalize_orb_settings_preserves_distinct_profiles():
    default_orbs = {
        "version": 2,
        "profiles": {
            "natal": {"matrix": {"Conjunction": {"Sun": 5.0}}},
            "prognostic": {"matrix": {"Conjunction": {"Sun": 5.0}}},
        },
    }

    normalized = normalize_orb_settings(
        {
            "version": 2,
            "pair_strategy": "average",
            "profiles": {
                "natal": {"matrix": {"Conjunction": {"Sun": 7.5}}},
                "prognostic": {"matrix": {"Conjunction": {"Sun": 4.5}}},
            },
        },
        default_orbs=default_orbs,
    )

    assert normalized["pair_strategy"] == "average"
    assert normalized["profiles"]["natal"]["matrix"]["Conjunction"]["Sun"] == 7.5
    assert normalized["profiles"]["prognostic"]["matrix"]["Conjunction"]["Sun"] == 4.5


def test_resolve_orb_pair_value_supports_all_strategies():
    assert resolve_orb_pair_value([8.0, 6.0], "larger") == 8.0
    assert resolve_orb_pair_value([8.0, 6.0], "smaller") == 6.0
    assert resolve_orb_pair_value([8.0, 6.0], "average") == 7.0
    assert resolve_orb_pair_value([8.0], "average") == 8.0


def test_build_default_visual_settings_includes_harmony_palette():
    aspect_types = [
        type("AspectType", (), {"aspect_type": "Conjunction", "character": "neutral"})(),
        type("AspectType", (), {"aspect_type": "Custom", "character": "tense"})(),
    ]

    visual = build_default_visual_settings(aspect_types)

    assert visual["aspect_harmony_colors"]["harmonious"] == "#3b82f6"
    assert visual["aspect_harmony_colors"]["tense"] == "#ef4444"
    assert visual["aspect_colors"]["Conjunction"] == "#f59e0b"
    assert visual["aspect_colors"]["Custom"] == "#ef4444"


def test_build_default_orb_settings_uses_fixed_prognostic_defaults():
    aspect_types = [
        type("AspectType", (), {"aspect_type": "Conjunction", "base_orb": 8.0})(),
        type("AspectType", (), {"aspect_type": "Square", "base_orb": 6.0})(),
    ]
    planet_orbs = [
        type("PlanetOrb", (), {"planet": "Sun", "aspect_type": "Conjunction", "orb": 12.0})(),
        type("PlanetOrb", (), {"planet": "Moon", "aspect_type": "Conjunction", "orb": 10.0})(),
    ]

    defaults = build_default_orb_settings(aspect_types, planet_orbs)

    assert defaults["profiles"]["natal"]["matrix"]["Conjunction"]["Sun"] == 12.0
    assert defaults["profiles"]["prognostic"]["matrix"]["Conjunction"]["Sun"] == 1.0
    assert defaults["profiles"]["prognostic"]["matrix"]["Conjunction"]["Moon"] == 3.0
    assert defaults["profiles"]["prognostic"]["matrix"]["Square"]["Moon"] == 3.0
    assert defaults["profiles"]["prognostic"]["matrix"]["Square"]["Mars"] == 1.0


def test_apply_fixed_prognostic_defaults_overwrites_existing_prognostic_profile_only():
    default_methodology = {
        "orbs": {
            "version": 2,
            "pair_strategy": "larger",
            "profiles": {
                "natal": {"matrix": {"Conjunction": {"Sun": 8.0, "Moon": 7.0}}},
                "prognostic": {"matrix": {"Conjunction": {"Sun": 1.0, "Moon": 3.0}}},
            },
        },
        "balances": {"version": 1, "planet_weights": {}, "special_point_weights": {}},
        "stationary": {"threshold_percent": 5.0},
    }

    updated = apply_fixed_prognostic_defaults(
        {
            "orbs": {
                "version": 2,
                "pair_strategy": "average",
                "profiles": {
                    "natal": {"matrix": {"Conjunction": {"Sun": 9.5, "Moon": 6.5}}},
                    "prognostic": {"matrix": {"Conjunction": {"Sun": 4.0, "Moon": 4.0}}},
                },
            },
            "stationary": {"threshold_percent": 7.5},
        },
        default_methodology=default_methodology,
    )

    assert updated["orbs"]["pair_strategy"] == "average"
    assert updated["orbs"]["profiles"]["natal"]["matrix"]["Conjunction"]["Sun"] == 9.5
    assert updated["orbs"]["profiles"]["prognostic"]["matrix"]["Conjunction"]["Sun"] == 1.0
    assert updated["orbs"]["profiles"]["prognostic"]["matrix"]["Conjunction"]["Moon"] == 3.0
    assert updated["stationary"]["threshold_percent"] == 7.5


def test_normalize_methodology_settings_defaults_stationary_threshold_to_five_percent():
    normalized = normalize_methodology_settings({})

    assert normalized["stationary"]["threshold_percent"] == 5.0


def test_normalize_methodology_settings_preserves_custom_stationary_threshold():
    normalized = normalize_methodology_settings({
        "stationary": {
            "threshold_percent": 7.5,
        },
    })

    assert normalized["stationary"]["threshold_percent"] == 7.5
