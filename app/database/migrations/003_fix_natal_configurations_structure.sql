-- ============================================================================
-- Migration 003: Fix natal_configurations structure
-- ============================================================================
-- Восстанавливаем правильную структуру natal_configurations согласно спецификации
-- и создаём отдельную таблицу для Креста Судьбы
-- ============================================================================

-- Шаг 1: Удаляем неправильную таблицу natal_configurations
DROP TABLE IF EXISTS natal_configurations CASCADE;

-- Шаг 2: Создаём правильную таблицу natal_configurations
-- Для хранения аспектных конфигураций (Т-квадраты, трины, йоды, кресты)
CREATE TABLE natal_configurations (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    planets_involved JSONB NOT NULL,
    houses_involved JSONB,
    element VARCHAR(10),
    mode VARCHAR(15),
    strength_score DECIMAL(6, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_config_type CHECK (type IN (
        'T_Square',           -- Т-квадрат
        'Grand_Trine',        -- Большой трин
        'Grand_Cross',        -- Большой крест
        'Yod',                -- Йод (Перст Божий)
        'Kite',               -- Воздушный змей
        'Mystic_Rectangle',   -- Мистический прямоугольник
        'Stellium'            -- Стеллиум (если хранить как конфигурацию)
    ))
);

CREATE INDEX idx_natal_configurations_user ON natal_configurations(user_id);
CREATE INDEX idx_natal_configurations_type ON natal_configurations(type);

COMMENT ON TABLE natal_configurations IS 'Аспектные конфигурации (Т-квадраты, трины, йоды и т.д.)';
COMMENT ON COLUMN natal_configurations.planets_involved IS 'JSON массив планет, участвующих в конфигурации';
COMMENT ON COLUMN natal_configurations.houses_involved IS 'JSON массив домов, в которых находятся планеты конфигурации';

-- Пример структуры planets_involved:
-- ["Sun", "Moon", "Mars"]
-- 
-- Пример структуры houses_involved:
-- [1, 5, 9]

-- Шаг 3: Создаём отдельную таблицу для Креста Судьбы
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

