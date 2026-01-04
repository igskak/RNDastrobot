-- Migration: 005_add_planet_house_characteristics
-- Description: Add new fields for planet and house characteristics
-- Date: 2026-01-04

-- ============================================================================
-- NatalPlanet: новые поля характеристик
-- ============================================================================

-- Уровень 1: Простые характеристики
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS speed_percent NUMERIC(6,2);
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS critical_degrees JSONB DEFAULT '[]'::jsonb;

-- Уровень 2: Солнечные характеристики
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS sun_relation VARCHAR(15);

-- Уровень 3: Домовые характеристики
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS in_intercepted_sign BOOLEAN DEFAULT FALSE;
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS is_elevated BOOLEAN DEFAULT FALSE;

-- Уровень 4: Аспектные характеристики
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS is_peregrine BOOLEAN DEFAULT FALSE;
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS aspect_harmony VARCHAR(15);

-- Уровень 5: Эфемеридные характеристики
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS is_stationary BOOLEAN DEFAULT FALSE;
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS stationary_type VARCHAR(5);

-- Уровень 6: Кармический статус
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS karmic_score NUMERIC(6,2);

-- Constraints
ALTER TABLE natal_planets DROP CONSTRAINT IF EXISTS valid_sun_relation;
ALTER TABLE natal_planets ADD CONSTRAINT valid_sun_relation 
    CHECK (sun_relation IS NULL OR sun_relation IN ('cazimi', 'combust', 'under_rays'));

ALTER TABLE natal_planets DROP CONSTRAINT IF EXISTS valid_aspect_harmony;
ALTER TABLE natal_planets ADD CONSTRAINT valid_aspect_harmony 
    CHECK (aspect_harmony IS NULL OR aspect_harmony IN ('harmonious', 'tense', 'mixed'));

ALTER TABLE natal_planets DROP CONSTRAINT IF EXISTS valid_stationary_type;
ALTER TABLE natal_planets ADD CONSTRAINT valid_stationary_type 
    CHECK (stationary_type IS NULL OR stationary_type IN ('SR', 'SD'));

-- ============================================================================
-- NatalHouse: новые поля характеристик
-- ============================================================================

-- Соуправители (JSONB массив планет)
ALTER TABLE natal_houses ADD COLUMN IF NOT EXISTS co_rulers JSONB DEFAULT '[]'::jsonb;

-- Естественный сигнификатор дома
ALTER TABLE natal_houses ADD COLUMN IF NOT EXISTS significator VARCHAR(20);

-- ============================================================================
-- NatalAspect: партильность
-- ============================================================================

ALTER TABLE natal_aspects ADD COLUMN IF NOT EXISTS is_partile BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Индексы для новых полей
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_natal_planets_sun_relation ON natal_planets(sun_relation) WHERE sun_relation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_natal_planets_elevated ON natal_planets(is_elevated) WHERE is_elevated = TRUE;
CREATE INDEX IF NOT EXISTS idx_natal_planets_peregrine ON natal_planets(is_peregrine) WHERE is_peregrine = TRUE;
CREATE INDEX IF NOT EXISTS idx_natal_planets_stationary ON natal_planets(is_stationary) WHERE is_stationary = TRUE;
CREATE INDEX IF NOT EXISTS idx_natal_aspects_partile ON natal_aspects(is_partile) WHERE is_partile = TRUE;

-- ============================================================================
-- Комментарии
-- ============================================================================

COMMENT ON COLUMN natal_planets.speed_percent IS 'Скорость планеты в % от средней (100% = средняя)';
COMMENT ON COLUMN natal_planets.critical_degrees IS 'Критические градусы: ["jubilee","middle","anareta","royal","destructive"]';
COMMENT ON COLUMN natal_planets.sun_relation IS 'Отношение к Солнцу: cazimi (0-17′), combust (17′-3°), under_rays (3°-9°)';
COMMENT ON COLUMN natal_planets.in_intercepted_sign IS 'Планета во включённом знаке';
COMMENT ON COLUMN natal_planets.is_elevated IS 'Элевация - самая высокая планета над горизонтом (9/10 дом)';
COMMENT ON COLUMN natal_planets.is_peregrine IS 'Планета в шахте - без мажорных аспектов';
COMMENT ON COLUMN natal_planets.aspect_harmony IS 'Тип аспектов: harmonious/tense/mixed';
COMMENT ON COLUMN natal_planets.is_stationary IS 'Стационарная планета';
COMMENT ON COLUMN natal_planets.stationary_type IS 'Тип стационарности: SR (перед ретро), SD (перед директ)';
COMMENT ON COLUMN natal_planets.karmic_score IS 'Кармический статус по формуле Астрокурс';

COMMENT ON COLUMN natal_houses.co_rulers IS 'Соуправители дома (включённый знак или 2 управителя)';
COMMENT ON COLUMN natal_houses.significator IS 'Естественный сигнификатор дома (1=Mars, 2=Venus...)';

COMMENT ON COLUMN natal_aspects.is_partile IS 'Партильный (точный) аспект с орбом < 1°';

