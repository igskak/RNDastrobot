-- ============================================================================
-- PSYCHOLOGICAL REFERENCE TABLES
-- ============================================================================
-- Психологічні довідники для інтерпретації натальної карти
-- Created: 2025-12-16
-- ============================================================================

-- Таблиця: Психологічні функції планет
CREATE TABLE IF NOT EXISTS ref_planet_psych_functions (
    id SERIAL PRIMARY KEY,
    planet VARCHAR(20) NOT NULL UNIQUE,
    function_core TEXT NOT NULL,
    function_extended TEXT NOT NULL,
    archetype VARCHAR(100),
    keywords_positive TEXT,
    keywords_shadow TEXT,
    low_level_manifestation TEXT,
    high_level_manifestation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ref_planet_psych_functions IS 'Психологічні функції планет';
COMMENT ON COLUMN ref_planet_psych_functions.function_core IS 'Ядро функції планети';
COMMENT ON COLUMN ref_planet_psych_functions.function_extended IS 'Розширений опис функції';
COMMENT ON COLUMN ref_planet_psych_functions.archetype IS 'Архетип планети';
COMMENT ON COLUMN ref_planet_psych_functions.keywords_positive IS 'Позитивні ключові слова';
COMMENT ON COLUMN ref_planet_psych_functions.keywords_shadow IS 'Тіньові ключові слова';
COMMENT ON COLUMN ref_planet_psych_functions.low_level_manifestation IS 'Низький рівень прояву';
COMMENT ON COLUMN ref_planet_psych_functions.high_level_manifestation IS 'Високий рівень прояву';

-- Таблиця: Планета в знаку (психологія)
CREATE TABLE IF NOT EXISTS ref_planet_in_sign_psych (
    id SERIAL PRIMARY KEY,
    planet VARCHAR(20) NOT NULL,
    sign VARCHAR(20) NOT NULL,
    summary TEXT NOT NULL,
    detailed_description TEXT NOT NULL,
    strengths TEXT,
    risks TEXT,
    defense_mechanisms TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(planet, sign)
);

COMMENT ON TABLE ref_planet_in_sign_psych IS 'Психологічна інтерпретація планети в знаку';
COMMENT ON COLUMN ref_planet_in_sign_psych.summary IS 'Короткий опис';
COMMENT ON COLUMN ref_planet_in_sign_psych.detailed_description IS 'Детальний опис';
COMMENT ON COLUMN ref_planet_in_sign_psych.strengths IS 'Сильні сторони';
COMMENT ON COLUMN ref_planet_in_sign_psych.risks IS 'Ризики';
COMMENT ON COLUMN ref_planet_in_sign_psych.defense_mechanisms IS 'Захисні механізми';

-- Таблиця: Планета в домі (психологія)
CREATE TABLE IF NOT EXISTS ref_planet_in_house_psych (
    id SERIAL PRIMARY KEY,
    planet VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL CHECK (house_number BETWEEN 1 AND 12),
    summary TEXT NOT NULL,
    detailed_description TEXT NOT NULL,
    life_area_focus TEXT,
    inner_conflicts TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(planet, house_number)
);

COMMENT ON TABLE ref_planet_in_house_psych IS 'Психологічна інтерпретація планети в домі';
COMMENT ON COLUMN ref_planet_in_house_psych.summary IS 'Короткий опис';
COMMENT ON COLUMN ref_planet_in_house_psych.detailed_description IS 'Детальний опис';
COMMENT ON COLUMN ref_planet_in_house_psych.life_area_focus IS 'Фокус життєвої сфери';
COMMENT ON COLUMN ref_planet_in_house_psych.inner_conflicts IS 'Внутрішні конфлікти';

-- Таблиця: Аспекти (психологія)
CREATE TABLE IF NOT EXISTS ref_aspect_psych (
    id SERIAL PRIMARY KEY,
    planet_1 VARCHAR(20) NOT NULL,
    planet_2 VARCHAR(20) NOT NULL,
    aspect_type VARCHAR(20) NOT NULL,
    role VARCHAR(50),
    summary TEXT NOT NULL,
    detailed_description TEXT NOT NULL,
    typical_patterns TEXT,
    shadow_scenarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(planet_1, planet_2, aspect_type)
);

COMMENT ON TABLE ref_aspect_psych IS 'Психологічна інтерпретація аспектів між планетами';
COMMENT ON COLUMN ref_aspect_psych.planet_1 IS 'Перша планета';
COMMENT ON COLUMN ref_aspect_psych.planet_2 IS 'Друга планета';
COMMENT ON COLUMN ref_aspect_psych.aspect_type IS 'Тип аспекту (conjunction, square, trine, opposition)';
COMMENT ON COLUMN ref_aspect_psych.role IS 'Роль аспекту (amplification, conflict, harmonization, splitting)';
COMMENT ON COLUMN ref_aspect_psych.summary IS 'Короткий опис';
COMMENT ON COLUMN ref_aspect_psych.detailed_description IS 'Детальний опис';
COMMENT ON COLUMN ref_aspect_psych.typical_patterns IS 'Типові патерни';
COMMENT ON COLUMN ref_aspect_psych.shadow_scenarios IS 'Тіньові сценарії';

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_planet_in_sign_planet ON ref_planet_in_sign_psych(planet);
CREATE INDEX IF NOT EXISTS idx_planet_in_sign_sign ON ref_planet_in_sign_psych(sign);
CREATE INDEX IF NOT EXISTS idx_planet_in_house_planet ON ref_planet_in_house_psych(planet);
CREATE INDEX IF NOT EXISTS idx_planet_in_house_house ON ref_planet_in_house_psych(house_number);
CREATE INDEX IF NOT EXISTS idx_aspect_psych_planets ON ref_aspect_psych(planet_1, planet_2);
CREATE INDEX IF NOT EXISTS idx_aspect_psych_type ON ref_aspect_psych(aspect_type);

-- ============================================================================
-- ГОТОВО
-- ============================================================================

