-- ============================================================================
-- Special Points and Distribution Tables
-- ============================================================================
-- This file contains tables for special astrological points (nodes, Lilith,
-- Selena, Fortune, etc.) and planet distribution patterns
-- ============================================================================

-- ============================================================================
-- 1. NATAL SPECIAL POINTS
-- ============================================================================
CREATE TABLE natal_special_points (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    point VARCHAR(30) NOT NULL,
    sign VARCHAR(20) NOT NULL,
    degree DECIMAL(10, 6) NOT NULL CHECK (degree >= 0 AND degree < 360),
    house_number INTEGER CHECK (house_number >= 1 AND house_number <= 12),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, point),
    CONSTRAINT valid_point_type CHECK (point IN (
        -- Лунные узлы (только истинные)
        'TrueNorthNode',      -- Раху (истинный Северный узел)
        'TrueSouthNode',      -- Кету (истинный Южный узел)

        -- Чёрная и Белая Луна (только истинные/осцилирующие)
        'BlackMoon',          -- Лилит (истинная осцилирующая)
        'WhiteMoon',          -- Селена (анти-Лилит)

        -- Арабские части
        'Fortune',            -- Колесо Фортуны (Part of Fortune)

        -- Другие важные точки
        'Vertex',             -- Вертекс
        'AntiVertex',         -- Анти-Вертекс
        'Chiron'              -- Хирон
    ))
);

CREATE INDEX idx_special_points_type ON natal_special_points(point);
CREATE INDEX idx_special_points_sign ON natal_special_points(sign);

-- ============================================================================
-- 2. NATAL PLANET DISTRIBUTION
-- ============================================================================
CREATE TABLE natal_planet_distribution (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    min_empty_arc DECIMAL(6, 2),
    max_empty_arc DECIMAL(6, 2),
    cluster_count INTEGER,
    spread_map JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. COSMOGRAM PATTERN
-- ============================================================================
CREATE TABLE cosmogram_pattern (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    pattern_type VARCHAR(30) NOT NULL,
    anchor_planet VARCHAR(20),
    empty_arc_degree DECIMAL(6, 2),
    special_roles JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cosmogram_pattern_type ON cosmogram_pattern(pattern_type);

-- ============================================================================
-- 4. FATE CROSS POINTS
-- ============================================================================
-- Таблица для хранения точек Креста Судьбы
CREATE TABLE fate_cross_points (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    -- Точка 1 (Раху + 90°)
    point_1_longitude DECIMAL(10, 6) NOT NULL CHECK (point_1_longitude >= 0 AND point_1_longitude < 360),
    point_1_sign VARCHAR(20) NOT NULL,
    point_1_house INTEGER CHECK (point_1_house >= 1 AND point_1_house <= 12),
    -- Точка 2 (Раху - 90°)
    point_2_longitude DECIMAL(10, 6) NOT NULL CHECK (point_2_longitude >= 0 AND point_2_longitude < 360),
    point_2_sign VARCHAR(20) NOT NULL,
    point_2_house INTEGER CHECK (point_2_house >= 1 AND point_2_house <= 12),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fate_cross_user ON fate_cross_points(user_id);

COMMENT ON TABLE fate_cross_points IS 'Крест Судьбы - 4 точки квадратуры к оси Лунных узлов (Раху, Кету, Раху+90°, Раху-90°)';
COMMENT ON COLUMN fate_cross_points.point_1_longitude IS 'Долгота точки Раху + 90°';
COMMENT ON COLUMN fate_cross_points.point_2_longitude IS 'Долгота точки Раху - 90°';

-- Примечание: Раху и Кету уже хранятся в natal_special_points как TrueNorthNode и TrueSouthNode
-- Здесь мы храним только две дополнительные точки квадратуры

