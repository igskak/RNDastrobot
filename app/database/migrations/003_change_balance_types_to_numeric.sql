-- ============================================================================
-- Migration: Change balance column types from INTEGER to NUMERIC(5,2)
-- ============================================================================
-- Reason: Planet weights now include fractional values (1.5 for Mercury, Venus, Mars)
-- This migration changes all balance columns to support decimal values
-- ============================================================================

BEGIN;

-- 1. UserElementBalance
ALTER TABLE user_element_balance
    ALTER COLUMN fire TYPE NUMERIC(5,2),
    ALTER COLUMN earth TYPE NUMERIC(5,2),
    ALTER COLUMN air TYPE NUMERIC(5,2),
    ALTER COLUMN water TYPE NUMERIC(5,2);

-- 2. UserModeBalance
ALTER TABLE user_mode_balance
    ALTER COLUMN cardinal TYPE NUMERIC(5,2),
    ALTER COLUMN fixed TYPE NUMERIC(5,2),
    ALTER COLUMN mutable TYPE NUMERIC(5,2);

-- 3. UserGenderBalance
ALTER TABLE user_gender_balance
    ALTER COLUMN masculine TYPE NUMERIC(5,2),
    ALTER COLUMN feminine TYPE NUMERIC(5,2);

-- 4. UserZonesBalance
ALTER TABLE user_zones_balance
    ALTER COLUMN brahma TYPE NUMERIC(5,2),
    ALTER COLUMN vishnu TYPE NUMERIC(5,2),
    ALTER COLUMN shiva TYPE NUMERIC(5,2);

-- 5. UserHemisphereBalance
ALTER TABLE user_hemisphere_balance
    ALTER COLUMN northern TYPE NUMERIC(5,2),
    ALTER COLUMN southern TYPE NUMERIC(5,2),
    ALTER COLUMN eastern TYPE NUMERIC(5,2),
    ALTER COLUMN western TYPE NUMERIC(5,2);

-- 6. UserQuadrantBalance
ALTER TABLE user_quadrant_balance
    ALTER COLUMN quadrant_1 TYPE NUMERIC(5,2),
    ALTER COLUMN quadrant_2 TYPE NUMERIC(5,2),
    ALTER COLUMN quadrant_3 TYPE NUMERIC(5,2),
    ALTER COLUMN quadrant_4 TYPE NUMERIC(5,2);

-- 7. UserHouseGroupBalance
ALTER TABLE user_house_group_balance
    ALTER COLUMN angular_count TYPE NUMERIC(5,2),
    ALTER COLUMN succedent_count TYPE NUMERIC(5,2),
    ALTER COLUMN cadent_count TYPE NUMERIC(5,2);

COMMIT;

-- Verify changes
SELECT 
    'user_element_balance' as table_name,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'user_element_balance'
    AND column_name IN ('fire', 'earth', 'air', 'water')
UNION ALL
SELECT 
    'user_mode_balance' as table_name,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'user_mode_balance'
    AND column_name IN ('cardinal', 'fixed', 'mutable')
UNION ALL
SELECT 
    'user_gender_balance' as table_name,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'user_gender_balance'
    AND column_name IN ('masculine', 'feminine')
ORDER BY table_name, column_name;

