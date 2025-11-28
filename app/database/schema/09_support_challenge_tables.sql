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

