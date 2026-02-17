-- Миграция 016: Снимки прогностики для активного чат-контекста
-- Дата: 2026-02-16

CREATE TABLE IF NOT EXISTS forecast_runs (
    run_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    method VARCHAR(30) NOT NULL,
    direction_type VARCHAR(20),

    period_start DATE,
    period_end DATE,
    target_date DATE,
    year INTEGER,

    timezone VARCHAR(50),
    location_name VARCHAR(200),
    location_lat NUMERIC(9, 6),
    location_lon NUMERIC(9, 6),

    context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    context_hash VARCHAR(64),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_forecast_run_method
        CHECK (method IN ('transits', 'progressions', 'directions', 'solar_return')),
    CONSTRAINT valid_forecast_run_direction_type
        CHECK (direction_type IS NULL OR direction_type IN ('solar_arc', 'symbolic', 'equatorial'))
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_user_active
    ON forecast_runs (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_user_created
    ON forecast_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_method
    ON forecast_runs (method);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_context_hash
    ON forecast_runs (context_hash);
