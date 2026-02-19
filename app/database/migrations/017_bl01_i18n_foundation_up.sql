-- ============================================================================
-- Migration: 017_bl01_i18n_foundation_up.sql
-- Description: BL-01 SQL Foundation for i18n reference tables and interpretation cache locale
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Helper for locale detection in existing mixed RU/EN seed content
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _bl01_detect_locale(input_text TEXT)
RETURNS VARCHAR(5)
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE
        -- Detect explicit Ukrainian markers first to avoid mapping UK content to RU.
        WHEN COALESCE(input_text, '') ~ '[ІіЇїЄєҐґ]' THEN 'uk'
        -- Explicit Russian-only markers.
        WHEN COALESCE(input_text, '') ~ '[ЁёЪъЫыЭэ]' THEN 'ru'
        -- Ambiguous Cyrillic fallback keeps historical RU/EN seed compatibility.
        WHEN COALESCE(input_text, '') ~ '[А-Яа-я]' THEN 'ru'
        ELSE 'en'
    END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Create *_i18n tables for localizable reference dictionaries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ref_sign_properties_i18n (
    sign VARCHAR(20) NOT NULL REFERENCES ref_sign_properties(sign) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    qualities TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sign, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_sign_properties_i18n_locale ON ref_sign_properties_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_sign_properties_i18n_sign ON ref_sign_properties_i18n(sign);

CREATE TABLE IF NOT EXISTS ref_house_meanings_i18n (
    house_number INTEGER NOT NULL REFERENCES ref_house_meanings(house_number) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    theme_keywords TEXT NOT NULL,
    extended_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (house_number, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_house_meanings_i18n_locale ON ref_house_meanings_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_house_meanings_i18n_house ON ref_house_meanings_i18n(house_number);

CREATE TABLE IF NOT EXISTS ref_aspect_types_i18n (
    aspect_type VARCHAR(30) NOT NULL REFERENCES ref_aspect_types(aspect_type) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (aspect_type, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_aspect_types_i18n_locale ON ref_aspect_types_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_aspect_types_i18n_aspect ON ref_aspect_types_i18n(aspect_type);

CREATE TABLE IF NOT EXISTS ref_cosmogram_patterns_i18n (
    pattern_type VARCHAR(30) NOT NULL REFERENCES ref_cosmogram_patterns(pattern_type) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    description TEXT,
    psychological_meaning TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pattern_type, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_cosmogram_patterns_i18n_locale ON ref_cosmogram_patterns_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_cosmogram_patterns_i18n_pattern ON ref_cosmogram_patterns_i18n(pattern_type);

CREATE TABLE IF NOT EXISTS ref_configuration_types_i18n (
    type VARCHAR(50) NOT NULL REFERENCES ref_configuration_types(type) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    description TEXT,
    interpretation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (type, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_configuration_types_i18n_locale ON ref_configuration_types_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_configuration_types_i18n_type ON ref_configuration_types_i18n(type);

CREATE TABLE IF NOT EXISTS ref_planet_psych_functions_i18n (
    planet VARCHAR(20) NOT NULL REFERENCES ref_planet_psych_functions(planet) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    function_core TEXT NOT NULL,
    function_extended TEXT,
    archetype VARCHAR(50),
    keywords_positive TEXT,
    keywords_shadow TEXT,
    low_level_manifestation TEXT,
    high_level_manifestation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_planet_psych_functions_i18n_locale ON ref_planet_psych_functions_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_planet_psych_functions_i18n_planet ON ref_planet_psych_functions_i18n(planet);

DO $$
BEGIN
    IF to_regclass('ref_planet_role_weights') IS NOT NULL THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS ref_planet_role_weights_i18n (
                role VARCHAR(30) NOT NULL REFERENCES ref_planet_role_weights(role) ON DELETE CASCADE,
                locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (role, locale)
            )
        $sql$;
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ref_planet_role_weights_i18n_locale ON ref_planet_role_weights_i18n(locale)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ref_planet_role_weights_i18n_role ON ref_planet_role_weights_i18n(role)';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS ref_planet_in_sign_psych_i18n (
    planet VARCHAR(20) NOT NULL,
    sign VARCHAR(20) NOT NULL,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    summary TEXT,
    detailed_description TEXT,
    strengths TEXT,
    risks TEXT,
    defense_mechanisms TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet, sign, locale),
    FOREIGN KEY (planet, sign)
        REFERENCES ref_planet_in_sign_psych(planet, sign)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ref_planet_in_sign_psych_i18n_locale ON ref_planet_in_sign_psych_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_planet_in_sign_psych_i18n_entity ON ref_planet_in_sign_psych_i18n(planet, sign);

CREATE TABLE IF NOT EXISTS ref_planet_in_house_psych_i18n (
    planet VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    summary TEXT,
    detailed_description TEXT,
    life_area_focus TEXT,
    inner_conflicts TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet, house_number, locale),
    FOREIGN KEY (planet, house_number)
        REFERENCES ref_planet_in_house_psych(planet, house_number)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ref_planet_in_house_psych_i18n_locale ON ref_planet_in_house_psych_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_planet_in_house_psych_i18n_entity ON ref_planet_in_house_psych_i18n(planet, house_number);

CREATE TABLE IF NOT EXISTS ref_aspect_psych_i18n (
    planet_1 VARCHAR(20) NOT NULL,
    planet_2 VARCHAR(20) NOT NULL,
    aspect_type VARCHAR(30) NOT NULL,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    role VARCHAR(50),
    summary TEXT,
    detailed_description TEXT,
    typical_patterns TEXT,
    shadow_scenarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet_1, planet_2, aspect_type, locale),
    FOREIGN KEY (planet_1, planet_2, aspect_type)
        REFERENCES ref_aspect_psych(planet_1, planet_2, aspect_type)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ref_aspect_psych_i18n_locale ON ref_aspect_psych_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_aspect_psych_i18n_entity ON ref_aspect_psych_i18n(planet_1, planet_2, aspect_type);

CREATE TABLE IF NOT EXISTS ref_chakra_mapping_i18n (
    planet VARCHAR(20) NOT NULL REFERENCES ref_chakra_mapping(planet) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    chakra_name VARCHAR(30) NOT NULL,
    function_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_chakra_mapping_i18n_locale ON ref_chakra_mapping_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_chakra_mapping_i18n_planet ON ref_chakra_mapping_i18n(planet);

CREATE TABLE IF NOT EXISTS ref_node_karma_i18n (
    node_type VARCHAR(10) NOT NULL,
    sign VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    karma_theme TEXT,
    detailed_description TEXT,
    talent_vector TEXT,
    task_vector TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (node_type, sign, house_number, locale),
    FOREIGN KEY (node_type, sign, house_number)
        REFERENCES ref_node_karma(node_type, sign, house_number)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ref_node_karma_i18n_locale ON ref_node_karma_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_node_karma_i18n_entity ON ref_node_karma_i18n(node_type, sign, house_number);

CREATE TABLE IF NOT EXISTS ref_saturn_karma_i18n (
    sign VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    summary TEXT,
    detailed_description TEXT,
    lesson_type VARCHAR(50),
    common_scenarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sign, house_number, locale),
    FOREIGN KEY (sign, house_number)
        REFERENCES ref_saturn_karma(sign, house_number)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ref_saturn_karma_i18n_locale ON ref_saturn_karma_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_saturn_karma_i18n_entity ON ref_saturn_karma_i18n(sign, house_number);

CREATE TABLE IF NOT EXISTS ref_lilith_karma_i18n (
    sign VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    shadow_theme TEXT,
    behavior_patterns TEXT,
    temptation_scenarios TEXT,
    recommended_work TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sign, house_number, locale),
    FOREIGN KEY (sign, house_number)
        REFERENCES ref_lilith_karma(sign, house_number)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ref_lilith_karma_i18n_locale ON ref_lilith_karma_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_lilith_karma_i18n_entity ON ref_lilith_karma_i18n(sign, house_number);

CREATE TABLE IF NOT EXISTS ref_selena_karma_i18n (
    sign VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    light_theme TEXT,
    support_scenarios TEXT,
    talent_activation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sign, house_number, locale),
    FOREIGN KEY (sign, house_number)
        REFERENCES ref_selena_karma(sign, house_number)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ref_selena_karma_i18n_locale ON ref_selena_karma_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_selena_karma_i18n_entity ON ref_selena_karma_i18n(sign, house_number);

CREATE TABLE IF NOT EXISTS ref_fortune_karma_i18n (
    house_number INTEGER NOT NULL REFERENCES ref_fortune_karma(house_number) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    summary TEXT,
    gain_type TEXT,
    risks_if_ignored TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (house_number, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_fortune_karma_i18n_locale ON ref_fortune_karma_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_fortune_karma_i18n_house ON ref_fortune_karma_i18n(house_number);

CREATE TABLE IF NOT EXISTS ref_fate_cross_karma_i18n (
    pattern_type VARCHAR(50) NOT NULL REFERENCES ref_fate_cross_karma(pattern_type) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    summary TEXT,
    karmic_tests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pattern_type, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_fate_cross_karma_i18n_locale ON ref_fate_cross_karma_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_fate_cross_karma_i18n_pattern ON ref_fate_cross_karma_i18n(pattern_type);

CREATE TABLE IF NOT EXISTS ref_karma_status_rules_i18n (
    rule_id UUID NOT NULL REFERENCES ref_karma_status_rules(rule_id) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rule_id, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_karma_status_rules_i18n_locale ON ref_karma_status_rules_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_karma_status_rules_i18n_rule ON ref_karma_status_rules_i18n(rule_id);

CREATE TABLE IF NOT EXISTS ref_topic_significators_i18n (
    topic_code VARCHAR(30) NOT NULL REFERENCES ref_topic_significators(topic_code) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (topic_code, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_topic_significators_i18n_locale ON ref_topic_significators_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_topic_significators_i18n_topic ON ref_topic_significators_i18n(topic_code);

CREATE TABLE IF NOT EXISTS ref_support_sources_i18n (
    source_code VARCHAR(50) NOT NULL REFERENCES ref_support_sources(source_code) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_code, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_support_sources_i18n_locale ON ref_support_sources_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_support_sources_i18n_source ON ref_support_sources_i18n(source_code);

CREATE TABLE IF NOT EXISTS ref_challenge_sources_i18n (
    source_code VARCHAR(50) NOT NULL REFERENCES ref_challenge_sources(source_code) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL CHECK (locale IN ('en', 'uk', 'ru')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_code, locale)
);
CREATE INDEX IF NOT EXISTS idx_ref_challenge_sources_i18n_locale ON ref_challenge_sources_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_ref_challenge_sources_i18n_source ON ref_challenge_sources_i18n(source_code);

-- ---------------------------------------------------------------------------
-- 2) Add locale dimension to interpretation cache tables
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS natal_interpretations
    ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'en';

UPDATE natal_interpretations
SET locale = 'en'
WHERE locale IS NULL OR locale = '';

ALTER TABLE natal_interpretations
    ALTER COLUMN locale SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_natal_interpretations_locale'
          AND conrelid = 'natal_interpretations'::regclass
    ) THEN
        ALTER TABLE natal_interpretations
            ADD CONSTRAINT ck_natal_interpretations_locale
            CHECK (locale IN ('en', 'uk', 'ru'));
    END IF;
END;
$$;

ALTER TABLE natal_interpretations
    DROP CONSTRAINT IF EXISTS natal_interpretations_pkey;

ALTER TABLE natal_interpretations
    ADD CONSTRAINT natal_interpretations_pkey
    PRIMARY KEY (user_id, interpretation_type, locale);

CREATE INDEX IF NOT EXISTS idx_interpretations_locale ON natal_interpretations(locale);

ALTER TABLE IF EXISTS prognostic_interpretations
    ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'en';

UPDATE prognostic_interpretations
SET locale = 'en'
WHERE locale IS NULL OR locale = '';

ALTER TABLE prognostic_interpretations
    ALTER COLUMN locale SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_prognostic_interpretations_locale'
          AND conrelid = 'prognostic_interpretations'::regclass
    ) THEN
        ALTER TABLE prognostic_interpretations
            ADD CONSTRAINT ck_prognostic_interpretations_locale
            CHECK (locale IN ('en', 'uk', 'ru'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_pi_locale ON prognostic_interpretations(locale);
CREATE INDEX IF NOT EXISTS idx_pi_user_method_locale ON prognostic_interpretations(user_id, method, locale);

-- ---------------------------------------------------------------------------
-- 3) Data migration: move existing RU/EN texts to *_i18n tables
-- ---------------------------------------------------------------------------

INSERT INTO ref_sign_properties_i18n (sign, locale, qualities, created_at)
SELECT
    sign,
    _bl01_detect_locale(qualities),
    qualities,
    created_at
FROM ref_sign_properties
WHERE qualities IS NOT NULL
ON CONFLICT (sign, locale) DO UPDATE SET
    qualities = EXCLUDED.qualities;

INSERT INTO ref_house_meanings_i18n (house_number, locale, theme_keywords, extended_description, created_at)
SELECT
    house_number,
    _bl01_detect_locale(concat_ws(' ', theme_keywords, extended_description)),
    theme_keywords,
    extended_description,
    created_at
FROM ref_house_meanings
ON CONFLICT (house_number, locale) DO UPDATE SET
    theme_keywords = EXCLUDED.theme_keywords,
    extended_description = EXCLUDED.extended_description;

INSERT INTO ref_aspect_types_i18n (aspect_type, locale, description, created_at)
SELECT
    aspect_type,
    _bl01_detect_locale(description),
    description,
    created_at
FROM ref_aspect_types
WHERE description IS NOT NULL
ON CONFLICT (aspect_type, locale) DO UPDATE SET
    description = EXCLUDED.description;

INSERT INTO ref_cosmogram_patterns_i18n (pattern_type, locale, description, psychological_meaning, created_at)
SELECT
    pattern_type,
    _bl01_detect_locale(concat_ws(' ', description, psychological_meaning)),
    description,
    psychological_meaning,
    created_at
FROM ref_cosmogram_patterns
ON CONFLICT (pattern_type, locale) DO UPDATE SET
    description = EXCLUDED.description,
    psychological_meaning = EXCLUDED.psychological_meaning;

INSERT INTO ref_configuration_types_i18n (type, locale, description, interpretation, created_at)
SELECT
    type,
    _bl01_detect_locale(concat_ws(' ', description, interpretation)),
    description,
    interpretation,
    created_at
FROM ref_configuration_types
ON CONFLICT (type, locale) DO UPDATE SET
    description = EXCLUDED.description,
    interpretation = EXCLUDED.interpretation;

INSERT INTO ref_planet_psych_functions_i18n (
    planet,
    locale,
    function_core,
    function_extended,
    archetype,
    keywords_positive,
    keywords_shadow,
    low_level_manifestation,
    high_level_manifestation
)
SELECT
    planet,
    _bl01_detect_locale(
        concat_ws(
            ' ',
            function_core,
            function_extended,
            archetype,
            keywords_positive,
            keywords_shadow,
            low_level_manifestation,
            high_level_manifestation
        )
    ),
    function_core,
    function_extended,
    archetype,
    keywords_positive,
    keywords_shadow,
    low_level_manifestation,
    high_level_manifestation
FROM ref_planet_psych_functions
ON CONFLICT (planet, locale) DO UPDATE SET
    function_core = EXCLUDED.function_core,
    function_extended = EXCLUDED.function_extended,
    archetype = EXCLUDED.archetype,
    keywords_positive = EXCLUDED.keywords_positive,
    keywords_shadow = EXCLUDED.keywords_shadow,
    low_level_manifestation = EXCLUDED.low_level_manifestation,
    high_level_manifestation = EXCLUDED.high_level_manifestation;

DO $$
BEGIN
    IF to_regclass('ref_planet_role_weights') IS NOT NULL THEN
        INSERT INTO ref_planet_role_weights_i18n (role, locale, name, description, created_at)
        SELECT
            role,
            _bl01_detect_locale(concat_ws(' ', name, description)),
            name,
            description,
            created_at
        FROM ref_planet_role_weights
        ON CONFLICT (role, locale) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description;
    END IF;
END;
$$;

INSERT INTO ref_planet_in_sign_psych_i18n (
    planet,
    sign,
    locale,
    summary,
    detailed_description,
    strengths,
    risks,
    defense_mechanisms
)
SELECT
    planet,
    sign,
    _bl01_detect_locale(concat_ws(' ', summary, detailed_description, strengths, risks, defense_mechanisms)),
    summary,
    detailed_description,
    strengths,
    risks,
    defense_mechanisms
FROM ref_planet_in_sign_psych
ON CONFLICT (planet, sign, locale) DO UPDATE SET
    summary = EXCLUDED.summary,
    detailed_description = EXCLUDED.detailed_description,
    strengths = EXCLUDED.strengths,
    risks = EXCLUDED.risks,
    defense_mechanisms = EXCLUDED.defense_mechanisms;

INSERT INTO ref_planet_in_house_psych_i18n (
    planet,
    house_number,
    locale,
    summary,
    detailed_description,
    life_area_focus,
    inner_conflicts
)
SELECT
    planet,
    house_number,
    _bl01_detect_locale(concat_ws(' ', summary, detailed_description, life_area_focus, inner_conflicts)),
    summary,
    detailed_description,
    life_area_focus,
    inner_conflicts
FROM ref_planet_in_house_psych
ON CONFLICT (planet, house_number, locale) DO UPDATE SET
    summary = EXCLUDED.summary,
    detailed_description = EXCLUDED.detailed_description,
    life_area_focus = EXCLUDED.life_area_focus,
    inner_conflicts = EXCLUDED.inner_conflicts;

INSERT INTO ref_aspect_psych_i18n (
    planet_1,
    planet_2,
    aspect_type,
    locale,
    role,
    summary,
    detailed_description,
    typical_patterns,
    shadow_scenarios
)
SELECT
    planet_1,
    planet_2,
    aspect_type,
    _bl01_detect_locale(concat_ws(' ', role, summary, detailed_description, typical_patterns, shadow_scenarios)),
    role,
    summary,
    detailed_description,
    typical_patterns,
    shadow_scenarios
FROM ref_aspect_psych
ON CONFLICT (planet_1, planet_2, aspect_type, locale) DO UPDATE SET
    role = EXCLUDED.role,
    summary = EXCLUDED.summary,
    detailed_description = EXCLUDED.detailed_description,
    typical_patterns = EXCLUDED.typical_patterns,
    shadow_scenarios = EXCLUDED.shadow_scenarios;

INSERT INTO ref_chakra_mapping_i18n (planet, locale, chakra_name, function_description, created_at)
SELECT
    planet,
    _bl01_detect_locale(concat_ws(' ', chakra_name, function_description)),
    chakra_name,
    function_description,
    created_at
FROM ref_chakra_mapping
ON CONFLICT (planet, locale) DO UPDATE SET
    chakra_name = EXCLUDED.chakra_name,
    function_description = EXCLUDED.function_description;

INSERT INTO ref_node_karma_i18n (
    node_type,
    sign,
    house_number,
    locale,
    karma_theme,
    detailed_description,
    talent_vector,
    task_vector,
    created_at
)
SELECT
    node_type,
    sign,
    house_number,
    _bl01_detect_locale(concat_ws(' ', karma_theme, detailed_description, talent_vector, task_vector)),
    karma_theme,
    detailed_description,
    talent_vector,
    task_vector,
    created_at
FROM ref_node_karma
ON CONFLICT (node_type, sign, house_number, locale) DO UPDATE SET
    karma_theme = EXCLUDED.karma_theme,
    detailed_description = EXCLUDED.detailed_description,
    talent_vector = EXCLUDED.talent_vector,
    task_vector = EXCLUDED.task_vector;

INSERT INTO ref_saturn_karma_i18n (
    sign,
    house_number,
    locale,
    summary,
    detailed_description,
    lesson_type,
    common_scenarios,
    created_at
)
SELECT
    sign,
    house_number,
    _bl01_detect_locale(concat_ws(' ', summary, detailed_description, lesson_type, common_scenarios)),
    summary,
    detailed_description,
    lesson_type,
    common_scenarios,
    created_at
FROM ref_saturn_karma
ON CONFLICT (sign, house_number, locale) DO UPDATE SET
    summary = EXCLUDED.summary,
    detailed_description = EXCLUDED.detailed_description,
    lesson_type = EXCLUDED.lesson_type,
    common_scenarios = EXCLUDED.common_scenarios;

INSERT INTO ref_lilith_karma_i18n (
    sign,
    house_number,
    locale,
    shadow_theme,
    behavior_patterns,
    temptation_scenarios,
    recommended_work,
    created_at
)
SELECT
    sign,
    house_number,
    _bl01_detect_locale(concat_ws(' ', shadow_theme, behavior_patterns, temptation_scenarios, recommended_work)),
    shadow_theme,
    behavior_patterns,
    temptation_scenarios,
    recommended_work,
    created_at
FROM ref_lilith_karma
ON CONFLICT (sign, house_number, locale) DO UPDATE SET
    shadow_theme = EXCLUDED.shadow_theme,
    behavior_patterns = EXCLUDED.behavior_patterns,
    temptation_scenarios = EXCLUDED.temptation_scenarios,
    recommended_work = EXCLUDED.recommended_work;

INSERT INTO ref_selena_karma_i18n (
    sign,
    house_number,
    locale,
    light_theme,
    support_scenarios,
    talent_activation,
    created_at
)
SELECT
    sign,
    house_number,
    _bl01_detect_locale(concat_ws(' ', light_theme, support_scenarios, talent_activation)),
    light_theme,
    support_scenarios,
    talent_activation,
    created_at
FROM ref_selena_karma
ON CONFLICT (sign, house_number, locale) DO UPDATE SET
    light_theme = EXCLUDED.light_theme,
    support_scenarios = EXCLUDED.support_scenarios,
    talent_activation = EXCLUDED.talent_activation;

INSERT INTO ref_fortune_karma_i18n (
    house_number,
    locale,
    summary,
    gain_type,
    risks_if_ignored,
    created_at
)
SELECT
    house_number,
    _bl01_detect_locale(concat_ws(' ', summary, gain_type, risks_if_ignored)),
    summary,
    gain_type,
    risks_if_ignored,
    created_at
FROM ref_fortune_karma
ON CONFLICT (house_number, locale) DO UPDATE SET
    summary = EXCLUDED.summary,
    gain_type = EXCLUDED.gain_type,
    risks_if_ignored = EXCLUDED.risks_if_ignored;

INSERT INTO ref_fate_cross_karma_i18n (
    pattern_type,
    locale,
    summary,
    karmic_tests,
    created_at
)
SELECT
    pattern_type,
    _bl01_detect_locale(concat_ws(' ', summary, karmic_tests)),
    summary,
    karmic_tests,
    created_at
FROM ref_fate_cross_karma
ON CONFLICT (pattern_type, locale) DO UPDATE SET
    summary = EXCLUDED.summary,
    karmic_tests = EXCLUDED.karmic_tests;

INSERT INTO ref_karma_status_rules_i18n (
    rule_id,
    locale,
    description,
    created_at
)
SELECT
    rule_id,
    _bl01_detect_locale(description),
    description,
    created_at
FROM ref_karma_status_rules
WHERE description IS NOT NULL
ON CONFLICT (rule_id, locale) DO UPDATE SET
    description = EXCLUDED.description;

INSERT INTO ref_topic_significators_i18n (
    topic_code,
    locale,
    description,
    created_at
)
SELECT
    topic_code,
    _bl01_detect_locale(description),
    description,
    created_at
FROM ref_topic_significators
WHERE description IS NOT NULL
ON CONFLICT (topic_code, locale) DO UPDATE SET
    description = EXCLUDED.description;

INSERT INTO ref_support_sources_i18n (
    source_code,
    locale,
    name,
    description,
    created_at
)
SELECT
    source_code,
    _bl01_detect_locale(concat_ws(' ', name, description)),
    name,
    description,
    created_at
FROM ref_support_sources
ON CONFLICT (source_code, locale) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO ref_challenge_sources_i18n (
    source_code,
    locale,
    name,
    description,
    created_at
)
SELECT
    source_code,
    _bl01_detect_locale(concat_ws(' ', name, description)),
    name,
    description,
    created_at
FROM ref_challenge_sources
ON CONFLICT (source_code, locale) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- 4) Ensure fallback: every migrated entity has at least EN row
-- ---------------------------------------------------------------------------

INSERT INTO ref_sign_properties_i18n (sign, locale, qualities, created_at)
SELECT sign, 'en', qualities, created_at
FROM ref_sign_properties_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_sign_properties_i18n en
      WHERE en.sign = src.sign AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_house_meanings_i18n (house_number, locale, theme_keywords, extended_description, created_at)
SELECT house_number, 'en', theme_keywords, extended_description, created_at
FROM ref_house_meanings_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_house_meanings_i18n en
      WHERE en.house_number = src.house_number AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_aspect_types_i18n (aspect_type, locale, description, created_at)
SELECT aspect_type, 'en', description, created_at
FROM ref_aspect_types_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_aspect_types_i18n en
      WHERE en.aspect_type = src.aspect_type AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_cosmogram_patterns_i18n (pattern_type, locale, description, psychological_meaning, created_at)
SELECT pattern_type, 'en', description, psychological_meaning, created_at
FROM ref_cosmogram_patterns_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_cosmogram_patterns_i18n en
      WHERE en.pattern_type = src.pattern_type AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_configuration_types_i18n (type, locale, description, interpretation, created_at)
SELECT type, 'en', description, interpretation, created_at
FROM ref_configuration_types_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_configuration_types_i18n en
      WHERE en.type = src.type AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_planet_psych_functions_i18n (
    planet, locale, function_core, function_extended, archetype,
    keywords_positive, keywords_shadow, low_level_manifestation,
    high_level_manifestation, created_at
)
SELECT
    planet, 'en', function_core, function_extended, archetype,
    keywords_positive, keywords_shadow, low_level_manifestation,
    high_level_manifestation, created_at
FROM ref_planet_psych_functions_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_planet_psych_functions_i18n en
      WHERE en.planet = src.planet AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    IF to_regclass('ref_planet_role_weights_i18n') IS NOT NULL THEN
        INSERT INTO ref_planet_role_weights_i18n (role, locale, name, description, created_at)
        SELECT role, 'en', name, description, created_at
        FROM ref_planet_role_weights_i18n src
        WHERE src.locale <> 'en'
          AND NOT EXISTS (
              SELECT 1 FROM ref_planet_role_weights_i18n en
              WHERE en.role = src.role AND en.locale = 'en'
          )
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

INSERT INTO ref_planet_in_sign_psych_i18n (
    planet, sign, locale, summary, detailed_description, strengths, risks, defense_mechanisms, created_at
)
SELECT
    planet, sign, 'en', summary, detailed_description, strengths, risks, defense_mechanisms, created_at
FROM ref_planet_in_sign_psych_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_planet_in_sign_psych_i18n en
      WHERE en.planet = src.planet AND en.sign = src.sign AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_planet_in_house_psych_i18n (
    planet, house_number, locale, summary, detailed_description, life_area_focus, inner_conflicts, created_at
)
SELECT
    planet, house_number, 'en', summary, detailed_description, life_area_focus, inner_conflicts, created_at
FROM ref_planet_in_house_psych_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_planet_in_house_psych_i18n en
      WHERE en.planet = src.planet AND en.house_number = src.house_number AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_aspect_psych_i18n (
    planet_1, planet_2, aspect_type, locale, role, summary,
    detailed_description, typical_patterns, shadow_scenarios, created_at
)
SELECT
    planet_1, planet_2, aspect_type, 'en', role, summary,
    detailed_description, typical_patterns, shadow_scenarios, created_at
FROM ref_aspect_psych_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_aspect_psych_i18n en
      WHERE en.planet_1 = src.planet_1
        AND en.planet_2 = src.planet_2
        AND en.aspect_type = src.aspect_type
        AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_chakra_mapping_i18n (planet, locale, chakra_name, function_description, created_at)
SELECT planet, 'en', chakra_name, function_description, created_at
FROM ref_chakra_mapping_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_chakra_mapping_i18n en
      WHERE en.planet = src.planet AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_node_karma_i18n (
    node_type, sign, house_number, locale,
    karma_theme, detailed_description, talent_vector, task_vector, created_at
)
SELECT
    node_type, sign, house_number, 'en',
    karma_theme, detailed_description, talent_vector, task_vector, created_at
FROM ref_node_karma_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_node_karma_i18n en
      WHERE en.node_type = src.node_type
        AND en.sign = src.sign
        AND en.house_number = src.house_number
        AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_saturn_karma_i18n (
    sign, house_number, locale, summary, detailed_description, lesson_type, common_scenarios, created_at
)
SELECT sign, house_number, 'en', summary, detailed_description, lesson_type, common_scenarios, created_at
FROM ref_saturn_karma_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_saturn_karma_i18n en
      WHERE en.sign = src.sign
        AND en.house_number = src.house_number
        AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_lilith_karma_i18n (
    sign, house_number, locale, shadow_theme, behavior_patterns, temptation_scenarios, recommended_work, created_at
)
SELECT
    sign, house_number, 'en', shadow_theme, behavior_patterns, temptation_scenarios, recommended_work, created_at
FROM ref_lilith_karma_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_lilith_karma_i18n en
      WHERE en.sign = src.sign
        AND en.house_number = src.house_number
        AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_selena_karma_i18n (
    sign, house_number, locale, light_theme, support_scenarios, talent_activation, created_at
)
SELECT sign, house_number, 'en', light_theme, support_scenarios, talent_activation, created_at
FROM ref_selena_karma_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_selena_karma_i18n en
      WHERE en.sign = src.sign
        AND en.house_number = src.house_number
        AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_fortune_karma_i18n (house_number, locale, summary, gain_type, risks_if_ignored, created_at)
SELECT house_number, 'en', summary, gain_type, risks_if_ignored, created_at
FROM ref_fortune_karma_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_fortune_karma_i18n en
      WHERE en.house_number = src.house_number AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_fate_cross_karma_i18n (pattern_type, locale, summary, karmic_tests, created_at)
SELECT pattern_type, 'en', summary, karmic_tests, created_at
FROM ref_fate_cross_karma_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_fate_cross_karma_i18n en
      WHERE en.pattern_type = src.pattern_type AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_karma_status_rules_i18n (rule_id, locale, description, created_at)
SELECT rule_id, 'en', description, created_at
FROM ref_karma_status_rules_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_karma_status_rules_i18n en
      WHERE en.rule_id = src.rule_id AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_topic_significators_i18n (topic_code, locale, description, created_at)
SELECT topic_code, 'en', description, created_at
FROM ref_topic_significators_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_topic_significators_i18n en
      WHERE en.topic_code = src.topic_code AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_support_sources_i18n (source_code, locale, name, description, created_at)
SELECT source_code, 'en', name, description, created_at
FROM ref_support_sources_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_support_sources_i18n en
      WHERE en.source_code = src.source_code AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

INSERT INTO ref_challenge_sources_i18n (source_code, locale, name, description, created_at)
SELECT source_code, 'en', name, description, created_at
FROM ref_challenge_sources_i18n src
WHERE src.locale <> 'en'
  AND NOT EXISTS (
      SELECT 1 FROM ref_challenge_sources_i18n en
      WHERE en.source_code = src.source_code AND en.locale = 'en'
  )
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS _bl01_detect_locale(TEXT);

COMMIT;
