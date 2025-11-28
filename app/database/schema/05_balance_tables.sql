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

