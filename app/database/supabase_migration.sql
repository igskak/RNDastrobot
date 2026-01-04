-- ============================================================================
-- SUPABASE MIGRATION SCRIPT
-- Застосування схеми та seeds для пунктів 3.1, 3.2, 3.3
-- Дата: 2025-11-27
-- ============================================================================

-- ВАЖЛИВО: Виконувати в Supabase SQL Editor!
-- Можна виконати весь файл одразу або по частинах

BEGIN;

-- ============================================================================
-- ЧАСТИНА 1: СХЕМА БД (CREATE TABLE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Файл: schema/00_master_schema.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- ASTROBOT DATABASE MASTER SCHEMA
-- ============================================================================
-- Complete PostgreSQL schema for the Astrobot astrology application
-- 
-- This master file executes all schema files in the correct order
-- 
-- Database: astrobot_db
-- User: astrobot_user
-- PostgreSQL Version: 14+
-- 
-- Created: 2025-11-25
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- ============================================================================
-- SCHEMA EXECUTION ORDER
-- ============================================================================
-- The following files should be executed in this order:
-- 
-- 1. 01_core_tables.sql          - Users, planets, houses, angles, aspects
-- 2. 02_special_points.sql       - Special points and distributions
-- 3. 03_reference_tables.sql     - Basic reference/lookup tables
-- 4. 04_karma_reference_tables.sql - Karmic reference tables
-- 5. 05_balance_tables.sql       - Balance and distribution tables
-- 6. 06_analysis_tables.sql      - Analysis and summary tables
-- 7. 07_topic_tables.sql         - Topic-specific analysis tables
-- 8. 08_karma_tables.sql         - Karmic analysis tables
-- 9. 09_support_challenge_tables.sql - Support and challenge tables
-- 
-- ============================================================================

-- Execute all schema files

-- ============================================================================
-- CREATE VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Complete natal chart data for a user
CREATE OR REPLACE VIEW v_complete_natal_chart AS
SELECT 
    u.user_id,
    u.birth_date,
    u.birth_time,
    u.birth_place,
    u.lat,
    u.lon,
    a.asc_sign,
    a.asc_degree,
    a.mc_sign,
    a.mc_degree,
    json_agg(
        json_build_object(
            'planet', np.planet,
            'sign', np.sign,
            'degree', np.degree,
            'house', np.house_number,
            'retrograde', np.retrograde,
            'strength', np.strength_score
        )
    ) as planets
FROM users u
LEFT JOIN angles a ON u.user_id = a.user_id
LEFT JOIN natal_planets np ON u.user_id = np.user_id
GROUP BY u.user_id, u.birth_date, u.birth_time, u.birth_place, 
         u.lat, u.lon, a.asc_sign, a.asc_degree, a.mc_sign, a.mc_degree;

-- View: User's element and mode balance
CREATE OR REPLACE VIEW v_user_balance_summary AS
SELECT 
    u.user_id,
    eb.fire, eb.earth, eb.air, eb.water,
    mb.cardinal, mb.fixed, mb.mutable,
    gb.masculine, gb.feminine
FROM users u
LEFT JOIN user_element_balance eb ON u.user_id = eb.user_id
LEFT JOIN user_mode_balance mb ON u.user_id = mb.user_id
LEFT JOIN user_gender_balance gb ON u.user_id = gb.user_id;

-- ============================================================================
-- CREATE FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Function: Update timestamp on record modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to all tables with updated_at column
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================

-- Grant usage on schema
-- SCHEMA CREATION COMPLETE
-- ============================================================================

-- Display summary
SELECT 'Schema creation completed successfully!' as status;
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';



-- ----------------------------------------------------------------------------
-- Файл: schema/01_core_tables.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Core Tables for Astrobot Database
-- ============================================================================
-- This file contains the fundamental tables for storing user data and 
-- natal chart geometry (planets, houses, angles, aspects, etc.)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    birth_date DATE NOT NULL,
    birth_time TIME NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    birth_place VARCHAR(255) NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    julian_day DECIMAL(15, 6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_latitude CHECK (lat >= -90 AND lat <= 90),
    CONSTRAINT valid_longitude CHECK (lon >= -180 AND lon <= 180)
);

CREATE INDEX idx_users_birth_date ON users(birth_date);
CREATE INDEX idx_users_location ON users(lat, lon);

-- ============================================================================
-- 2. NATAL PLANETS
-- ============================================================================
CREATE TABLE natal_planets (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    planet VARCHAR(20) NOT NULL,
    sign VARCHAR(20) NOT NULL,
    degree DECIMAL(10, 6) NOT NULL CHECK (degree >= 0 AND degree < 360),
    house_number INTEGER CHECK (house_number >= 1 AND house_number <= 12),
    retrograde BOOLEAN DEFAULT FALSE,
    speed DECIMAL(10, 6),
    dignity VARCHAR(20) CHECK (dignity IN ('domicile', 'exaltation', 'detriment', 'fall', 'neutral')),
    strength_score DECIMAL(6, 2),
    element VARCHAR(10),
    mode VARCHAR(15),
    special_roles JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, planet)
);

CREATE INDEX idx_natal_planets_sign ON natal_planets(sign);
CREATE INDEX idx_natal_planets_house ON natal_planets(house_number);
CREATE INDEX idx_natal_planets_strength ON natal_planets(strength_score);

-- ============================================================================
-- 3. NATAL HOUSES
-- ============================================================================
CREATE TABLE natal_houses (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    house_number INTEGER NOT NULL CHECK (house_number >= 1 AND house_number <= 12),
    sign_on_cusp VARCHAR(20) NOT NULL,
    cusp_degree DECIMAL(10, 6) NOT NULL,
    ruler_planet VARCHAR(20),
    included_sign VARCHAR(20),
    house_group VARCHAR(15) CHECK (house_group IN ('angular', 'succedent', 'cadent')),
    house_length DECIMAL(10, 6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, house_number)
);

CREATE INDEX idx_natal_houses_sign ON natal_houses(sign_on_cusp);
CREATE INDEX idx_natal_houses_group ON natal_houses(house_group);

-- ============================================================================
-- 4. ANGLES
-- ============================================================================
CREATE TABLE angles (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    asc_sign VARCHAR(20) NOT NULL,
    asc_degree DECIMAL(10, 6) NOT NULL,
    mc_sign VARCHAR(20) NOT NULL,
    mc_degree DECIMAL(10, 6) NOT NULL,
    ic_sign VARCHAR(20) NOT NULL,
    ic_degree DECIMAL(10, 6) NOT NULL,
    dsc_sign VARCHAR(20) NOT NULL,
    dsc_degree DECIMAL(10, 6) NOT NULL,
    vertex_sign VARCHAR(20),
    vertex_degree DECIMAL(10, 6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. NATAL ASPECTS
-- ============================================================================
CREATE TABLE natal_aspects (
    aspect_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    planet_1 VARCHAR(20) NOT NULL,
    planet_2 VARCHAR(20) NOT NULL,
    aspect_type VARCHAR(30) NOT NULL,
    orb DECIMAL(6, 3) NOT NULL,
    is_major BOOLEAN DEFAULT TRUE,
    harmonic_type VARCHAR(15) CHECK (harmonic_type IN ('harmonious', 'tense', 'neutral')),
    configuration_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_natal_aspects_user ON natal_aspects(user_id);
CREATE INDEX idx_natal_aspects_type ON natal_aspects(aspect_type);
CREATE INDEX idx_natal_aspects_harmonic ON natal_aspects(harmonic_type);
CREATE INDEX idx_natal_aspects_planets ON natal_aspects(planet_1, planet_2);

-- ============================================================================
-- 6. NATAL CONFIGURATIONS
-- ============================================================================
-- Аспектные конфигурации (Т-квадраты, трины, йоды и т.д.)
CREATE TABLE natal_configurations (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    planets_involved JSONB NOT NULL,
    houses_involved JSONB,
    element VARCHAR(10),
    mode VARCHAR(15),
    strength_score DECIMAL(6, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_config_type CHECK (type IN (
        'T_Square',           -- Т-квадрат
        'Grand_Trine',        -- Большой трин
        'Grand_Cross',        -- Большой крест
        'Yod',                -- Йод (Перст Божий)
        'Kite',               -- Воздушный змей
        'Mystic_Rectangle',   -- Мистический прямоугольник
        'Stellium'            -- Стеллиум (если хранить как конфигурацию)
    ))
);

CREATE INDEX idx_natal_configurations_user ON natal_configurations(user_id);
CREATE INDEX idx_natal_configurations_type ON natal_configurations(type);

COMMENT ON TABLE natal_configurations IS 'Аспектные конфигурации (Т-квадраты, трины, йоды и т.д.)';
COMMENT ON COLUMN natal_configurations.planets_involved IS 'JSON массив планет, участвующих в конфигурации';
COMMENT ON COLUMN natal_configurations.houses_involved IS 'JSON массив домов, в которых находятся планеты конфигурации';

-- ============================================================================
-- 7. NATAL STELLIUMS
-- ============================================================================
CREATE TABLE natal_stelliums (
    stellium_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(10) CHECK (type IN ('house', 'sign')),
    house_number INTEGER CHECK (house_number >= 1 AND house_number <= 12),
    sign VARCHAR(20),
    planets JSONB NOT NULL,
    count INTEGER NOT NULL CHECK (count >= 3),
    strength_score DECIMAL(6, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_natal_stelliums_user ON natal_stelliums(user_id);
CREATE INDEX idx_natal_stelliums_type ON natal_stelliums(type);



-- ----------------------------------------------------------------------------
-- Файл: schema/02_special_points.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Special Points and Distribution Tables
-- ============================================================================
-- This file contains tables for special astrological points (nodes, Lilith,
-- Selena, Fortune, etc.) and planet distribution patterns
-- ============================================================================

-- ============================================================================
-- 1. NATAL SPECIAL POINTS
-- ============================================================================
CREATE TABLE natal_special_points (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    point VARCHAR(30) NOT NULL,
    sign VARCHAR(20) NOT NULL,
    degree DECIMAL(10, 6) NOT NULL CHECK (degree >= 0 AND degree < 360),
    house_number INTEGER CHECK (house_number >= 1 AND house_number <= 12),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, point),
    CONSTRAINT valid_point_type CHECK (point IN (
        -- Лунные узлы (только истинные)
        'TrueNorthNode',      -- Раху (истинный Северный узел)
        'TrueSouthNode',      -- Кету (истинный Южный узел)

        -- Чёрная и Белая Луна (только истинные/осцилирующие)
        'BlackMoon',          -- Лилит (истинная осцилирующая)
        'WhiteMoon',          -- Селена (анти-Лилит)

        -- Арабские части
        'Fortune',            -- Колесо Фортуны (Part of Fortune)

        -- Другие важные точки
        'Vertex',             -- Вертекс
        'AntiVertex',         -- Анти-Вертекс
        'Chiron'              -- Хирон
    ))
);

CREATE INDEX idx_special_points_type ON natal_special_points(point);
CREATE INDEX idx_special_points_sign ON natal_special_points(sign);

-- ============================================================================
-- 2. NATAL PLANET DISTRIBUTION
-- ============================================================================
CREATE TABLE natal_planet_distribution (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    min_empty_arc DECIMAL(6, 2),
    max_empty_arc DECIMAL(6, 2),
    cluster_count INTEGER,
    spread_map JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. COSMOGRAM PATTERN
-- ============================================================================
CREATE TABLE cosmogram_pattern (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    pattern_type VARCHAR(30) NOT NULL,
    anchor_planet VARCHAR(20),
    empty_arc_degree DECIMAL(6, 2),
    special_roles JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cosmogram_pattern_type ON cosmogram_pattern(pattern_type);

-- ============================================================================
-- 4. FATE CROSS POINTS
-- ============================================================================
-- Таблица для хранения точек Креста Судьбы
CREATE TABLE fate_cross_points (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    -- Точка 1 (Раху + 90°)
    point_1_longitude DECIMAL(10, 6) NOT NULL CHECK (point_1_longitude >= 0 AND point_1_longitude < 360),
    point_1_sign VARCHAR(20) NOT NULL,
    point_1_house INTEGER CHECK (point_1_house >= 1 AND point_1_house <= 12),
    -- Точка 2 (Раху - 90°)
    point_2_longitude DECIMAL(10, 6) NOT NULL CHECK (point_2_longitude >= 0 AND point_2_longitude < 360),
    point_2_sign VARCHAR(20) NOT NULL,
    point_2_house INTEGER CHECK (point_2_house >= 1 AND point_2_house <= 12),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fate_cross_user ON fate_cross_points(user_id);

COMMENT ON TABLE fate_cross_points IS 'Крест Судьбы - 4 точки квадратуры к оси Лунных узлов (Раху, Кету, Раху+90°, Раху-90°)';
COMMENT ON COLUMN fate_cross_points.point_1_longitude IS 'Долгота точки Раху + 90°';
COMMENT ON COLUMN fate_cross_points.point_2_longitude IS 'Долгота точки Раху - 90°';

-- Примечание: Раху и Кету уже хранятся в natal_special_points как TrueNorthNode и TrueSouthNode
-- Здесь мы храним только две дополнительные точки квадратуры



-- ----------------------------------------------------------------------------
-- Файл: schema/03_reference_tables.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Reference Tables (Lookup/Dictionary Tables)
-- ============================================================================
-- This file contains all reference/lookup tables for astrological properties,
-- meanings, and interpretations
-- ============================================================================

-- ============================================================================
-- 1. SIGN PROPERTIES
-- ============================================================================
CREATE TABLE ref_sign_properties (
    sign VARCHAR(20) PRIMARY KEY,
    element VARCHAR(10) NOT NULL CHECK (element IN ('Fire', 'Earth', 'Air', 'Water')),
    mode VARCHAR(15) NOT NULL CHECK (mode IN ('Cardinal', 'Fixed', 'Mutable')),
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Masculine', 'Feminine')),
    zone VARCHAR(10) NOT NULL CHECK (zone IN ('Brahma', 'Vishnu', 'Shiva')),
    life_quadrant VARCHAR(20),
    ruler VARCHAR(20),
    co_ruler VARCHAR(20),  -- Соуправитель знака (по Астрокурсу)
    exaltation VARCHAR(20),
    detriment VARCHAR(20),
    fall VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. HOUSE MEANINGS
-- ============================================================================
CREATE TABLE ref_house_meanings (
    house_number INTEGER PRIMARY KEY CHECK (house_number >= 1 AND house_number <= 12),
    theme_keywords TEXT NOT NULL,
    extended_description TEXT,
    main_topics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. ASPECT TYPES
-- ============================================================================
CREATE TABLE ref_aspect_types (
    aspect_type VARCHAR(30) PRIMARY KEY,
    exact_angle DECIMAL(6, 2) NOT NULL,
    base_orb DECIMAL(5, 2) NOT NULL,
    class VARCHAR(10) CHECK (class IN ('major', 'minor')),
    character VARCHAR(15) CHECK (character IN ('harmonious', 'tense', 'neutral')),
    color VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. COSMOGRAM PATTERNS
-- ============================================================================
CREATE TABLE ref_cosmogram_patterns (
    pattern_type VARCHAR(30) PRIMARY KEY,
    criteria JSONB NOT NULL,
    description TEXT,
    psychological_meaning TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. CONFIGURATION TYPES
-- ============================================================================
CREATE TABLE ref_configuration_types (
    type VARCHAR(50) PRIMARY KEY,
    rules JSONB NOT NULL,
    description TEXT,
    interpretation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. PLANET PSYCHOLOGICAL FUNCTIONS
-- ============================================================================
CREATE TABLE ref_planet_psych_functions (
    planet VARCHAR(20) PRIMARY KEY,
    function_core TEXT NOT NULL,
    function_extended TEXT,
    archetype VARCHAR(50),
    keywords_positive TEXT,
    keywords_shadow TEXT,
    low_level_manifestation TEXT,
    high_level_manifestation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. PLANET IN SIGN PSYCHOLOGY
-- ============================================================================
CREATE TABLE ref_planet_in_sign_psych (
    planet VARCHAR(20) NOT NULL,
    sign VARCHAR(20) NOT NULL,
    summary TEXT,
    detailed_description TEXT,
    strengths TEXT,
    risks TEXT,
    defense_mechanisms TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet, sign)
);

CREATE INDEX idx_planet_sign_planet ON ref_planet_in_sign_psych(planet);
CREATE INDEX idx_planet_sign_sign ON ref_planet_in_sign_psych(sign);

-- ============================================================================
-- 8. PLANET IN HOUSE PSYCHOLOGY
-- ============================================================================
CREATE TABLE ref_planet_in_house_psych (
    planet VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL CHECK (house_number >= 1 AND house_number <= 12),
    summary TEXT,
    detailed_description TEXT,
    life_area_focus TEXT,
    inner_conflicts TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet, house_number)
);

CREATE INDEX idx_planet_house_planet ON ref_planet_in_house_psych(planet);
CREATE INDEX idx_planet_house_house ON ref_planet_in_house_psych(house_number);

-- ============================================================================
-- 9. ASPECT PSYCHOLOGY
-- ============================================================================
CREATE TABLE ref_aspect_psych (
    planet_1 VARCHAR(20) NOT NULL,
    planet_2 VARCHAR(20) NOT NULL,
    aspect_type VARCHAR(30) NOT NULL,
    role VARCHAR(50),
    summary TEXT,
    detailed_description TEXT,
    typical_patterns TEXT,
    shadow_scenarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (planet_1, planet_2, aspect_type)
);

CREATE INDEX idx_aspect_psych_type ON ref_aspect_psych(aspect_type);

-- ============================================================================
-- 10. CHAKRA MAPPING
-- ============================================================================
CREATE TABLE ref_chakra_mapping (
    planet VARCHAR(20) PRIMARY KEY,
    chakra_number INTEGER NOT NULL CHECK (chakra_number >= 1 AND chakra_number <= 7),
    chakra_name VARCHAR(30) NOT NULL,
    function_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chakra_number ON ref_chakra_mapping(chakra_number);



-- ----------------------------------------------------------------------------
-- Файл: schema/04_karma_reference_tables.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Karmic Reference Tables
-- ============================================================================
-- This file contains reference tables for karmic interpretations
-- (nodes, Saturn, Lilith, Selena, Fortune, etc.)
-- ============================================================================

-- ============================================================================
-- 1. NODE KARMA
-- ============================================================================
CREATE TABLE ref_node_karma (
    node_type VARCHAR(10) NOT NULL CHECK (node_type IN ('North', 'South')),
    sign VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL CHECK (house_number >= 1 AND house_number <= 12),
    karma_theme TEXT,
    detailed_description TEXT,
    talent_vector TEXT,
    task_vector TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (node_type, sign, house_number)
);

CREATE INDEX idx_node_karma_type ON ref_node_karma(node_type);
CREATE INDEX idx_node_karma_sign ON ref_node_karma(sign);

-- ============================================================================
-- 2. SATURN KARMA
-- ============================================================================
CREATE TABLE ref_saturn_karma (
    sign VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL CHECK (house_number >= 1 AND house_number <= 12),
    summary TEXT,
    detailed_description TEXT,
    lesson_type VARCHAR(50),
    common_scenarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sign, house_number)
);

-- ============================================================================
-- 3. LILITH KARMA (Black Moon)
-- ============================================================================
CREATE TABLE ref_lilith_karma (
    sign VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL CHECK (house_number >= 1 AND house_number <= 12),
    shadow_theme TEXT,
    behavior_patterns TEXT,
    temptation_scenarios TEXT,
    recommended_work TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sign, house_number)
);

-- ============================================================================
-- 4. SELENA KARMA (White Moon)
-- ============================================================================
CREATE TABLE ref_selena_karma (
    sign VARCHAR(20) NOT NULL,
    house_number INTEGER NOT NULL CHECK (house_number >= 1 AND house_number <= 12),
    light_theme TEXT,
    support_scenarios TEXT,
    talent_activation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sign, house_number)
);

-- ============================================================================
-- 5. FORTUNE KARMA (Part of Fortune)
-- ============================================================================
CREATE TABLE ref_fortune_karma (
    house_number INTEGER PRIMARY KEY CHECK (house_number >= 1 AND house_number <= 12),
    summary TEXT,
    gain_type TEXT,
    risks_if_ignored TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. FATE CROSS KARMA
-- ============================================================================
CREATE TABLE ref_fate_cross_karma (
    pattern_type VARCHAR(50) PRIMARY KEY,
    involved_houses JSONB,
    summary TEXT,
    karmic_tests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. KARMA STATUS RULES
-- ============================================================================
CREATE TABLE ref_karma_status_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('talent', 'task', 'problem', 'support')),
    description TEXT,
    condition_astrology JSONB NOT NULL,
    effect JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_karma_rules_type ON ref_karma_status_rules(rule_type);

-- ============================================================================
-- 8. TOPIC SIGNIFICATORS
-- ============================================================================
CREATE TABLE ref_topic_significators (
    topic_code VARCHAR(30) PRIMARY KEY,
    primary_houses JSONB,
    primary_planets JSONB,
    secondary_planets JSONB,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. TOPIC HOUSE WEIGHTS
-- ============================================================================
CREATE TABLE ref_topic_house_weights (
    topic_code VARCHAR(30) NOT NULL,
    house_number INTEGER NOT NULL CHECK (house_number >= 1 AND house_number <= 12),
    weight DECIMAL(3, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (topic_code, house_number)
);

CREATE INDEX idx_topic_weights_topic ON ref_topic_house_weights(topic_code);

-- ============================================================================
-- 10. SUPPORT SOURCES
-- ============================================================================
CREATE TABLE ref_support_sources (
    source_code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_weight DECIMAL(4, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 11. CHALLENGE SOURCES
-- ============================================================================
CREATE TABLE ref_challenge_sources (
    source_code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_weight DECIMAL(4, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ----------------------------------------------------------------------------
-- Файл: schema/05_balance_tables.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Integral Balance Tables
-- ============================================================================
-- This file contains tables for storing calculated balances and distributions
-- (elements, modes, hemispheres, quadrants, etc.)
-- ============================================================================

-- ============================================================================
-- 1. ELEMENT BALANCE
-- ============================================================================
CREATE TABLE user_element_balance (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    fire INTEGER DEFAULT 0,
    earth INTEGER DEFAULT 0,
    air INTEGER DEFAULT 0,
    water INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. MODE BALANCE
-- ============================================================================
CREATE TABLE user_mode_balance (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    cardinal INTEGER DEFAULT 0,
    fixed INTEGER DEFAULT 0,
    mutable INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. GENDER BALANCE
-- ============================================================================
CREATE TABLE user_gender_balance (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    masculine INTEGER DEFAULT 0,
    feminine INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. ZONES BALANCE
-- ============================================================================
CREATE TABLE user_zones_balance (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    brahma INTEGER DEFAULT 0,
    vishnu INTEGER DEFAULT 0,
    shiva INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. HEMISPHERE BALANCE
-- ============================================================================
CREATE TABLE user_hemisphere_balance (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    northern INTEGER DEFAULT 0,
    southern INTEGER DEFAULT 0,
    eastern INTEGER DEFAULT 0,
    western INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. QUADRANT BALANCE
-- ============================================================================
CREATE TABLE user_quadrant_balance (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    quadrant_1 INTEGER DEFAULT 0,
    quadrant_2 INTEGER DEFAULT 0,
    quadrant_3 INTEGER DEFAULT 0,
    quadrant_4 INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. HOUSE GROUP BALANCE
-- ============================================================================
CREATE TABLE user_house_group_balance (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    angular_count INTEGER DEFAULT 0,
    succedent_count INTEGER DEFAULT 0,
    cadent_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ----------------------------------------------------------------------------
-- Файл: schema/06_analysis_tables.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Analysis and Summary Tables
-- ============================================================================
-- This file contains tables for storing analysis results and summaries
-- (general overview, psychological profile, thematic analysis, etc.)
-- ============================================================================

-- ============================================================================
-- 1. GENERAL OVERVIEW SUMMARY
-- ============================================================================
CREATE TABLE general_overview_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    -- ASC block
    asc_sign VARCHAR(20),
    asc_degree DECIMAL(10, 6),
    asc_element VARCHAR(10),
    asc_mode VARCHAR(15),
    asc_zone VARCHAR(10),
    asc_conjunctions JSONB,
    asc_ruler JSONB,
    -- Luminaries
    sun_sign VARCHAR(20),
    sun_house INTEGER,
    sun_aspect_summary JSONB,
    moon_sign VARCHAR(20),
    moon_house INTEGER,
    moon_aspect_summary JSONB,
    -- Cosmogram
    cosmogram_pattern VARCHAR(30),
    cosmogram_anchor_planet VARCHAR(20),
    -- Configurations and stelliums
    main_configurations JSONB,
    main_stelliums JSONB,
    -- Integral indicators
    dominant_element VARCHAR(10),
    dominant_mode VARCHAR(15),
    dominant_zone VARCHAR(10),
    dominant_hemisphere VARCHAR(10),
    angularity_ratio DECIMAL(5, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. PLANET PSYCHOLOGICAL PROFILE
-- ============================================================================
CREATE TABLE user_planet_psych_profile (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    planet VARCHAR(20) NOT NULL,
    sign VARCHAR(20),
    house_number INTEGER,
    retrograde BOOLEAN,
    dignity VARCHAR(20),
    strength_score DECIMAL(6, 2),
    aspect_summary JSONB,
    level_code VARCHAR(10) CHECK (level_code IN ('low', 'medium', 'high')),
    dominant_traits JSONB,
    shadow_traits JSONB,
    tension_score DECIMAL(6, 2),
    harmony_score DECIMAL(6, 2),
    is_key_planet BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, planet)
);

CREATE INDEX idx_psych_profile_key_planet ON user_planet_psych_profile(is_key_planet);

-- ============================================================================
-- 3. CHAKRA SCORES
-- ============================================================================
CREATE TABLE user_chakra_scores (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    chakra_number INTEGER NOT NULL CHECK (chakra_number >= 1 AND chakra_number <= 7),
    chakra_name VARCHAR(30) NOT NULL,
    score DECIMAL(6, 2),
    status VARCHAR(20) CHECK (status IN ('dominant', 'balanced', 'weak', 'blocked')),
    key_planets JSONB,
    issues JSONB,
    potentials JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chakra_number)
);

-- ============================================================================
-- 4. PSYCHOLOGICAL SUMMARY
-- ============================================================================
CREATE TABLE user_psych_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    dominant_element VARCHAR(10),
    dominant_mode VARCHAR(15),
    ego_core JSONB,
    emotional_core JSONB,
    mental_core JSONB,
    relational_core JSONB,
    conflict_axes JSONB,
    development_tasks JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. HOUSE THEMATIC SUMMARY
-- ============================================================================
CREATE TABLE house_thematic_summary (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    house_number INTEGER NOT NULL CHECK (house_number >= 1 AND house_number <= 12),
    cusp_sign VARCHAR(20),
    cusp_degree DECIMAL(10, 6),
    ruler_planet VARCHAR(20),
    ruler_sign VARCHAR(20),
    ruler_house INTEGER,
    ruler_aspect_summary JSONB,
    planets_in_house JSONB,
    planets_aspects_summary JSONB,
    included_sign VARCHAR(20),
    house_strength_score DECIMAL(6, 2),
    tension_score DECIMAL(6, 2),
    harmony_score DECIMAL(6, 2),
    key_topics JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, house_number)
);

-- ============================================================================
-- 6. LIFE THEMES SUMMARY
-- ============================================================================
CREATE TABLE life_themes_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    almuten_planet VARCHAR(20),
    almuten_score DECIMAL(6, 2),
    solar_house INTEGER,
    solar_sign VARCHAR(20),
    stellium_house INTEGER,
    stellium_sign VARCHAR(20),
    strong_houses JSONB,
    weak_houses JSONB,
    most_tense_houses JSONB,
    most_harmonious_houses JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ----------------------------------------------------------------------------
-- Файл: schema/07_topic_tables.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Topic-Specific Analysis Tables
-- ============================================================================
-- This file contains tables for thematic analysis
-- (health, career, relationships, family, spirituality)
-- ============================================================================

-- ============================================================================
-- 1. HEALTH SUMMARY
-- ============================================================================
CREATE TABLE topic_health_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    houses_involved JSONB,
    key_planets JSONB,
    malefic_planets JSONB,
    overall_risk_level VARCHAR(20),
    weak_zones TEXT,
    strengths TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. CAREER SUMMARY
-- ============================================================================
CREATE TABLE topic_career_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    houses_involved JSONB,
    career_vector TEXT,
    dominant_houses JSONB,
    key_planets JSONB,
    money_profile TEXT,
    work_style TEXT,
    overall_potential VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. RELATIONSHIPS SUMMARY
-- ============================================================================
CREATE TABLE topic_relationships_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    houses_involved JSONB,
    love_style TEXT,
    partnership_needs TEXT,
    sexual_profile TEXT,
    house_7_pattern TEXT,
    romantic_risks TEXT,
    overall_relationship_tone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. FAMILY SUMMARY
-- ============================================================================
CREATE TABLE topic_family_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    family_background TEXT,
    parenting_style TEXT,
    partnership_role_in_family TEXT,
    child_related_indicators TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. SPIRITUALITY SUMMARY
-- ============================================================================
CREATE TABLE topic_spirituality_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    spiritual_vector TEXT,
    key_houses JSONB,
    key_planets JSONB,
    crisis_and_transformation TEXT,
    faith_and_worldview TEXT,
    inner_world TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ----------------------------------------------------------------------------
-- Файл: schema/08_karma_tables.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Karmic Analysis Tables
-- ============================================================================
-- This file contains tables for karmic analysis results
-- (nodes, Saturn, Lilith/Selena, Fortune, planet karma status)
-- ============================================================================

-- ============================================================================
-- 1. NODES SUMMARY
-- ============================================================================
CREATE TABLE user_nodes_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    north_node_sign VARCHAR(20),
    north_node_house INTEGER,
    south_node_sign VARCHAR(20),
    south_node_house INTEGER,
    north_node_aspects JSONB,
    south_node_aspects JSONB,
    north_node_dispositor VARCHAR(20),
    south_node_dispositor VARCHAR(20),
    main_talents JSONB,
    main_tasks JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. SATURN SUMMARY
-- ============================================================================
CREATE TABLE user_saturn_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    sign VARCHAR(20),
    house_number INTEGER,
    retrograde BOOLEAN,
    aspects JSONB,
    karma_lessons JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. LILITH AND SELENA SUMMARY
-- ============================================================================
CREATE TABLE user_lilith_selena_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    black_moon_sign VARCHAR(20),
    black_moon_house INTEGER,
    black_moon_aspects JSONB,
    black_moon_dispositor VARCHAR(20),
    selena_sign VARCHAR(20),
    selena_house INTEGER,
    selena_aspects JSONB,
    shadow_topics JSONB,
    support_topics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. FORTUNE AND FATE SUMMARY
-- ============================================================================
CREATE TABLE user_fortune_fate_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    fortune_house INTEGER,
    fortune_sign VARCHAR(20),
    fortune_conjunctions JSONB,
    fate_cross_houses JSONB,
    fate_cross_planets JSONB,
    karmic_turning_points JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. PLANET KARMA STATUS
-- ============================================================================
CREATE TABLE user_planet_karma_status (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    planet VARCHAR(20) NOT NULL,
    house_number INTEGER,
    sign VARCHAR(20),
    function_core TEXT,
    strength_score DECIMAL(6, 2),
    dignity VARCHAR(20),
    aspect_tension_score DECIMAL(6, 2),
    aspect_harmony_score DECIMAL(6, 2),
    is_talent BOOLEAN DEFAULT FALSE,
    is_task BOOLEAN DEFAULT FALSE,
    status_label VARCHAR(30),
    life_theme TEXT,
    explanation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, planet)
);

CREATE INDEX idx_karma_status_talent ON user_planet_karma_status(is_talent);
CREATE INDEX idx_karma_status_task ON user_planet_karma_status(is_task);

-- ============================================================================
-- 6. KARMA SUMMARY
-- ============================================================================
CREATE TABLE user_karma_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    karmic_talents JSONB,
    karmic_tasks JSONB,
    main_karmic_axes JSONB,
    leading_life_themes JSONB,
    support_points JSONB,
    challenge_points JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ----------------------------------------------------------------------------
-- Файл: schema/09_support_challenge_tables.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Support and Challenge Tables
-- ============================================================================
-- This file contains tables for tracking support factors and challenges
-- ============================================================================

-- ============================================================================
-- 1. SUPPORT FACTORS
-- ============================================================================
CREATE TABLE user_support_factors (
    factor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    source_code VARCHAR(50) NOT NULL,
    object_type VARCHAR(20) CHECK (object_type IN ('planet', 'house', 'sign', 'aspect', 'configuration', 'point')),
    object_id VARCHAR(50),
    details JSONB,
    weight DECIMAL(4, 2),
    is_core_support BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_factors_user ON user_support_factors(user_id);
CREATE INDEX idx_support_factors_source ON user_support_factors(source_code);
CREATE INDEX idx_support_factors_core ON user_support_factors(is_core_support);

-- ============================================================================
-- 2. SUPPORT SUMMARY
-- ============================================================================
CREATE TABLE user_support_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    top_planet_supports JSONB,
    node_based_supports JSONB,
    aspect_supports JSONB,
    stellium_supports JSONB,
    white_moon_supports JSONB,
    global_support_themes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. CHALLENGE FACTORS
-- ============================================================================
CREATE TABLE user_challenge_factors (
    factor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    source_code VARCHAR(50) NOT NULL,
    object_type VARCHAR(20) CHECK (object_type IN ('planet', 'sign', 'house', 'aspect', 'point')),
    object_id VARCHAR(50),
    details JSONB,
    weight DECIMAL(4, 2),
    is_core_challenge BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_challenge_factors_user ON user_challenge_factors(user_id);
CREATE INDEX idx_challenge_factors_source ON user_challenge_factors(source_code);
CREATE INDEX idx_challenge_factors_core ON user_challenge_factors(is_core_challenge);

-- ============================================================================
-- 4. CHALLENGE SUMMARY
-- ============================================================================
CREATE TABLE user_challenge_summary (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    weak_planets JSONB,
    detriment_and_fall JSONB,
    north_node_themes JSONB,
    doryphoros JSONB,
    black_moon_path JSONB,
    major_tense_aspects JSONB,
    global_challenge_themes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);




-- ============================================================================
-- ЧАСТИНА 2: SEEDS (INSERT INTO)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Файл: seeds/01_sign_properties.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Reference Data: Sign Properties
-- ============================================================================
-- This file populates the ref_sign_properties table with zodiac sign data
-- ============================================================================

-- ============================================================================
-- Classical Dignity System (Western Astrology)
-- Based on: Ptolemy, William Lilly, and modern Western tradition
-- Source: Астрокурс_main.txt (for co-rulers)
-- ============================================================================
-- Ruler: Planet that rules the sign (domicile)
-- Co-ruler: Second ruler of the sign (по Астрокурсу)
-- Exaltation: Planet that is exalted in the sign
-- Detriment: Planet in detriment (opposite of ruler)
-- Fall: Planet in fall (opposite of exaltation)
-- ============================================================================

INSERT INTO ref_sign_properties (sign, element, mode, gender, zone, life_quadrant, ruler, co_ruler, exaltation, detriment, fall) VALUES
-- Fire Signs (Brahma - Creation/Impulse)
('Aries',       'Fire',  'Cardinal', 'Masculine', 'Brahma', 'Childhood', 'Mars',    NULL,        'Sun',     'Venus',   'Saturn'),
('Leo',         'Fire',  'Fixed',    'Masculine', 'Brahma', 'Youth',     'Sun',     NULL,        NULL,      'Saturn',  NULL),
('Sagittarius', 'Fire',  'Mutable',  'Masculine', 'Brahma', 'Maturity',  'Jupiter', 'Neptune',   NULL,      'Mercury', NULL),

-- Earth Signs (Material plane - dense world, not assigned to Trimurti zones)
('Taurus',      'Earth', 'Fixed',    'Feminine',  'Brahma', 'Childhood', 'Venus',   NULL,        'Moon',    'Mars',    NULL),
('Virgo',       'Earth', 'Mutable',  'Feminine',  'Vishnu', 'Youth',     'Mercury', 'Proserpina','Mercury', 'Jupiter', 'Venus'),
('Capricorn',   'Earth', 'Cardinal', 'Feminine',  'Shiva',  'Maturity',  'Saturn',  'Uranus',    'Mars',    'Moon',    'Jupiter'),

-- Air Signs (Shiva - Dissolution/Liberation)
('Gemini',      'Air',   'Mutable',  'Masculine', 'Brahma', 'Childhood', 'Mercury', NULL,        NULL,      'Jupiter', NULL),
('Libra',       'Air',   'Cardinal', 'Masculine', 'Vishnu', 'Youth',     'Venus',   'Chiron',    'Saturn',  'Mars',    'Sun'),
('Aquarius',    'Air',   'Fixed',    'Masculine', 'Shiva',  'Maturity',  'Uranus',  'Saturn',    NULL,      'Sun',     NULL),

-- Water Signs (Vishnu - Preservation/Life)
('Cancer',      'Water', 'Cardinal', 'Feminine',  'Brahma', 'Childhood', 'Moon',    NULL,        'Jupiter', 'Saturn',  'Mars'),
('Scorpio',     'Water', 'Fixed',    'Feminine',  'Vishnu', 'Youth',     'Pluto',   'Mars',      NULL,      'Venus',   'Moon'),
('Pisces',      'Water', 'Mutable',  'Feminine',  'Shiva',  'Maturity',  'Neptune', 'Jupiter',   'Venus',   'Mercury', 'Mercury')
ON CONFLICT (sign) DO UPDATE SET co_ruler = EXCLUDED.co_ruler;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' zodiac signs' as status FROM ref_sign_properties;



-- ----------------------------------------------------------------------------
-- Файл: seeds/02_aspect_types.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Reference Data: Aspect Types
-- ============================================================================
-- This file populates the ref_aspect_types table with astrological aspects
-- ============================================================================

INSERT INTO ref_aspect_types (aspect_type, exact_angle, base_orb, class, character, color, description) VALUES
-- Major Aspects (базовые орбисы согласно ref/ref_aspect_types.json)
('Conjunction',  0,   5.0, 'major', 'neutral',     NULL,    'Union, fusion, intensification of energies'),
('Sextile',      60,  5.0, 'major', 'harmonious',  'red',   'Opportunity, cooperation, mild harmony'),
('Square',       90,  5.0, 'major', 'tense',       'black', 'Friction, challenge, dynamic tension'),
('Trine',        120, 5.0, 'major', 'harmonious',  'red',   'Flow, ease, natural talents and gifts'),
('Opposition',   180, 5.0, 'major', 'tense',       'black', 'Tension, polarity, awareness through contrast'),

-- Minor Aspects (гармоники и специальные)
('Vigintile',       18,  1.0, 'minor', 'neutral',     'green', '18° aspect, 20th harmonic'),
('Semi_Nonagon',    20,  1.0, 'minor', 'neutral',     'blue',  '20° aspect, semi-nonagon'),
('Semisextile',     30,  2.0, 'minor', 'harmonious',  'red',   'Slight connection, minor adjustment'),
('Decile',          36,  1.0, 'minor', 'neutral',     'green', '36° aspect, 10th harmonic'),
('Nonagon',         40,  1.0, 'minor', 'neutral',     'blue',  '40° aspect, 9th harmonic'),
('Semisquare',      45,  2.0, 'minor', 'tense',       'black', 'Minor friction, irritation'),
('Quintile',        72,  1.0, 'minor', 'neutral',     'green', 'Creative talent, special gifts'),
('Binonagon',       80,  1.0, 'minor', 'neutral',     'blue',  '80° aspect, bi-nonagon'),
('Sentagon',       100,  1.0, 'minor', 'neutral',     'blue',  '100° aspect, sentagon'),
('Tridecile',      108,  1.0, 'minor', 'neutral',     'green', '108° aspect, tridecile'),
('Sesquiquadrate', 135,  2.0, 'minor', 'tense',       'black', 'Persistent minor tension'),
('Biquintile',     144,  1.0, 'minor', 'neutral',     'green', 'Creative expression, artistic ability'),
('Quincunx',       150,  2.0, 'minor', 'harmonious',  'red',   'Adjustment, incompatibility requiring adaptation')
ON CONFLICT (aspect_type) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' aspect types' as status FROM ref_aspect_types;



-- ----------------------------------------------------------------------------
-- Файл: seeds/03_house_meanings.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Reference Data: House Meanings
-- ============================================================================
-- This file populates the ref_house_meanings table with house interpretations
-- ============================================================================

INSERT INTO ref_house_meanings (house_number, theme_keywords, extended_description, main_topics) VALUES
(1, 'Self, Identity, Appearance, First Impressions',
    'The house of self and personality. Represents how you present yourself to the world, your physical appearance, and your approach to life.',
    '["identity", "appearance", "personality", "vitality", "self-expression"]'),

(2, 'Values, Money, Possessions, Self-Worth',
    'The house of personal resources and values. Governs material possessions, earning ability, and what you value most.',
    '["finances", "possessions", "values", "self-worth", "resources"]'),

(3, 'Communication, Learning, Siblings, Short Trips',
    'The house of communication and immediate environment. Covers learning, siblings, neighbors, and short-distance travel.',
    '["communication", "learning", "siblings", "neighbors", "short_travel", "writing"]'),

(4, 'Home, Family, Roots, Private Life',
    'The house of home and family. Represents your roots, ancestry, home environment, and emotional foundation.',
    '["home", "family", "roots", "parents", "emotional_foundation", "real_estate"]'),

(5, 'Creativity, Romance, Children, Self-Expression',
    'The house of creativity and pleasure. Governs romance, children, creative expression, and recreational activities.',
    '["creativity", "romance", "children", "pleasure", "hobbies", "self_expression"]'),

(6, 'Health, Work, Service, Daily Routines',
    'The house of health and service. Covers daily work, health habits, service to others, and pets.',
    '["health", "work", "service", "daily_routines", "pets", "wellness"]'),

(7, 'Partnerships, Marriage, Relationships, Contracts',
    'The house of partnerships. Represents marriage, business partnerships, open enemies, and one-on-one relationships.',
    '["marriage", "partnerships", "relationships", "contracts", "cooperation", "open_enemies"]'),

(8, 'Transformation, Shared Resources, Death, Rebirth',
    'The house of transformation and shared resources. Governs inheritance, taxes, death, rebirth, and deep psychological processes.',
    '["transformation", "shared_resources", "inheritance", "death", "rebirth", "psychology", "occult"]'),

(9, 'Philosophy, Higher Education, Long Travel, Beliefs',
    'The house of higher learning and expansion. Covers philosophy, religion, higher education, and long-distance travel.',
    '["philosophy", "higher_education", "religion", "long_travel", "beliefs", "publishing", "foreign_cultures"]'),

(10, 'Career, Public Image, Reputation, Achievements',
    'The house of career and public standing. Represents professional life, reputation, and social status.',
    '["career", "public_image", "reputation", "achievements", "authority", "social_status"]'),

(11, 'Friends, Groups, Hopes, Humanitarian Causes',
    'The house of friendships and aspirations. Governs friends, groups, social networks, and hopes for the future.',
    '["friends", "groups", "social_networks", "hopes", "wishes", "humanitarian_causes", "technology"]'),

(12, 'Spirituality, Subconscious, Isolation, Hidden Matters',
    'The house of the subconscious and spirituality. Represents hidden enemies, self-undoing, spirituality, and transcendence.',
    '["spirituality", "subconscious", "isolation", "hidden_enemies", "karma", "meditation", "hospitals"]')
ON CONFLICT (house_number) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' house meanings' as status FROM ref_house_meanings;



-- ----------------------------------------------------------------------------
-- Файл: seeds/04_chakra_mapping.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Reference Data: Chakra Mapping
-- ============================================================================
-- This file populates the ref_chakra_mapping table with planet-chakra associations
-- ============================================================================

INSERT INTO ref_chakra_mapping (planet, chakra_number, chakra_name, function_description) VALUES
('Saturn',  1, 'Root (Muladhara)',       'Survival, grounding, physical security, material foundation'),
('Moon',    2, 'Sacral (Svadhisthana)',  'Emotions, sexuality, creativity, pleasure, relationships'),
('Sun',     3, 'Solar Plexus (Manipura)', 'Personal power, will, ego, self-esteem, vitality'),
('Venus',   4, 'Heart (Anahata)',        'Love, compassion, harmony, relationships, beauty'),
('Mercury', 5, 'Throat (Vishuddha)',     'Communication, self-expression, truth, creativity'),
('Jupiter', 6, 'Third Eye (Ajna)',       'Intuition, wisdom, vision, higher knowledge, insight'),
('Neptune', 7, 'Crown (Sahasrara)',      'Spirituality, transcendence, cosmic consciousness, unity')
ON CONFLICT (planet) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' chakra mappings' as status FROM ref_chakra_mapping;



-- ----------------------------------------------------------------------------
-- Файл: seeds/05_configuration_types.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Reference Data: Configuration Types
-- ============================================================================
-- This file populates the ref_configuration_types table with aspect configurations
-- Based on: ref/ref_configuration_types.json
-- ============================================================================

INSERT INTO ref_configuration_types (type, rules, description, interpretation) VALUES
-- Grand Trine
('Grand_Trine', 
 '{
   "min_planets": 3,
   "required_aspects": ["trine"],
   "structure": "closed_triangle",
   "angle_step_deg": 120,
   "max_orb_deg": 5
 }'::jsonb,
 'Три планеты, образующие замкнутый треугольник из тринов (~120° друг от друга).',
 'Сильный внутренний ресурс, естественные таланты, лёгкость самореализации по стихии большого трина.'),

-- T-Square
('T_Square',
 '{
   "min_planets": 3,
   "required_aspects": ["square", "opposition"],
   "structure": "triangle_with_apex",
   "pattern": "две планеты в оппозиции, обе в квадрате к третьей (апексной) планете",
   "max_orb_deg": 5
 }'::jsonb,
 'Две планеты в оппозиции, обе делают квадрат к третьей (апекс).',
 'Сильное внутреннее напряжение и динамика; апексная планета показывает главный вектор действий и кризисов.'),

-- Grand Cross
('Grand_Cross',
 '{
   "min_planets": 4,
   "required_aspects": ["square", "opposition"],
   "structure": "closed_cross",
   "pattern": "четыре планеты, расположенные примерно через 90°, образуют 4 квадрата и 2 оппозиции",
   "max_orb_deg": 5
 }'::jsonb,
 'Четыре планеты через ~90°, дающие 4 квадрата и 2 оппозиции (крест).',
 'Жизнь как серия постоянных испытаний и задач; мощный потенциал при осознанной проработке.'),

-- Yod
('Yod',
 '{
   "min_planets": 3,
   "required_aspects": ["quincunx", "sextile"],
   "structure": "finger_of_god",
   "pattern": "две планеты в секстиле, обе в квиконсе к третьей (апексной) планете",
   "max_orb_deg": 3
 }'::jsonb,
 'Две планеты в секстиле, обе делают квиконс к третьей (апекс).',
 'Тонко настроенный кармический вектор; необходимость переключаться и подстраиваться, «палец судьбы» на теме апексной планеты.')

ON CONFLICT (type) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' configuration types' as status FROM ref_configuration_types;



-- ----------------------------------------------------------------------------
-- Файл: seeds/06_cosmogram_patterns.sql
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Reference Data: Cosmogram Patterns (Jones Patterns)
-- ============================================================================
-- This file populates the ref_cosmogram_patterns table with Jones patterns
-- Based on: ref/ref_cosmogram_patterns.json
-- ============================================================================

INSERT INTO ref_cosmogram_patterns (pattern_type, criteria, description, psychological_meaning) VALUES
-- Bundle
('Bundle',
 '{
   "description_tech": "Все планеты в пределах узкой дуги ≤120°",
   "occupied_arc_max_deg": 120,
   "max_empty_arc_min_deg": 240,
   "cluster_count_max": 1
 }'::jsonb,
 'Связка (Bundle): все планеты собраны в одном компактном секторе круга.',
 'Узкая специализация, сосредоточенность на одной-двух ведущих темах жизни; человек работает «точечно», глубоко в ограниченном наборе сфер.'),

-- Bowl
('Bowl',
 '{
   "description_tech": "Все планеты в пределах ~полукруга, вторая половина в основном пуста.",
   "occupied_arc_min_deg": 120,
   "occupied_arc_max_deg": 210,
   "max_empty_arc_min_deg": 150,
   "cluster_count_max": 2,
   "handle_required": false
 }'::jsonb,
 'Чаша (Bowl): все планеты расположены в одной половине круга, другая половина в основном пуста.',
 'Цельность и самодостаточность; человек ощущает в себе внутренний ресурс, но мир воспринимает через одну «половину» опыта, с ярко выраженным жизненным вектором.'),

-- Bucket
('Bucket',
 '{
   "description_tech": "Почти Чаша + одна планета-«ручка» в пустой половине.",
   "base_pattern": "Bowl",
   "max_empty_arc_min_deg": 150,
   "handle_required": true,
   "handle_min_count": 1,
   "handle_max_count": 2,
   "handle_orb_from_empty_arc_center_max_deg": 20
 }'::jsonb,
 'Ведро/Корзина (Bucket): большинство планет собрано в секторе (как Чаша), но одна планета стоит отдельно, как «ручка».',
 'Сильный фокус через одну ключевую функцию: планета-ручка становится главным каналом самореализации и компенсирует внутренний перекос карты.'),

-- Locomotive
('Locomotive',
 '{
   "description_tech": "Планеты занимают ~240° с относительно равномерным шагом; остаётся крупная пустая дуга ~120°.",
   "occupied_arc_min_deg": 210,
   "occupied_arc_max_deg": 270,
   "max_empty_arc_min_deg": 90,
   "max_empty_arc_max_deg": 150,
   "cluster_count_min": 3,
   "uniformity_required": true
 }'::jsonb,
 'Локомотив (Locomotive): планеты заполняют примерно две трети круга, образуя как бы «колесо поезда» с одной свободной дугой.',
 'Постоянное движение и прогресс; человек воспринимает жизнь как путь, где он последовательно «продавливает» темы, двигаясь вперёд через усилие и инициативу.'),

-- Seesaw
('Seesaw',
 '{
   "description_tech": "Две противостоящие группы планет; между кластерами заметные промежутки, но не формируются ни Чаша, ни Локомотив.",
   "cluster_count_exact": 2,
   "min_planets_per_cluster": 2,
   "max_empty_arc_min_deg": 90,
   "max_empty_arc_max_deg": 150,
   "has_opposition_axis": true
 }'::jsonb,
 'Качели (Seesaw): планеты распределены на две противостоящие группы.',
 'Жизнь как диалог и постоянное балансирование между двумя полюсами; склонность видеть противоположности и искать компромисс или качаться из крайности в крайность.'),

-- Splay
('Splay',
 '{
   "description_tech": "3–4 кластера планет, разделённых крупными пустыми дугами; нет единой доминантной половины круга.",
   "cluster_count_min": 3,
   "cluster_count_max": 4,
   "max_empty_arc_min_deg": 60,
   "max_empty_arc_max_deg": 150,
   "non_uniform_required": true
 }'::jsonb,
 'Растрой (Splay): планеты сгруппированы в несколько разрозненных кластеров.',
 'Нестандартность, многогранность и неоднородность; человек живёт несколькими несхожими сюжетами, его трудно свести к одной линии развития.'),

-- Splash
('Splash',
 '{
   "description_tech": "Планеты более-менее равномерно разбросаны по кругу; нет крупных пустых дуг и выраженных кластеров.",
   "min_empty_arc_max_deg": 60,
   "cluster_count_min": 5,
   "uniformity_required": true
 }'::jsonb,
 'Брызги (Splash): планеты рассыпаны по всему кругу без крупных скоплений.',
 'Разнообразие интересов и опытов; широкая рассеянность внимания, множественность талантов и задач, жизнь как мозаика из многих несвязанных сюжетов.')

ON CONFLICT (pattern_type) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' cosmogram patterns' as status FROM ref_cosmogram_patterns;




COMMIT;

-- ============================================================================
-- МІГРАЦІЯ ЗАВЕРШЕНА!
-- ============================================================================