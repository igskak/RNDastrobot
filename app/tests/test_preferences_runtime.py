from app.services.preferences_runtime import normalize_orb_settings, resolve_orb_pair_value


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
