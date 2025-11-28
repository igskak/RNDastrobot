-- ============================================================================
-- Migration: Recreate natal_configurations table
-- ============================================================================
-- Пересоздаём таблицу natal_configurations с правильной структурой
-- для хранения Креста Судьбы и других конфигураций
-- ============================================================================

-- Удаляем старую таблицу (если есть данные, они будут потеряны)
DROP TABLE IF EXISTS natal_configurations CASCADE;

-- Создаём новую таблицу с правильной структурой
CREATE TABLE natal_configurations (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    config_type VARCHAR(30) NOT NULL,
    config_data JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, config_type),
    CONSTRAINT valid_config_type CHECK (config_type IN (
        'FateCross',          -- Крест Судьбы (4 точки квадратуры к оси узлов)
        'GrandTrine',         -- Большой трин (будущее расширение)
        'GrandCross',         -- Большой крест (будущее расширение)
        'Stellium',           -- Стеллиум (будущее расширение)
        'Yod'                 -- Йод (будущее расширение)
    ))
);

CREATE INDEX idx_natal_configurations_type ON natal_configurations(config_type);

COMMENT ON TABLE natal_configurations IS 'Астрологические конфигурации (Крест Судьбы, трины, кресты и т.д.)';
COMMENT ON COLUMN natal_configurations.config_data IS 'JSON с деталями конфигурации: точки, углы, описание';

