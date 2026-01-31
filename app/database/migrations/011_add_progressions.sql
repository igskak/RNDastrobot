-- Migration: Add progressions table for Secondary Progressions
-- Date: 2026-01-31

-- Таблица для хранения вторичных прогрессий
CREATE TABLE IF NOT EXISTS progressions (
    progression_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    progressed_jd NUMERIC(15, 6) NOT NULL,
    chart_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Уникальный индекс: одна прогрессия на пользователя на дату
CREATE UNIQUE INDEX IF NOT EXISTS idx_progressions_user_date 
    ON progressions(user_id, target_date);

-- Индекс по дате для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_progressions_target_date 
    ON progressions(target_date);

-- Комментарии
COMMENT ON TABLE progressions IS 'Вторичные прогрессии (Secondary Progressions): 1 день = 1 год';
COMMENT ON COLUMN progressions.target_date IS 'Дата, на которую рассчитана прогрессия';
COMMENT ON COLUMN progressions.progressed_jd IS 'Julian Day прогрессивной карты';
COMMENT ON COLUMN progressions.chart_data IS 'Полные данные прогрессивной карты (JSON)';

