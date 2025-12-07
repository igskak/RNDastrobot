-- ============================================================================
-- PLANET ORBS TABLE
-- ============================================================================
-- Индивидуальные орбисы для каждой планеты/точки по типам аспектов
-- Реализует правило: "если в аспекте участвуют планеты с разными орбисами - берем больший"
-- ============================================================================

CREATE TABLE IF NOT EXISTS ref_planet_orbs (
    planet VARCHAR(20) NOT NULL,
    aspect_type VARCHAR(30) NOT NULL REFERENCES ref_aspect_types(aspect_type) ON DELETE CASCADE,
    orb DECIMAL(5, 2) NOT NULL CHECK (orb > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet, aspect_type)
);

CREATE INDEX idx_planet_orbs_planet ON ref_planet_orbs(planet);
CREATE INDEX idx_planet_orbs_aspect ON ref_planet_orbs(aspect_type);

COMMENT ON TABLE ref_planet_orbs IS 'Индивидуальные орбисы для каждой планеты/точки по типам аспектов';
COMMENT ON COLUMN ref_planet_orbs.planet IS 'Название планеты или точки (Sun, Moon, Mercury, ASC, BlackMoon и т.д.)';
COMMENT ON COLUMN ref_planet_orbs.aspect_type IS 'Тип аспекта (ссылка на ref_aspect_types)';
COMMENT ON COLUMN ref_planet_orbs.orb IS 'Максимальный допустимый орбис в градусах для данной планеты и аспекта';

