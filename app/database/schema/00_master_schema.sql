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
\i 01_core_tables.sql
\i 02_special_points.sql
\i 03_reference_tables.sql
\i 04_karma_reference_tables.sql
\i 05_balance_tables.sql
\i 06_analysis_tables.sql
\i 07_topic_tables.sql
\i 08_karma_tables.sql
\i 09_support_challenge_tables.sql

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
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO astrobot_user;

-- Grant permissions on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO astrobot_user;

-- Grant permissions on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO astrobot_user;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO astrobot_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO astrobot_user;

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================

-- Display summary
SELECT 'Schema creation completed successfully!' as status;
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';

