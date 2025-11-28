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
-- 7. PLANET ROLE WEIGHTS
-- ============================================================================
CREATE TABLE ref_planet_role_weights (
    role VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    weight DECIMAL(3, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. PLANET IN SIGN PSYCHOLOGY
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
-- 9. PLANET IN HOUSE PSYCHOLOGY
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
-- 10. ASPECT PSYCHOLOGY
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
-- 11. CHAKRA MAPPING
-- ============================================================================
CREATE TABLE ref_chakra_mapping (
    planet VARCHAR(20) PRIMARY KEY,
    chakra_number INTEGER NOT NULL CHECK (chakra_number >= 1 AND chakra_number <= 7),
    chakra_name VARCHAR(30) NOT NULL,
    function_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chakra_number ON ref_chakra_mapping(chakra_number);

