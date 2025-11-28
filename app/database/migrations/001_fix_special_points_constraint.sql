-- ============================================================================
-- Migration: Fix special points constraint
-- ============================================================================
-- Обновляем constraint для natal_special_points, чтобы соответствовать
-- актуальным названиям точек
-- ============================================================================

-- Удаляем старый constraint
ALTER TABLE natal_special_points DROP CONSTRAINT IF EXISTS valid_point_type;

-- Создаём новый constraint с правильными названиями
ALTER TABLE natal_special_points ADD CONSTRAINT valid_point_type CHECK (point IN (
    -- Лунные узлы (только истинные)
    'TrueNorthNode',      -- Раху (истинный Северный узел)
    'TrueSouthNode',      -- Кету (истинный Южный узел)

    -- Чёрная и Белая Луна (только истинные/осцилирующие)
    'BlackMoon',          -- Лилит (истинная осцилирующая)
    'WhiteMoon',          -- Селена (анти-Лилит)

    -- Арабские части
    'Fortune',            -- Колесо Фортуны (Part of Fortune)

    -- Другие важные точки
    'Vertex',             -- Вертекс
    'AntiVertex',         -- Анти-Вертекс
    'Chiron'              -- Хирон
));

