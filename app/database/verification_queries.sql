-- ============================================================================
-- Database Verification Queries
-- ============================================================================
-- Use these queries to verify your database setup and test functionality
-- ============================================================================

-- 1. COUNT ALL TABLES
-- Expected: 45+ tables
SELECT COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- 2. LIST ALL TABLES
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 3. VERIFY REFERENCE DATA
SELECT 
    'ref_sign_properties' as table_name, 
    COUNT(*) as record_count,
    '12 expected' as expected
FROM ref_sign_properties
UNION ALL
SELECT 
    'ref_aspect_types', 
    COUNT(*),
    '13 expected'
FROM ref_aspect_types
UNION ALL
SELECT 
    'ref_house_meanings', 
    COUNT(*),
    '12 expected'
FROM ref_house_meanings
UNION ALL
SELECT 
    'ref_chakra_mapping', 
    COUNT(*),
    '7 expected'
FROM ref_chakra_mapping;

-- 4. CHECK FOREIGN KEY CONSTRAINTS
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 5. CHECK INDEXES
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. VERIFY ZODIAC SIGNS DATA
SELECT 
    sign,
    element,
    mode,
    gender,
    ruler
FROM ref_sign_properties
ORDER BY 
    CASE sign
        WHEN 'Aries' THEN 1
        WHEN 'Taurus' THEN 2
        WHEN 'Gemini' THEN 3
        WHEN 'Cancer' THEN 4
        WHEN 'Leo' THEN 5
        WHEN 'Virgo' THEN 6
        WHEN 'Libra' THEN 7
        WHEN 'Scorpio' THEN 8
        WHEN 'Sagittarius' THEN 9
        WHEN 'Capricorn' THEN 10
        WHEN 'Aquarius' THEN 11
        WHEN 'Pisces' THEN 12
    END;

-- 7. VERIFY ASPECT TYPES
SELECT 
    aspect_type,
    exact_angle,
    base_orb,
    class,
    character
FROM ref_aspect_types
ORDER BY exact_angle;

-- 8. CHECK HOUSE MEANINGS
SELECT 
    house_number,
    theme_keywords,
    main_topics
FROM ref_house_meanings
ORDER BY house_number;

-- 9. TEST INSERT USER (then delete)
-- This tests the core user table and returns the created user_id
WITH inserted_user AS (
    INSERT INTO users (birth_date, birth_time, timezone, birth_place, lat, lon)
    VALUES ('1990-03-15', '14:30:00', 'America/New_York', 'New York, NY, USA', 40.7128, -74.0060)
    RETURNING user_id, birth_place
)
SELECT 
    user_id,
    birth_place,
    'Test user created successfully' as status
FROM inserted_user;

-- 10. DELETE TEST USER (use the user_id from above)
-- DELETE FROM users WHERE birth_place = 'New York, NY, USA';

-- 11. CHECK DATABASE SIZE
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as database_size;

-- 12. CHECK TABLE SIZES
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 13. VERIFY TRIGGERS
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- 14. CHECK VIEWS
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public';

-- 15. SAMPLE QUERY: Get complete natal chart structure
-- (This will be empty until you add actual data)
SELECT 
    u.user_id,
    u.birth_date,
    u.birth_place,
    COUNT(DISTINCT np.planet) as planet_count,
    COUNT(DISTINCT nh.house_number) as house_count,
    COUNT(DISTINCT na.aspect_id) as aspect_count
FROM users u
LEFT JOIN natal_planets np ON u.user_id = np.user_id
LEFT JOIN natal_houses nh ON u.user_id = nh.user_id
LEFT JOIN natal_aspects na ON u.user_id = na.user_id
GROUP BY u.user_id, u.birth_date, u.birth_place;

-- ============================================================================
-- PERFORMANCE QUERIES
-- ============================================================================

-- 16. Check for missing indexes on foreign keys
SELECT 
    c.conrelid::regclass AS table_name,
    string_agg(a.attname, ', ') AS columns,
    'Missing index on FK' AS recommendation
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
    AND c.conkey::int[] <@ i.indkey::int[]
)
GROUP BY c.conrelid, c.conname;

-- 17. Check table statistics
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================================================
-- CLEANUP QUERIES (USE WITH CAUTION!)
-- ============================================================================

-- 18. Delete all user data (keeps schema and reference data)
-- UNCOMMENT TO USE:
-- DELETE FROM users;

-- 19. Reset all sequences
-- UNCOMMENT TO USE:
-- SELECT setval(sequence_name, 1, false) 
-- FROM information_schema.sequences 
-- WHERE sequence_schema = 'public';

-- 20. Drop all tables (DANGEROUS - only for complete reset)
-- UNCOMMENT TO USE:
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT ALL ON SCHEMA public TO postgres;
-- GRANT ALL ON SCHEMA public TO public;

