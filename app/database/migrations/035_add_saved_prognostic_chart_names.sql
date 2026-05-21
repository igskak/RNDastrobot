-- Migration: 035_add_saved_prognostic_chart_names.sql
-- Description: Add custom names for saved prognostic charts beyond solar returns

ALTER TABLE progressions
    ADD COLUMN IF NOT EXISTS name VARCHAR(160);

ALTER TABLE directions
    ADD COLUMN IF NOT EXISTS name VARCHAR(160);

COMMENT ON COLUMN progressions.name IS 'Пользовательское название сохранённой прогрессии';
COMMENT ON COLUMN directions.name IS 'Пользовательское название сохранённой дирекции';

CREATE TABLE IF NOT EXISTS saved_charts (
    saved_chart_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    chart_type VARCHAR(32) NOT NULL,
    name VARCHAR(160),
    target_date DATE,
    target_time TIME,
    timezone VARCHAR(50),
    url_path TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_charts_user_created ON saved_charts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_saved_charts_user_type ON saved_charts(user_id, chart_type);

COMMENT ON TABLE saved_charts IS 'Сохранённые ссылки на любые карты в профиле клиента';
COMMENT ON COLUMN saved_charts.chart_type IS 'Тип карты: forecast, transit, progression, direction, custom';
COMMENT ON COLUMN saved_charts.url_path IS 'Относительная ссылка для восстановления карты';
