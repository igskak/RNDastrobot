-- Migration: 032_add_solar_return_names.sql
-- Description: Add custom names for saved solar returns

ALTER TABLE solar_returns
    ADD COLUMN IF NOT EXISTS name VARCHAR(160);

COMMENT ON COLUMN solar_returns.name IS 'Пользовательское название сохранённого соляра';
