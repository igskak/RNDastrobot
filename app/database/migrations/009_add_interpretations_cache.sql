-- ============================================================================
-- МИГРАЦИЯ 009: Таблица кэширования интерпретаций
-- Дата: 2026-01-10
-- Описание: Добавляет таблицу для кэширования результатов OpenAI
-- ============================================================================

BEGIN;

-- Таблица для кэширования интерпретаций
CREATE TABLE IF NOT EXISTS natal_interpretations (
    -- Первичный ключ
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    interpretation_type VARCHAR(50) NOT NULL,  -- 'psychological_profile', 'career', etc.
    
    -- Данные интерпретации
    content JSONB NOT NULL,  -- Структурированный ответ от OpenAI
    
    -- Метаданные для инвалидации кэша
    chart_hash VARCHAR(64) NOT NULL,  -- SHA256 хэш ключевых параметров карты
    openai_model VARCHAR(50),  -- 'gpt-4.1', 'gpt-4o-mini'
    openai_prompt_id VARCHAR(100),  -- ID промпта в OpenAI Playground
    prompt_version VARCHAR(20),  -- '1.0', '1.1' - для версионирования
    
    -- Статистика
    tokens_used INTEGER,
    cost_usd NUMERIC(10, 4),
    generation_time_ms INTEGER,
    
    -- Временные метки
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Составной первичный ключ
    PRIMARY KEY (user_id, interpretation_type)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_interpretations_hash ON natal_interpretations(chart_hash);
CREATE INDEX IF NOT EXISTS idx_interpretations_type ON natal_interpretations(interpretation_type);
CREATE INDEX IF NOT EXISTS idx_interpretations_created ON natal_interpretations(created_at);

-- Комментарии
COMMENT ON TABLE natal_interpretations IS 'Кэш интерпретаций от OpenAI для натальных карт';
COMMENT ON COLUMN natal_interpretations.chart_hash IS 'SHA256 хэш ключевых параметров карты для инвалидации кэша';
COMMENT ON COLUMN natal_interpretations.prompt_version IS 'Версия промпта для отслеживания изменений';

COMMIT;

