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
 'Тонко настроенный кармический вектор; необходимость переключаться и подстраиваться, «палец судьбы» на теме апексной планеты.'),

-- Bisextile
('Bisextile',
 '{
   "min_planets": 3,
   "required_aspects": ["sextile", "trine"],
   "aspect_count": {"sextile": 2, "trine": 1},
   "structure": "triangle_with_apex",
   "apex_aspects": ["sextile"],
   "base_aspect": "trine",
   "max_orb_deg": 6
 }'::jsonb,
 'Три планеты: две в трине, каждая в секстиле к третьей (вершина).',
 'Амортизатор жизненных затруднений. Действует дискретно при попадании в трудности. Секстили побуждают к действию, меньше пассивности. Начинать с вершины, заканчивать по трину.'),

-- Trapezoid
('Trapezoid',
 '{
   "min_planets": 4,
   "required_aspects": ["sextile", "trine", "opposition"],
   "aspect_count": {"sextile": 3, "trine": 2, "opposition": 1},
   "structure": "trapezoid",
   "max_orb_deg": 6
 }'::jsonb,
 'Четыре планеты: 3 секстиля + 2 трина + 1 оппозиция.',
 'Хорошая конфигурация, сочетает в равной мере напряжение и возможности получения результатов. Верхнее основание (секстиль) - накопление энергии, результат после проработки оппозиции.'),

-- Skewed Sail
('Skewed_Sail',
 '{
   "min_planets": 3,
   "required_aspects": ["sextile", "trine", "opposition"],
   "aspect_count": {"sextile": 1, "trine": 1, "opposition": 1},
   "structure": "triangle_mixed",
   "max_orb_deg": 6
 }'::jsonb,
 'Три планеты: 1 секстиль + 1 трин + 1 оппозиция.',
 'Полезная конфигурация, не дает бездельничать. Оппозиция создает напряжение, третья планета помогает в работе с ней. Есть гармоничные пути решения и энергия для реализации.'),

-- Chariot (Closed Envelope)
('Chariot',
 '{
   "min_planets": 4,
   "required_aspects": ["sextile", "trine", "opposition"],
   "aspect_count": {"sextile": 2, "trine": 2, "opposition": 2},
   "structure": "closed_envelope",
   "max_orb_deg": 6
 }'::jsonb,
 'Четыре планеты: 2 секстиля + 2 трина + 2 оппозиции (Повозка, конверт закрытый).',
 'Большие творческие возможности через труд по оппозициям. Развитие рывками: застой сменяется активностью. Кризисы чередуются с отдыхом по трину и секстилю. Сдержанность и активность в характере.'),

-- Sail
('Sail',
 '{
   "min_planets": 4,
   "required_aspects": ["trine", "sextile"],
   "aspect_count": {"trine": 3, "sextile": 2},
   "structure": "composite",
   "components": ["Grand_Trine", "Bisextile"],
   "max_orb_deg": 6
 }'::jsonb,
 'Большой Тригон + Бисекстиль (4 планеты).',
 'Разнообразные способности, динамическая жизнь с известной долей напряжения и хорошими возможностями для реализации. Включает планета на вершине Бисекстиля. Работа по оппозиции, результаты по Тригону.'),

-- Open Envelope
('Open_Envelope',
 '{
   "min_planets": 5,
   "required_aspects": ["sextile", "trine", "opposition"],
   "aspect_count": {"sextile": 4, "trine": 3, "opposition": 2},
   "structure": "composite",
   "components": ["Chariot", "Bisextile"],
   "max_orb_deg": 6
 }'::jsonb,
 'Повозка + Бисекстиль (5 планет, конверт открытый).',
 'Планета на вершине Бисекстиля дает дополнительные возможности реализовать потенциал Повозки. Она становится ведущей в конфигурации. Кризисы и проработка оппозиций сохраняются.'),

-- Star of David
('Star_of_David',
 '{
   "min_planets": 6,
   "required_aspects": ["trine", "sextile"],
   "aspect_count": {"trine": 6, "sextile": 6},
   "structure": "double_grand_trine",
   "components": ["Grand_Trine", "Grand_Trine"],
   "max_orb_deg": 6,
   "element_groups": 2
 }'::jsonb,
 'Шесть планет: два Больших Тригона, соединенных секстилями.',
 'Очень сильная конфигурация. Защита, помощь, поддержка. Много наработок и талантов в различных сферах. Разносторонний, уравновешенный человек. Мало кризисов, все легко дается. Риск: расслабление, нет мотива работать над собой.')

ON CONFLICT (type) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' configuration types' as status FROM ref_configuration_types;

