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

