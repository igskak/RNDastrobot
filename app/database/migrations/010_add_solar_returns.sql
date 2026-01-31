-- Migration: 010_add_solar_returns.sql
-- Description: Добавление таблицы solar_returns для хранения соляров

-- Create solar_returns table
CREATE TABLE IF NOT EXISTS solar_returns (
    solar_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    solar_datetime TIMESTAMPTZ NOT NULL,
    julian_day NUMERIC(15, 6) NOT NULL,
    location_lat NUMERIC(9, 6) NOT NULL,
    location_lon NUMERIC(9, 6) NOT NULL,
    location_name VARCHAR(200),
    house_system VARCHAR(1) DEFAULT 'P',
    chart_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_solar_returns_user_year ON solar_returns(user_id, year);
CREATE INDEX IF NOT EXISTS idx_solar_returns_year ON solar_returns(year);

-- Comment
COMMENT ON TABLE solar_returns IS 'Соларные карты (годовой прогноз) пользователей';

