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

