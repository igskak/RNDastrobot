-- ============================================================================
-- БЕЗПЕЧНЕ ОНОВЛЕННЯ ДОВІДНИКІВ
-- ============================================================================
-- Цей скрипт оновлює тільки довідники, НЕ торкаючись користувацьких даних
-- 
-- Що буде оновлено:
-- - ref_aspect_types (13 → 18 аспектів)
-- - ref_configuration_types (0 → 4 типи)
-- - ref_cosmogram_patterns (0 → 7 паттернів)
--
-- Що НЕ буде торкнуто:
-- ✅ users (7 користувачів)
-- ✅ natal_planets (70 записів)
-- ✅ natal_houses (84 записи)
-- ✅ Всі інші користувацькі дані
-- ============================================================================

BEGIN;

-- ============================================================================
-- КРОК 1: Очистити довідники
-- ============================================================================

-- Видалити старі дані з довідників
TRUNCATE ref_aspect_types CASCADE;
TRUNCATE ref_configuration_types CASCADE;
TRUNCATE ref_cosmogram_patterns CASCADE;

-- ============================================================================
-- КРОК 2: Заповнити ref_aspect_types (18 аспектів)
-- ============================================================================

INSERT INTO ref_aspect_types (aspect_type, exact_angle, base_orb, class, character, color, description) VALUES
-- Мажорні аспекти (5)
('Conjunction', 0.00, 8.00, 'major', 'neutral', 'yellow', 'Соединение — слияние энергий планет'),
('Sextile', 60.00, 6.00, 'major', 'harmonious', 'blue', 'Секстиль — лёгкая гармония, возможности'),
('Square', 90.00, 8.00, 'major', 'tense', 'red', 'Квадрат — напряжение, вызов, действие'),
('Trine', 120.00, 8.00, 'major', 'harmonious', 'green', 'Трин — сильная гармония, таланты'),
('Opposition', 180.00, 8.00, 'major', 'tense', 'red', 'Оппозиция — противостояние, поляризация'),

-- Мінорні аспекти (13)
('Vigintile', 18.00, 1.00, 'minor', 'harmonious', 'light_blue', 'Вигинтиль (18°) — тонкая гармония'),
('Semi_Nonagon', 20.00, 1.00, 'minor', 'harmonious', 'light_blue', 'Полунонагон (20°) — духовная связь'),
('Semisextile', 30.00, 2.00, 'minor', 'neutral', 'gray', 'Полусекстиль (30°) — слабая связь'),
('Decile', 36.00, 1.50, 'minor', 'harmonious', 'light_green', 'Дециль (36°) — творческая гармония'),
('Nonagon', 40.00, 1.50, 'minor', 'harmonious', 'light_green', 'Нонагон (40°) — духовное развитие'),
('Semisquare', 45.00, 2.00, 'minor', 'tense', 'orange', 'Полуквадрат (45°) — лёгкое напряжение'),
('Quintile', 72.00, 2.00, 'minor', 'harmonious', 'purple', 'Квинтиль (72°) — творческий талант'),
('Binonagon', 80.00, 1.50, 'minor', 'harmonious', 'light_purple', 'Бинонагон (80°) — духовная сила'),
('Sentagon', 100.00, 1.50, 'minor', 'tense', 'light_red', 'Сентагон (100°) — кармическое напряжение'),
('Tridecile', 108.00, 1.50, 'minor', 'harmonious', 'light_green', 'Тридециль (108°) — высшая гармония'),
('Sesquiquadrate', 135.00, 2.00, 'minor', 'tense', 'orange', 'Полутораквадрат (135°) — среднее напряжение'),
('Biquintile', 144.00, 2.00, 'minor', 'harmonious', 'purple', 'Биквинтиль (144°) — двойной талант'),
('Quincunx', 150.00, 2.00, 'minor', 'neutral', 'gray', 'Квинконс (150°) — необходимость адаптации')

ON CONFLICT (aspect_type) DO UPDATE SET
    exact_angle = EXCLUDED.exact_angle,
    base_orb = EXCLUDED.base_orb,
    class = EXCLUDED.class,
    character = EXCLUDED.character,
    color = EXCLUDED.color,
    description = EXCLUDED.description;

-- Verify
SELECT 'Inserted ' || COUNT(*) || ' aspect types' as status FROM ref_aspect_types;

-- ============================================================================
-- КРОК 3: Заповнити ref_configuration_types (4 типи)
-- ============================================================================

INSERT INTO ref_configuration_types (type, rules, description, interpretation) VALUES
('Grand_Trine',
 '{"min_planets": 3, "required_aspects": ["trine"], "structure": "closed_triangle", "angle_step_deg": 120, "max_orb_deg": 5}'::jsonb,
 'Три планеты, образующие замкнутый треугольник из тринов (~120° друг от друга).',
 'Сильный внутренний ресурс и гармония в стихии (огонь/земля/воздух/вода). Может давать лень или самодостаточность.'),

('T_Square',
 '{"min_planets": 3, "required_aspects": ["square", "opposition"], "structure": "T_shape", "apex_required": true, "max_orb_deg": 6}'::jsonb,
 'Две планеты в оппозиции, обе делают квадрат к третьей (апекс).',
 'Сильное внутреннее напряжение и динамика; апексная планета показывает главный вектор действий и кризисов.'),

('Grand_Cross',
 '{"min_planets": 4, "required_aspects": ["square", "opposition"], "structure": "cross", "angle_step_deg": 90, "max_orb_deg": 6}'::jsonb,
 'Четыре планеты образуют крест: две оппозиции пересекаются под прямым углом.',
 'Максимальное напряжение и испытания; человек вынужден постоянно балансировать противоположности. Огромный потенциал при проработке.'),

('Yod',
 '{"min_planets": 3, "required_aspects": ["quincunx", "sextile"], "structure": "finger_of_god", "apex_required": true, "max_orb_deg": 3}'::jsonb,
 'Две планеты в секстиле, обе делают квинконс (150°) к третьей (апекс).',
 'Палец Судьбы или Божий перст. Указывает на кармическую задачу, фатальность событий в сфере апексной планеты.')

ON CONFLICT (type) DO UPDATE SET
    rules = EXCLUDED.rules,
    description = EXCLUDED.description,
    interpretation = EXCLUDED.interpretation;

-- Verify
SELECT 'Inserted ' || COUNT(*) || ' configuration types' as status FROM ref_configuration_types;

-- ============================================================================
-- КРОК 4: Заповнити ref_cosmogram_patterns (7 паттернів Джонса)
-- ============================================================================

INSERT INTO ref_cosmogram_patterns (pattern_type, criteria, description, psychological_meaning) VALUES
('Bundle',
 '{"max_arc_deg": 120, "min_planets": 10, "cluster_type": "tight"}'::jsonb,
 'Все планеты сосредоточены в дуге не более 120°.',
 'Узкая специализация, концентрация на одной сфере жизни. Человек может быть гением в своей области, но ограничен в других.'),

('Bowl',
 '{"max_arc_deg": 180, "min_planets": 10, "empty_hemisphere": true}'::jsonb,
 'Все планеты в одной половине круга (180°), другая половина пуста.',
 'Человек-миссионер, стремящийся заполнить пустоту. Сильная направленность на внешний мир или внутренний, в зависимости от полусферы.'),

('Bucket',
 '{"handle_planet": true, "main_group_arc": 180, "handle_opposition": true}'::jsonb,
 'Большинство планет в одной половине, одна планета (ручка) в противоположной стороне.',
 'Планета-ручка — главный инструмент реализации. Через неё человек выражает энергию всей карты.'),

('Locomotive',
 '{"empty_arc_deg": 120, "occupied_arc_deg": 240, "leading_planet": true}'::jsonb,
 'Планеты занимают 2/3 круга (240°), оставляя пустым 1/3 (120°). Есть ведущая планета.',
 'Динамичный тип, постоянное движение вперёд. Ведущая планета задаёт направление развития.'),

('Seesaw',
 '{"two_groups": true, "opposition_axis": true, "min_gap_deg": 60}'::jsonb,
 'Планеты разделены на две противоположные группы с пустотами между ними.',
 'Постоянные колебания между двумя полюсами жизни. Человек-дипломат, балансирующий между крайностями.'),

('Splay',
 '{"irregular_distribution": true, "multiple_gaps": true, "no_pattern": true}'::jsonb,
 'Планеты распределены неравномерно, несколько групп и пустот, нет чёткой структуры.',
 'Индивидуалист, не вписывающийся в стандартные рамки. Многогранная личность с разнообразными интересами.'),

('Splash',
 '{"even_distribution": true, "max_gap_deg": 60, "all_sectors_occupied": true}'::jsonb,
 'Планеты равномерно распределены по всему кругу, нет больших пустот.',
 'Универсальность, разносторонность. Человек интересуется всем понемногу, но может не хватать глубины.')

ON CONFLICT (pattern_type) DO UPDATE SET
    criteria = EXCLUDED.criteria,
    description = EXCLUDED.description,
    psychological_meaning = EXCLUDED.psychological_meaning;

-- Verify
SELECT 'Inserted ' || COUNT(*) || ' cosmogram patterns' as status FROM ref_cosmogram_patterns;

-- ============================================================================
-- ПІДСУМОК
-- ============================================================================

SELECT 
    'ref_aspect_types' as table_name, 
    COUNT(*) as count,
    '18 expected' as expected
FROM ref_aspect_types
UNION ALL
SELECT 
    'ref_configuration_types', 
    COUNT(*),
    '4 expected'
FROM ref_configuration_types
UNION ALL
SELECT 
    'ref_cosmogram_patterns', 
    COUNT(*),
    '7 expected'
FROM ref_cosmogram_patterns;

COMMIT;

-- ============================================================================
-- ГОТОВО!
-- ============================================================================
-- Довідники оновлено, користувацькі дані не торкнуті.
-- 
-- Наступний крок: перерахувати похідні дані для існуючих користувачів
-- ============================================================================

