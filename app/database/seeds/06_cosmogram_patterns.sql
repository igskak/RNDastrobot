-- ============================================================================
-- Reference Data: Cosmogram Patterns (Jones Patterns)
-- ============================================================================
-- This file populates the ref_cosmogram_patterns table with Jones patterns
-- Based on: ref/ref_cosmogram_patterns.json
-- ============================================================================

INSERT INTO ref_cosmogram_patterns (pattern_type, criteria, description, psychological_meaning) VALUES
-- Bundle
('Bundle',
 '{
   "description_tech": "Все планеты в пределах узкой дуги ≤120°",
   "occupied_arc_max_deg": 120,
   "max_empty_arc_min_deg": 240,
   "cluster_count_max": 1
 }'::jsonb,
 'Связка (Bundle): все планеты собраны в одном компактном секторе круга.',
 'Узкая специализация, сосредоточенность на одной-двух ведущих темах жизни; человек работает «точечно», глубоко в ограниченном наборе сфер.'),

-- Bowl
('Bowl',
 '{
   "description_tech": "Все планеты в пределах ~полукруга, вторая половина в основном пуста.",
   "occupied_arc_min_deg": 120,
   "occupied_arc_max_deg": 210,
   "max_empty_arc_min_deg": 150,
   "cluster_count_max": 2,
   "handle_required": false
 }'::jsonb,
 'Чаша (Bowl): все планеты расположены в одной половине круга, другая половина в основном пуста.',
 'Цельность и самодостаточность; человек ощущает в себе внутренний ресурс, но мир воспринимает через одну «половину» опыта, с ярко выраженным жизненным вектором.'),

-- Bucket
('Bucket',
 '{
   "description_tech": "Почти Чаша + одна планета-«ручка» в пустой половине.",
   "base_pattern": "Bowl",
   "max_empty_arc_min_deg": 150,
   "handle_required": true,
   "handle_min_count": 1,
   "handle_max_count": 2,
   "handle_orb_from_empty_arc_center_max_deg": 20
 }'::jsonb,
 'Ведро/Корзина (Bucket): большинство планет собрано в секторе (как Чаша), но одна планета стоит отдельно, как «ручка».',
 'Сильный фокус через одну ключевую функцию: планета-ручка становится главным каналом самореализации и компенсирует внутренний перекос карты.'),

-- Locomotive
('Locomotive',
 '{
   "description_tech": "Планеты занимают ~240° с относительно равномерным шагом; остаётся крупная пустая дуга ~120°.",
   "occupied_arc_min_deg": 210,
   "occupied_arc_max_deg": 270,
   "max_empty_arc_min_deg": 90,
   "max_empty_arc_max_deg": 150,
   "cluster_count_min": 3,
   "uniformity_required": true
 }'::jsonb,
 'Локомотив (Locomotive): планеты заполняют примерно две трети круга, образуя как бы «колесо поезда» с одной свободной дугой.',
 'Постоянное движение и прогресс; человек воспринимает жизнь как путь, где он последовательно «продавливает» темы, двигаясь вперёд через усилие и инициативу.'),

-- Seesaw
('Seesaw',
 '{
   "description_tech": "Две противостоящие группы планет; между кластерами заметные промежутки, но не формируются ни Чаша, ни Локомотив.",
   "cluster_count_exact": 2,
   "min_planets_per_cluster": 2,
   "max_empty_arc_min_deg": 90,
   "max_empty_arc_max_deg": 150,
   "has_opposition_axis": true
 }'::jsonb,
 'Качели (Seesaw): планеты распределены на две противостоящие группы.',
 'Жизнь как диалог и постоянное балансирование между двумя полюсами; склонность видеть противоположности и искать компромисс или качаться из крайности в крайность.'),

-- Splay
('Splay',
 '{
   "description_tech": "3–4 кластера планет, разделённых крупными пустыми дугами; нет единой доминантной половины круга.",
   "cluster_count_min": 3,
   "cluster_count_max": 4,
   "max_empty_arc_min_deg": 60,
   "max_empty_arc_max_deg": 150,
   "non_uniform_required": true
 }'::jsonb,
 'Растрой (Splay): планеты сгруппированы в несколько разрозненных кластеров.',
 'Нестандартность, многогранность и неоднородность; человек живёт несколькими несхожими сюжетами, его трудно свести к одной линии развития.'),

-- Splash
('Splash',
 '{
   "description_tech": "Планеты более-менее равномерно разбросаны по кругу; нет крупных пустых дуг и выраженных кластеров.",
   "min_empty_arc_max_deg": 60,
   "cluster_count_min": 5,
   "uniformity_required": true
 }'::jsonb,
 'Брызги (Splash): планеты рассыпаны по всему кругу без крупных скоплений.',
 'Разнообразие интересов и опытов; широкая рассеянность внимания, множественность талантов и задач, жизнь как мозаика из многих несвязанных сюжетов.')

ON CONFLICT (pattern_type) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' cosmogram patterns' as status FROM ref_cosmogram_patterns;

