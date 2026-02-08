-- Migration: 013_add_transit_events_cache.sql
-- Description: Кэш транзитных событий (find_transit_events — самая тяжёлая операция)
-- Необходим для AI-чатбота прогностики

CREATE TABLE IF NOT EXISTS transit_events_cache (
    cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    timezone VARCHAR(50) NOT NULL,

    -- Параметры расчёта (для точного попадания в кэш)
    step_hours INTEGER NOT NULL DEFAULT 6,
    transit_bodies JSONB,       -- null = все тела
    natal_bodies JSONB,         -- null = все объекты
    aspect_filter JSONB,        -- null = все аспекты

    -- Результат
    events_data JSONB NOT NULL,
    events_count INTEGER NOT NULL DEFAULT 0,

    -- Метаданные
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_tec_user_period
    ON transit_events_cache(user_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_tec_created
    ON transit_events_cache(created_at);

-- Комментарии
COMMENT ON TABLE transit_events_cache IS 'Кэш результатов find_transit_events — тяжёлый расчёт транзитных событий за период';
COMMENT ON COLUMN transit_events_cache.events_data IS 'Полный JSON-массив транзитных событий (t_enter, t_exact, t_leave и т.д.)';
COMMENT ON COLUMN transit_events_cache.step_hours IS 'Шаг сканирования в часах (влияет на точность и время расчёта)';

