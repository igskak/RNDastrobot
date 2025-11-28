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

