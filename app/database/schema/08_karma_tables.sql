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

