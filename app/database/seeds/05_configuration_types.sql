-- ============================================================================
-- Reference Data: Configuration Types
-- ============================================================================
-- This file populates the ref_configuration_types table with aspect configurations
-- Based on: ref/ref_configuration_types.json
-- ============================================================================

INSERT INTO ref_configuration_types (type, rules, description, interpretation) VALUES
-- Grand Trine
('Grand_Trine', 
 '{
   "min_planets": 3,
   "required_aspects": ["trine"],
   "structure": "closed_triangle",
   "angle_step_deg": 120,
   "max_orb_deg": 5
 }'::jsonb,
 'Три планеты, образующие замкнутый треугольник из тринов (~120° друг от друга).',
 'Сильный внутренний ресурс, естественные таланты, лёгкость самореализации по стихии большого трина.'),

-- T-Square
('T_Square',
 '{
   "min_planets": 3,
   "required_aspects": ["square", "opposition"],
   "structure": "triangle_with_apex",
   "pattern": "две планеты в оппозиции, обе в квадрате к третьей (апексной) планете",
   "max_orb_deg": 5
 }'::jsonb,
 'Две планеты в оппозиции, обе делают квадрат к третьей (апекс).',
 'Сильное внутреннее напряжение и динамика; апексная планета показывает главный вектор действий и кризисов.'),

-- Grand Cross
('Grand_Cross',
 '{
   "min_planets": 4,
   "required_aspects": ["square", "opposition"],
   "structure": "closed_cross",
   "pattern": "четыре планеты, расположенные примерно через 90°, образуют 4 квадрата и 2 оппозиции",
   "max_orb_deg": 5
 }'::jsonb,
 'Четыре планеты через ~90°, дающие 4 квадрата и 2 оппозиции (крест).',
 'Жизнь как серия постоянных испытаний и задач; мощный потенциал при осознанной проработке.'),

-- Yod
('Yod',
 '{
   "min_planets": 3,
   "required_aspects": ["quincunx", "sextile"],
   "structure": "finger_of_god",
   "pattern": "две планеты в секстиле, обе в квиконсе к третьей (апексной) планете",
   "max_orb_deg": 3
 }'::jsonb,
 'Две планеты в секстиле, обе делают квиконс к третьей (апекс).',
 'Тонко настроенный кармический вектор; необходимость переключаться и подстраиваться, «палец судьбы» на теме апексной планеты.')

ON CONFLICT (type) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' configuration types' as status FROM ref_configuration_types;

