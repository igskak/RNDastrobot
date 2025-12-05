-- ============================================================================
-- Migration: Add New Configuration Types
-- ============================================================================
-- This migration updates the valid_config_type constraint to include new
-- configuration types: Bisextile, Trapezoid, Skewed_Sail, Chariot, Sail,
-- Open_Envelope, and Star_of_David
-- ============================================================================

-- Drop the old constraint
ALTER TABLE natal_configurations DROP CONSTRAINT IF EXISTS valid_config_type;

-- Add the new constraint with all configuration types
ALTER TABLE natal_configurations ADD CONSTRAINT valid_config_type CHECK (type IN (
    -- Existing types
    'T_Square',           -- Т-квадрат
    'Grand_Trine',        -- Большой трин
    'Grand_Cross',        -- Большой крест
    'Yod',                -- Йод (Перст Божий)
    'Kite',               -- Воздушный змей
    'Mystic_Rectangle',   -- Мистический прямоугольник
    'Stellium',           -- Стеллиум (если хранить как конфигурацию)
    -- New types
    'Bisextile',          -- Бисекстиль
    'Trapezoid',          -- Трапеция
    'Skewed_Sail',        -- Косой парус
    'Chariot',            -- Повозка (конверт закрытый)
    'Sail',               -- Парус
    'Open_Envelope',      -- Конверт открытый
    'Star_of_David'       -- Звезда Давида
));

-- Verify the constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'valid_config_type';

