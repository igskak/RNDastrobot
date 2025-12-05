-- ============================================================================
-- Migration: Update Planet Orbs According to Alyona's Table
-- ============================================================================
-- Обновление орбисов планет согласно таблице "Таблица аспектов.csv" от Алены
-- Основные изменения:
-- 1. Планеты септенера (Mercury-Saturn): Sextile/Square/Trine 8.0 → 5.0
-- 2. Фиктивные точки (Nodes, BlackMoon, WhiteMoon): все мажорные аспекты → 3.0
-- ============================================================================

BEGIN;

-- ============================================================================
-- CONJUNCTION (0°) - Соединение
-- ============================================================================
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueNorthNode' AND aspect_type = 'Conjunction';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueSouthNode' AND aspect_type = 'Conjunction';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'BlackMoon' AND aspect_type = 'Conjunction';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'WhiteMoon' AND aspect_type = 'Conjunction';

-- ============================================================================
-- SEXTILE (60°) - Секстиль
-- ============================================================================
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Mercury' AND aspect_type = 'Sextile';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Venus' AND aspect_type = 'Sextile';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Mars' AND aspect_type = 'Sextile';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Jupiter' AND aspect_type = 'Sextile';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Saturn' AND aspect_type = 'Sextile';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueNorthNode' AND aspect_type = 'Sextile';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueSouthNode' AND aspect_type = 'Sextile';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'BlackMoon' AND aspect_type = 'Sextile';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'WhiteMoon' AND aspect_type = 'Sextile';

-- ============================================================================
-- SQUARE (90°) - Квадратура
-- ============================================================================
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Mercury' AND aspect_type = 'Square';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Venus' AND aspect_type = 'Square';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Mars' AND aspect_type = 'Square';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Jupiter' AND aspect_type = 'Square';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Saturn' AND aspect_type = 'Square';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueNorthNode' AND aspect_type = 'Square';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueSouthNode' AND aspect_type = 'Square';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'BlackMoon' AND aspect_type = 'Square';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'WhiteMoon' AND aspect_type = 'Square';

-- ============================================================================
-- TRINE (120°) - Трин
-- ============================================================================
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Mercury' AND aspect_type = 'Trine';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Venus' AND aspect_type = 'Trine';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Mars' AND aspect_type = 'Trine';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Jupiter' AND aspect_type = 'Trine';
UPDATE ref_planet_orbs SET orb = 5.0 WHERE planet = 'Saturn' AND aspect_type = 'Trine';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueNorthNode' AND aspect_type = 'Trine';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueSouthNode' AND aspect_type = 'Trine';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'BlackMoon' AND aspect_type = 'Trine';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'WhiteMoon' AND aspect_type = 'Trine';

-- ============================================================================
-- OPPOSITION (180°) - Оппозиция
-- ============================================================================
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueNorthNode' AND aspect_type = 'Opposition';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'TrueSouthNode' AND aspect_type = 'Opposition';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'BlackMoon' AND aspect_type = 'Opposition';
UPDATE ref_planet_orbs SET orb = 3.0 WHERE planet = 'WhiteMoon' AND aspect_type = 'Opposition';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'Updated orbs for major aspects according to Alyona''s table' as status;

-- Проверка изменений
SELECT planet, aspect_type, orb 
FROM ref_planet_orbs 
WHERE aspect_type IN ('Conjunction', 'Sextile', 'Square', 'Trine', 'Opposition')
  AND planet IN ('Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 
                 'TrueNorthNode', 'TrueSouthNode', 'BlackMoon', 'WhiteMoon')
ORDER BY 
  CASE aspect_type 
    WHEN 'Conjunction' THEN 1
    WHEN 'Sextile' THEN 2
    WHEN 'Square' THEN 3
    WHEN 'Trine' THEN 4
    WHEN 'Opposition' THEN 5
  END,
  planet;

COMMIT;

