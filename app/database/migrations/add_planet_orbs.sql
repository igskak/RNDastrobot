-- ============================================================================
-- Migration: Add Planet Orbs System
-- ============================================================================
-- Добавляет систему индивидуальных орбисов для планет
-- Удаляет исключённые минорные аспекты
-- ============================================================================

BEGIN;

-- ============================================================================
-- Шаг 1: Удалить исключённые аспекты
-- ============================================================================
-- Удаляем 4 минорных аспекта, которые не используются
DELETE FROM ref_aspect_types WHERE aspect_type IN (
    'Vigintile',      -- 18°
    'Semi_Nonagon',   -- 20°
    'Binonagon',      -- 80°
    'Sentagon'        -- 100°
);

-- ============================================================================
-- Шаг 2: Создать таблицу индивидуальных орбисов планет
-- ============================================================================
CREATE TABLE IF NOT EXISTS ref_planet_orbs (
    planet VARCHAR(20) NOT NULL,
    aspect_type VARCHAR(30) NOT NULL REFERENCES ref_aspect_types(aspect_type) ON DELETE CASCADE,
    orb DECIMAL(5, 2) NOT NULL CHECK (orb > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet, aspect_type)
);

CREATE INDEX IF NOT EXISTS idx_planet_orbs_planet ON ref_planet_orbs(planet);
CREATE INDEX IF NOT EXISTS idx_planet_orbs_aspect ON ref_planet_orbs(aspect_type);

COMMENT ON TABLE ref_planet_orbs IS 'Индивидуальные орбисы для каждой планеты/точки по типам аспектов';
COMMENT ON COLUMN ref_planet_orbs.planet IS 'Название планеты или точки (Sun, Moon, Mercury, ASC, BlackMoon и т.д.)';
COMMENT ON COLUMN ref_planet_orbs.aspect_type IS 'Тип аспекта (ссылка на ref_aspect_types)';
COMMENT ON COLUMN ref_planet_orbs.orb IS 'Максимальный допустимый орбис в градусах для данной планеты и аспекта';

-- ============================================================================
-- Шаг 3: Заполнить данные орбисов (будет выполнено из seed-файла)
-- ============================================================================
-- Данные будут загружены из app/database/seeds/02b_planet_orbs.sql

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 'Migration completed successfully' as status;
SELECT 'Remaining aspect types: ' || COUNT(*) as aspect_count FROM ref_aspect_types;

