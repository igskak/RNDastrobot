-- ============================================================================
-- Migration 008: Karmic Score Columns (по методичке Алёны)
-- ============================================================================
-- Добавляем раздельные столбики для кармического статуса:
-- 1. karmic_minus_score — минусовой столбик (сумма всех отрицательных факторов)
-- 2. karmic_plus_score — плюсовой столбик (сумма всех положительных факторов)
-- 
-- Старое поле karmic_score остаётся для обратной совместимости,
-- но теперь хранит итоговый кармический статус по формуле:
-- если |minus| > 3 или |plus| > 3: total = |minus| + |plus|
-- иначе: total = max(|minus|, |plus|)
-- ============================================================================

-- 1. Добавляем поле karmic_minus_score
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS karmic_minus_score INTEGER DEFAULT 0;
COMMENT ON COLUMN natal_planets.karmic_minus_score IS 'Минусовой столбик кармического статуса (сумма отрицательных факторов, хранится как положительное число)';

-- 2. Добавляем поле karmic_plus_score
ALTER TABLE natal_planets ADD COLUMN IF NOT EXISTS karmic_plus_score INTEGER DEFAULT 0;
COMMENT ON COLUMN natal_planets.karmic_plus_score IS 'Плюсовой столбик кармического статуса (сумма положительных факторов)';

-- Обновляем комментарий для karmic_score
COMMENT ON COLUMN natal_planets.karmic_score IS 'Итоговый кармический статус: |minus|+|plus| если любой > 3, иначе max(|minus|,|plus|)';

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'natal_planets' 
  AND column_name IN ('karmic_score', 'karmic_minus_score', 'karmic_plus_score');

