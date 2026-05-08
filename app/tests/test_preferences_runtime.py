import app.services.preferences_runtime as preferences_runtime_module
from app.services.preferences_runtime import (
    CANONICAL_BODIES,
    PreferencesRuntimeResolver,
    apply_fixed_prognostic_defaults,
    normalize_dignity_settings,
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


def test_build_default_visual_settings_uses_per_aspect_palette():
    aspect_types = [
        type("AspectType", (), {"aspect_type": "Conjunction", "character": "neutral"})(),
        type("AspectType", (), {"aspect_type": "Custom", "character": "tense"})(),
    ]

    visual = build_default_visual_settings(aspect_types)

    assert visual["aspect_colors"]["Conjunction"] == "#f59e0b"
    assert visual["aspect_colors"]["Custom"] == "#9ca3af"
    assert visual["planet_colors"]["element_palette"]["Fire"] == "#ef4444"
    assert visual["planet_colors"]["element_palette"]["Earth"] == "#84cc16"
    assert visual["planet_colors"]["element_palette"]["Air"] == "#f59e0b"
    assert visual["planet_colors"]["element_palette"]["Water"] == "#3b82f6"


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
        "stationary": {"threshold_percent": 10.0},
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


def test_normalize_methodology_settings_defaults_stationary_threshold_to_ten_percent():
    normalized = normalize_methodology_settings({})

    assert normalized["stationary"]["threshold_percent"] == 10.0


def test_normalize_methodology_settings_preserves_custom_stationary_threshold():
    normalized = normalize_methodology_settings({
        "stationary": {
            "threshold_percent": 7.5,
        },
    })

    assert normalized["stationary"]["threshold_percent"] == 7.5


def test_normalize_dignity_settings_merges_defaults_and_drops_duplicate_co_ruler():
    normalized = normalize_dignity_settings(
        {
            "signs": {
                "Aries": {"ruler": "Mars", "co_ruler": "Mars"},
                "Libra": {"ruler": "Venus", "exaltation": "Saturn"},
            },
        },
        default_dignities={
            "version": 1,
            "signs": {
                "Aries": {"ruler": "Mars", "co_ruler": None, "exaltation": "Sun"},
                "Libra": {"ruler": "Venus", "co_ruler": "Chiron", "exaltation": "Saturn"},
            },
        },
    )

    assert normalized["version"] == 1
    assert normalized["signs"]["Aries"]["ruler"] == "Mars"
    assert normalized["signs"]["Aries"]["co_ruler"] is None
    assert normalized["signs"]["Aries"]["exaltation"] == "Sun"
    assert normalized["signs"]["Libra"]["co_ruler"] == "Chiron"


def test_resolve_orb_for_astrologer_reuses_cached_normalized_orbs(monkeypatch):
    aspect_types = [
        "Conjunction",
        "Opposition",
    ]
    default_methodology = {
        "orbs": {
            "version": 2,
            "pair_strategy": "larger",
            "profiles": {
                "natal": {
                    "matrix": {
                        aspect_type: {body: 5.0 for body in CANONICAL_BODIES}
                        for aspect_type in aspect_types
                    },
                },
                "prognostic": {
                    "matrix": {
                        aspect_type: {body: (3.0 if body == "Moon" else 1.0) for body in CANONICAL_BODIES}
                        for aspect_type in aspect_types
                    },
                },
            },
        },
        "balances": {"version": 1, "planet_weights": {}, "special_point_weights": {}},
        "stationary": {"threshold_percent": 10.0},
    }
    payload = {"methodology": default_methodology}
    astrologer_id = "astrologer-1"

    class DummyResolver(PreferencesRuntimeResolver):
        def __init__(self):
            super().__init__(db=None)
            self._default_methodology_cache = default_methodology

        def _get_cached_account_payload(self, astrologer_id, *, default_house_system="P"):
            return payload

    resolver = DummyResolver()
    original_normalize = preferences_runtime_module.normalize_orb_settings
    calls = {"count": 0}

    def counting_normalize(*args, **kwargs):
        calls["count"] += 1
        return original_normalize(*args, **kwargs)

    monkeypatch.setattr(preferences_runtime_module, "normalize_orb_settings", counting_normalize)

    first = resolver.resolve_orb_for_astrologer(
        astrologer_id,
        "Sun",
        "Moon",
        "Conjunction",
        orb_profile="prognostic",
    )
    second = resolver.resolve_orb_for_astrologer(
        astrologer_id,
        "Mars",
        "Moon",
        "Opposition",
        orb_profile="prognostic",
    )

    assert first == 3.0
    assert second == 3.0
    assert calls["count"] == 1


def test_invalidate_clears_cached_normalized_orbs(monkeypatch):
    default_methodology = {
        "orbs": {
            "version": 2,
            "pair_strategy": "larger",
            "profiles": {
                "natal": {"matrix": {"Conjunction": {"Sun": 5.0}}},
                "prognostic": {"matrix": {"Conjunction": {"Sun": 1.0}}},
            },
        },
        "balances": {"version": 1, "planet_weights": {}, "special_point_weights": {}},
        "stationary": {"threshold_percent": 10.0},
    }
    payload = {"methodology": default_methodology}
    astrologer_id = "astrologer-2"

    class DummyResolver(PreferencesRuntimeResolver):
        def __init__(self):
            super().__init__(db=None)
            self._default_methodology_cache = default_methodology

        def _get_cached_account_payload(self, astrologer_id, *, default_house_system="P"):
            return payload

    resolver = DummyResolver()
    original_normalize = preferences_runtime_module.normalize_orb_settings
    calls = {"count": 0}

    def counting_normalize(*args, **kwargs):
        calls["count"] += 1
        return original_normalize(*args, **kwargs)

    monkeypatch.setattr(preferences_runtime_module, "normalize_orb_settings", counting_normalize)

    resolver.resolve_orb_for_astrologer(astrologer_id, "Sun", "Sun", "Conjunction", orb_profile="prognostic")
    resolver.invalidate(astrologer_id)
    resolver.resolve_orb_for_astrologer(astrologer_id, "Sun", "Sun", "Conjunction", orb_profile="prognostic")

    assert calls["count"] == 2
