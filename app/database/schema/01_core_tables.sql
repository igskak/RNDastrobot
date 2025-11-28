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

