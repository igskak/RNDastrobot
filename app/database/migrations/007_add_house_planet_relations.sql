-- ============================================================================
-- Migration 007: Add house-planet relation fields
-- ============================================================================
-- Добавляем поля для связей между домами и планетами:
-- 1. ruled_houses (планета) — какими домами управляет планета
-- 2. ruler_in_house (дом) — в каком доме находится управитель
-- 3. planets_in_house (дом) — какие планеты находятся в доме
-- ============================================================================

-- 1. Добавляем ruled_houses для планет (какими домами управляет)
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS ruled_houses JSONB DEFAULT '[]';
COMMENT ON COLUMN natal_planets.ruled_houses IS 'Номера домов, которыми управляет планета (основной управитель)';

-- 2. Добавляем ruler_in_house для домов (в каком доме находится управитель)
ALTER TABLE natal_houses ADD COLUMN IF NOT EXISTS ruler_in_house INTEGER;
COMMENT ON COLUMN natal_houses.ruler_in_house IS 'Номер дома, в котором находится управитель этого дома';

-- 3. Добавляем planets_in_house для домов (какие планеты в доме)
ALTER TABLE natal_houses ADD COLUMN IF NOT EXISTS planets_in_house JSONB DEFAULT '[]';
COMMENT ON COLUMN natal_houses.planets_in_house IS 'Список планет, находящихся в этом доме';

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'natal_planets' AND column_name = 'ruled_houses';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'natal_houses' AND column_name IN ('ruler_in_house', 'planets_in_house');

