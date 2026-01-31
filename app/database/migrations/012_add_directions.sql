-- Migration: Add directions table for astrological directions (Solar Arc, Symbolic, Equatorial)
-- Date: 2026-01-31

-- ============================================================================
-- DIRECTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS directions (
    direction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    
    -- Тип дирекции: solar_arc, symbolic, equatorial
    direction_type VARCHAR(20) NOT NULL,
    
    -- Дуга дирекции в градусах
    arc_degrees NUMERIC(10, 6) NOT NULL,
    
    -- Возраст на момент дирекции
    age_years NUMERIC(8, 4),
    
    -- Полные данные карты (JSON)
    chart_data JSONB,
    
    -- Метаданные
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint на тип дирекции
    CONSTRAINT valid_direction_type CHECK (
        direction_type IN ('solar_arc', 'symbolic', 'equatorial')
    )
);

-- Индексы
CREATE UNIQUE INDEX IF NOT EXISTS idx_directions_user_date_type 
    ON directions(user_id, target_date, direction_type);

CREATE INDEX IF NOT EXISTS idx_directions_target_date 
    ON directions(target_date);

CREATE INDEX IF NOT EXISTS idx_directions_type 
    ON directions(direction_type);

-- Комментарии
COMMENT ON TABLE directions IS 'Дирекции — прогностический метод, где все точки карты смещаются на определённую дугу';
COMMENT ON COLUMN directions.direction_type IS 'Тип дирекции: solar_arc (Solar Arc), symbolic (1°=1 год), equatorial (ключ Найбода)';
COMMENT ON COLUMN directions.arc_degrees IS 'Дуга смещения в градусах';
COMMENT ON COLUMN directions.age_years IS 'Возраст натива на момент дирекции';

