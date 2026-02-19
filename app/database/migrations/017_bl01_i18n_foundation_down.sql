-- ============================================================================
-- Migration: 017_bl01_i18n_foundation_down.sql
-- Description: Rollback for BL-01 SQL Foundation
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Rollback locale dimension in interpretation cache tables
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF to_regclass('public.natal_interpretations') IS NOT NULL THEN
        -- Keep EN rows first, remove non-EN rows to restore old PK semantics.
        DELETE FROM natal_interpretations ni
        WHERE ni.locale <> 'en'
          AND EXISTS (
              SELECT 1
              FROM natal_interpretations en
              WHERE en.user_id = ni.user_id
                AND en.interpretation_type = ni.interpretation_type
                AND en.locale = 'en'
          );

        DELETE FROM natal_interpretations
        WHERE locale <> 'en';
    END IF;
END;
$$;

DROP INDEX IF EXISTS idx_interpretations_locale;

ALTER TABLE IF EXISTS natal_interpretations
    DROP CONSTRAINT IF EXISTS ck_natal_interpretations_locale;

ALTER TABLE IF EXISTS natal_interpretations
    DROP CONSTRAINT IF EXISTS natal_interpretations_pkey;

ALTER TABLE IF EXISTS natal_interpretations
    ADD CONSTRAINT natal_interpretations_pkey
    PRIMARY KEY (user_id, interpretation_type);

ALTER TABLE IF EXISTS natal_interpretations
    DROP COLUMN IF EXISTS locale;

DROP INDEX IF EXISTS idx_pi_user_method_locale;
DROP INDEX IF EXISTS idx_pi_locale;

ALTER TABLE IF EXISTS prognostic_interpretations
    DROP CONSTRAINT IF EXISTS ck_prognostic_interpretations_locale;

ALTER TABLE IF EXISTS prognostic_interpretations
    DROP COLUMN IF EXISTS locale;

-- ---------------------------------------------------------------------------
-- 2) Drop *_i18n reference tables
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS ref_challenge_sources_i18n CASCADE;
DROP TABLE IF EXISTS ref_support_sources_i18n CASCADE;
DROP TABLE IF EXISTS ref_topic_significators_i18n CASCADE;
DROP TABLE IF EXISTS ref_karma_status_rules_i18n CASCADE;
DROP TABLE IF EXISTS ref_fate_cross_karma_i18n CASCADE;
DROP TABLE IF EXISTS ref_fortune_karma_i18n CASCADE;
DROP TABLE IF EXISTS ref_selena_karma_i18n CASCADE;
DROP TABLE IF EXISTS ref_lilith_karma_i18n CASCADE;
DROP TABLE IF EXISTS ref_saturn_karma_i18n CASCADE;
DROP TABLE IF EXISTS ref_node_karma_i18n CASCADE;
DROP TABLE IF EXISTS ref_chakra_mapping_i18n CASCADE;
DROP TABLE IF EXISTS ref_aspect_psych_i18n CASCADE;
DROP TABLE IF EXISTS ref_planet_in_house_psych_i18n CASCADE;
DROP TABLE IF EXISTS ref_planet_in_sign_psych_i18n CASCADE;
DROP TABLE IF EXISTS ref_planet_role_weights_i18n CASCADE;
DROP TABLE IF EXISTS ref_planet_psych_functions_i18n CASCADE;
DROP TABLE IF EXISTS ref_configuration_types_i18n CASCADE;
DROP TABLE IF EXISTS ref_cosmogram_patterns_i18n CASCADE;
DROP TABLE IF EXISTS ref_aspect_types_i18n CASCADE;
DROP TABLE IF EXISTS ref_house_meanings_i18n CASCADE;
DROP TABLE IF EXISTS ref_sign_properties_i18n CASCADE;

COMMIT;
