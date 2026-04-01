from app.services.preferences_runtime import normalize_orb_settings


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
            "profiles": {
                "natal": {"matrix": {"Conjunction": {"Sun": 7.5}}},
                "prognostic": {"matrix": {"Conjunction": {"Sun": 4.5}}},
            },
        },
        default_orbs=default_orbs,
    )

    assert normalized["profiles"]["natal"]["matrix"]["Conjunction"]["Sun"] == 7.5
    assert normalized["profiles"]["prognostic"]["matrix"]["Conjunction"]["Sun"] == 4.5
