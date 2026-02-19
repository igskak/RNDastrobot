-- ============================================================================
-- Migration: 018_bl01_fix_uk_ru_locale_mapping.sql
-- Description: Correct locale misclassification from BL-01 (uk text incorrectly labeled as ru)
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION _bl01_detect_locale_v3(input_text TEXT)
RETURNS VARCHAR(32)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    t TEXT := lower(COALESCE(input_text, ''));
    uk_score INTEGER := 0;
    ru_score INTEGER := 0;
BEGIN
    IF t = '' THEN
        RETURN 'en';
    END IF;

    -- High-confidence alphabet markers.
    IF t ~ '[іїєґ]' THEN
        uk_score := uk_score + 3;
    END IF;
    IF t ~ '[ёыэъ]' THEN
        ru_score := ru_score + 3;
    END IF;

    -- Dictionary markers for Ukrainian text that may not contain ІЇЄҐ in every row.
    IF t ~ '(^|[[:space:][:punct:]])(це|цей|ця|ці|аби|лише|попри|навіть|після|коли|проте|щоби|якщо)([[:space:][:punct:]]|$)' THEN
        uk_score := uk_score + 2;
    END IF;

    -- Dictionary markers for Russian.
    IF t ~ '(^|[[:space:][:punct:]])(это|этот|эта|эти|только|даже|после|когда|однако|чтобы|если|либо)([[:space:][:punct:]]|$)' THEN
        ru_score := ru_score + 2;
    END IF;

    IF uk_score > ru_score AND uk_score >= 2 THEN
        RETURN 'uk';
    END IF;
    IF ru_score > uk_score AND ru_score >= 2 THEN
        RETURN 'ru';
    END IF;

    -- ASCII-only text.
    IF t ~ '[a-z]' AND t !~ '[а-яёіїєґ]' THEN
        RETURN 'en';
    END IF;

    -- Keep as unresolved if still uncertain.
    IF t ~ '[а-яёіїєґ]' THEN
        RETURN 'ambiguous_cyrillic';
    END IF;

    RETURN 'en';
END;
$$;

UPDATE ref_sign_properties_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(src.qualities) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_sign_properties_i18n uk
      WHERE uk.sign = src.sign AND uk.locale = 'uk'
  );

UPDATE ref_house_meanings_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.theme_keywords, src.extended_description)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_house_meanings_i18n uk
      WHERE uk.house_number = src.house_number AND uk.locale = 'uk'
  );

UPDATE ref_aspect_types_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(src.description) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_aspect_types_i18n uk
      WHERE uk.aspect_type = src.aspect_type AND uk.locale = 'uk'
  );

UPDATE ref_cosmogram_patterns_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.description, src.psychological_meaning)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_cosmogram_patterns_i18n uk
      WHERE uk.pattern_type = src.pattern_type AND uk.locale = 'uk'
  );

UPDATE ref_configuration_types_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.description, src.interpretation)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_configuration_types_i18n uk
      WHERE uk.type = src.type AND uk.locale = 'uk'
  );

UPDATE ref_planet_psych_functions_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(
      concat_ws(
          ' ',
          src.function_core,
          src.function_extended,
          src.archetype,
          src.keywords_positive,
          src.keywords_shadow,
          src.low_level_manifestation,
          src.high_level_manifestation
      )
  ) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_planet_psych_functions_i18n uk
      WHERE uk.planet = src.planet AND uk.locale = 'uk'
  );

DO $$
BEGIN
    IF to_regclass('ref_planet_role_weights_i18n') IS NOT NULL THEN
        UPDATE ref_planet_role_weights_i18n src
        SET locale = 'uk'
        WHERE src.locale = 'ru'
          AND _bl01_detect_locale_v3(concat_ws(' ', src.name, src.description)) = 'uk'
          AND NOT EXISTS (
              SELECT 1 FROM ref_planet_role_weights_i18n uk
              WHERE uk.role = src.role AND uk.locale = 'uk'
          );
    END IF;
END;
$$;

UPDATE ref_planet_in_sign_psych_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(
      concat_ws(' ', src.summary, src.detailed_description, src.strengths, src.risks, src.defense_mechanisms)
  ) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_planet_in_sign_psych_i18n uk
      WHERE uk.planet = src.planet AND uk.sign = src.sign AND uk.locale = 'uk'
  );

UPDATE ref_planet_in_house_psych_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.summary, src.detailed_description, src.life_area_focus, src.inner_conflicts)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_planet_in_house_psych_i18n uk
      WHERE uk.planet = src.planet AND uk.house_number = src.house_number AND uk.locale = 'uk'
  );

UPDATE ref_aspect_psych_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(
      concat_ws(' ', src.role, src.summary, src.detailed_description, src.typical_patterns, src.shadow_scenarios)
  ) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_aspect_psych_i18n uk
      WHERE uk.planet_1 = src.planet_1
        AND uk.planet_2 = src.planet_2
        AND uk.aspect_type = src.aspect_type
        AND uk.locale = 'uk'
  );

UPDATE ref_chakra_mapping_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.chakra_name, src.function_description)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_chakra_mapping_i18n uk
      WHERE uk.planet = src.planet AND uk.locale = 'uk'
  );

UPDATE ref_node_karma_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.karma_theme, src.detailed_description, src.talent_vector, src.task_vector)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_node_karma_i18n uk
      WHERE uk.node_type = src.node_type
        AND uk.sign = src.sign
        AND uk.house_number = src.house_number
        AND uk.locale = 'uk'
  );

UPDATE ref_saturn_karma_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.summary, src.detailed_description, src.lesson_type, src.common_scenarios)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_saturn_karma_i18n uk
      WHERE uk.sign = src.sign
        AND uk.house_number = src.house_number
        AND uk.locale = 'uk'
  );

UPDATE ref_lilith_karma_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(
      concat_ws(' ', src.shadow_theme, src.behavior_patterns, src.temptation_scenarios, src.recommended_work)
  ) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_lilith_karma_i18n uk
      WHERE uk.sign = src.sign
        AND uk.house_number = src.house_number
        AND uk.locale = 'uk'
  );

UPDATE ref_selena_karma_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.light_theme, src.support_scenarios, src.talent_activation)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_selena_karma_i18n uk
      WHERE uk.sign = src.sign
        AND uk.house_number = src.house_number
        AND uk.locale = 'uk'
  );

UPDATE ref_fortune_karma_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.summary, src.gain_type, src.risks_if_ignored)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_fortune_karma_i18n uk
      WHERE uk.house_number = src.house_number AND uk.locale = 'uk'
  );

UPDATE ref_fate_cross_karma_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.summary, src.karmic_tests)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_fate_cross_karma_i18n uk
      WHERE uk.pattern_type = src.pattern_type AND uk.locale = 'uk'
  );

UPDATE ref_karma_status_rules_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(src.description) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_karma_status_rules_i18n uk
      WHERE uk.rule_id = src.rule_id AND uk.locale = 'uk'
  );

UPDATE ref_topic_significators_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(src.description) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_topic_significators_i18n uk
      WHERE uk.topic_code = src.topic_code AND uk.locale = 'uk'
  );

UPDATE ref_support_sources_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.name, src.description)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_support_sources_i18n uk
      WHERE uk.source_code = src.source_code AND uk.locale = 'uk'
  );

UPDATE ref_challenge_sources_i18n src
SET locale = 'uk'
WHERE src.locale = 'ru'
  AND _bl01_detect_locale_v3(concat_ws(' ', src.name, src.description)) = 'uk'
  AND NOT EXISTS (
      SELECT 1 FROM ref_challenge_sources_i18n uk
      WHERE uk.source_code = src.source_code AND uk.locale = 'uk'
  );

DROP FUNCTION IF EXISTS _bl01_detect_locale_v3(TEXT);

COMMIT;
