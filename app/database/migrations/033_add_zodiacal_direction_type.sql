-- Migration: Add canonical zodiacal direction type
-- Date: 2026-05-21

-- ZET labels the 1 degree = 1 year method as "zodiacal direction".
-- Existing rows used the internal legacy name "symbolic"; keep the API alias,
-- but store the canonical name from this migration forward.

ALTER TABLE directions
    DROP CONSTRAINT IF EXISTS valid_direction_type;

UPDATE directions
SET direction_type = 'zodiacal'
WHERE direction_type = 'symbolic';

ALTER TABLE directions
    ADD CONSTRAINT valid_direction_type CHECK (
        direction_type IN ('solar_arc', 'zodiacal', 'symbolic', 'equatorial')
    );

COMMENT ON COLUMN directions.direction_type IS
    'Тип дирекции: zodiacal (ZET зодиакальная, 1°=1 год), solar_arc (Solar Arc), symbolic (legacy alias), equatorial (ключ Найбода)';
