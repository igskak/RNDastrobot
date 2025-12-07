-- ============================================================================
-- Reference Data: Planet Orbs
-- ============================================================================
-- Индивидуальные орбисы для каждой планеты/точки по типам аспектов
-- Основано на профессиональных астрологических стандартах
-- ============================================================================

-- Удаляем исключённые аспекты из ref_aspect_types
DELETE FROM ref_aspect_types WHERE aspect_type IN ('Vigintile', 'Semi_Nonagon', 'Binonagon', 'Sentagon');

-- ============================================================================
-- CONJUNCTION (0°) - Соединение
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Conjunction', 12.0),
('Moon', 'Conjunction', 10.0),
('Mercury', 'Conjunction', 7.0),
('Venus', 'Conjunction', 7.0),
('Mars', 'Conjunction', 7.0),
('Jupiter', 'Conjunction', 7.0),
('Saturn', 'Conjunction', 7.0),
('Uranus', 'Conjunction', 5.0),
('Neptune', 'Conjunction', 5.0),
('Pluto', 'Conjunction', 5.0),
('Chiron', 'Conjunction', 5.0),
('TrueNorthNode', 'Conjunction', 3.0),
('TrueSouthNode', 'Conjunction', 3.0),
('BlackMoon', 'Conjunction', 3.0),
('WhiteMoon', 'Conjunction', 3.0),
('Fortune', 'Conjunction', 5.0),
('Vertex', 'Conjunction', 5.0),
('ASC', 'Conjunction', 5.0),
('MC', 'Conjunction', 5.0),
('IC', 'Conjunction', 5.0),
('DSC', 'Conjunction', 5.0);

-- ============================================================================
-- SEMISEXTILE (30°) - Полусекстиль
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Semisextile', 1.5),
('Moon', 'Semisextile', 1.0),
('Mercury', 'Semisextile', 1.0),
('Venus', 'Semisextile', 1.0),
('Mars', 'Semisextile', 1.0),
('Jupiter', 'Semisextile', 1.0),
('Saturn', 'Semisextile', 1.0),
('Uranus', 'Semisextile', 1.0),
('Neptune', 'Semisextile', 1.0),
('Pluto', 'Semisextile', 1.0),
('Chiron', 'Semisextile', 1.0),
('TrueNorthNode', 'Semisextile', 1.0),
('TrueSouthNode', 'Semisextile', 1.0),
('BlackMoon', 'Semisextile', 1.0),
('WhiteMoon', 'Semisextile', 1.0),
('Fortune', 'Semisextile', 1.0),
('Vertex', 'Semisextile', 1.0),
('ASC', 'Semisextile', 1.0),
('MC', 'Semisextile', 1.0),
('IC', 'Semisextile', 1.0),
('DSC', 'Semisextile', 1.0);

-- ============================================================================
-- DECILE (36°) - Дециль
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Decile', 1.5),
('Moon', 'Decile', 1.0),
('Mercury', 'Decile', 1.0),
('Venus', 'Decile', 1.0),
('Mars', 'Decile', 1.0),
('Jupiter', 'Decile', 1.0),
('Saturn', 'Decile', 1.0),
('Uranus', 'Decile', 1.0),
('Neptune', 'Decile', 1.0),
('Pluto', 'Decile', 1.0),
('Chiron', 'Decile', 1.0),
('TrueNorthNode', 'Decile', 1.0),
('TrueSouthNode', 'Decile', 1.0),
('BlackMoon', 'Decile', 1.0),
('WhiteMoon', 'Decile', 1.0),
('Fortune', 'Decile', 1.0),
('Vertex', 'Decile', 1.0),
('ASC', 'Decile', 1.0),
('MC', 'Decile', 1.0),
('IC', 'Decile', 1.0),
('DSC', 'Decile', 1.0);

-- ============================================================================
-- NONAGON (40°) - Нонагон
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Nonagon', 1.5),
('Moon', 'Nonagon', 1.5),
('Mercury', 'Nonagon', 1.0),
('Venus', 'Nonagon', 1.0),
('Mars', 'Nonagon', 1.0),
('Jupiter', 'Nonagon', 1.0),
('Saturn', 'Nonagon', 1.0),
('Uranus', 'Nonagon', 1.0),
('Neptune', 'Nonagon', 1.0),
('Pluto', 'Nonagon', 1.0),
('Chiron', 'Nonagon', 1.0),
('TrueNorthNode', 'Nonagon', 1.0),
('TrueSouthNode', 'Nonagon', 1.0),
('BlackMoon', 'Nonagon', 1.0),
('WhiteMoon', 'Nonagon', 1.0),
('Fortune', 'Nonagon', 1.0),
('Vertex', 'Nonagon', 1.0),
('ASC', 'Nonagon', 1.0),
('MC', 'Nonagon', 1.0),
('IC', 'Nonagon', 1.0),
('DSC', 'Nonagon', 1.0);

-- ============================================================================
-- SEMISQUARE (45°) - Полуквадрат
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Semisquare', 1.0),
('Moon', 'Semisquare', 1.0),
('Mercury', 'Semisquare', 1.0),
('Venus', 'Semisquare', 1.0),
('Mars', 'Semisquare', 1.0),
('Jupiter', 'Semisquare', 1.0),
('Saturn', 'Semisquare', 1.0),
('Uranus', 'Semisquare', 1.0),
('Neptune', 'Semisquare', 1.0),
('Pluto', 'Semisquare', 1.0),
('Chiron', 'Semisquare', 1.0),
('TrueNorthNode', 'Semisquare', 1.0),
('TrueSouthNode', 'Semisquare', 1.0),
('BlackMoon', 'Semisquare', 1.0),
('WhiteMoon', 'Semisquare', 1.0),
('Fortune', 'Semisquare', 1.0),
('Vertex', 'Semisquare', 1.0),
('ASC', 'Semisquare', 1.0),
('MC', 'Semisquare', 1.0),
('IC', 'Semisquare', 1.0),
('DSC', 'Semisquare', 1.0);

-- ============================================================================
-- SEXTILE (60°) - Секстиль
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Sextile', 10.0),
('Moon', 'Sextile', 8.0),
('Mercury', 'Sextile', 5.0),
('Venus', 'Sextile', 5.0),
('Mars', 'Sextile', 5.0),
('Jupiter', 'Sextile', 5.0),
('Saturn', 'Sextile', 5.0),
('Uranus', 'Sextile', 3.0),
('Neptune', 'Sextile', 3.0),
('Pluto', 'Sextile', 3.0),
('Chiron', 'Sextile', 3.0),
('TrueNorthNode', 'Sextile', 3.0),
('TrueSouthNode', 'Sextile', 3.0),
('BlackMoon', 'Sextile', 3.0),
('WhiteMoon', 'Sextile', 3.0),
('Fortune', 'Sextile', 5.0),
('Vertex', 'Sextile', 5.0),
('ASC', 'Sextile', 5.0),
('MC', 'Sextile', 5.0),
('IC', 'Sextile', 5.0),
('DSC', 'Sextile', 5.0);

-- ============================================================================
-- QUINTILE (72°) - Квинтиль
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Quintile', 3.0),
('Moon', 'Quintile', 3.0),
('Mercury', 'Quintile', 2.0),
('Venus', 'Quintile', 2.0),
('Mars', 'Quintile', 2.0),
('Jupiter', 'Quintile', 2.0),
('Saturn', 'Quintile', 2.0),
('Uranus', 'Quintile', 2.0),
('Neptune', 'Quintile', 2.0),
('Pluto', 'Quintile', 1.0),
('Chiron', 'Quintile', 1.0),
('TrueNorthNode', 'Quintile', 1.0),
('TrueSouthNode', 'Quintile', 1.0),
('BlackMoon', 'Quintile', 1.0),
('WhiteMoon', 'Quintile', 1.0),
('Fortune', 'Quintile', 1.0),
('Vertex', 'Quintile', 1.0),
('ASC', 'Quintile', 1.0),
('MC', 'Quintile', 1.0),
('IC', 'Quintile', 1.0),
('DSC', 'Quintile', 1.0);

-- ============================================================================
-- SQUARE (90°) - Квадратура
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Square', 10.0),
('Moon', 'Square', 8.0),
('Mercury', 'Square', 5.0),
('Venus', 'Square', 5.0),
('Mars', 'Square', 5.0),
('Jupiter', 'Square', 5.0),
('Saturn', 'Square', 5.0),
('Uranus', 'Square', 3.0),
('Neptune', 'Square', 3.0),
('Pluto', 'Square', 3.0),
('Chiron', 'Square', 3.0),
('TrueNorthNode', 'Square', 3.0),
('TrueSouthNode', 'Square', 3.0),
('BlackMoon', 'Square', 3.0),
('WhiteMoon', 'Square', 3.0),
('Fortune', 'Square', 5.0),
('Vertex', 'Square', 5.0),
('ASC', 'Square', 5.0),
('MC', 'Square', 5.0),
('IC', 'Square', 5.0),
('DSC', 'Square', 5.0);

-- ============================================================================
-- TRIDECILE (108°) - Тридециль
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Tridecile', 2.0),
('Moon', 'Tridecile', 2.0),
('Mercury', 'Tridecile', 1.5),
('Venus', 'Tridecile', 1.5),
('Mars', 'Tridecile', 1.5),
('Jupiter', 'Tridecile', 1.5),
('Saturn', 'Tridecile', 1.5),
('Uranus', 'Tridecile', 1.5),
('Neptune', 'Tridecile', 1.5),
('Pluto', 'Tridecile', 1.5),
('Chiron', 'Tridecile', 1.0),
('TrueNorthNode', 'Tridecile', 1.0),
('TrueSouthNode', 'Tridecile', 1.0),
('BlackMoon', 'Tridecile', 1.0),
('WhiteMoon', 'Tridecile', 1.0),
('Fortune', 'Tridecile', 1.0),
('Vertex', 'Tridecile', 1.0),
('ASC', 'Tridecile', 1.0),
('MC', 'Tridecile', 1.0),
('IC', 'Tridecile', 1.0),
('DSC', 'Tridecile', 1.0);

-- ============================================================================
-- TRINE (120°) - Трин
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Trine', 10.0),
('Moon', 'Trine', 8.0),
('Mercury', 'Trine', 5.0),
('Venus', 'Trine', 5.0),
('Mars', 'Trine', 5.0),
('Jupiter', 'Trine', 5.0),
('Saturn', 'Trine', 5.0),
('Uranus', 'Trine', 3.0),
('Neptune', 'Trine', 3.0),
('Pluto', 'Trine', 3.0),
('Chiron', 'Trine', 3.0),
('TrueNorthNode', 'Trine', 3.0),
('TrueSouthNode', 'Trine', 3.0),
('BlackMoon', 'Trine', 3.0),
('WhiteMoon', 'Trine', 3.0),
('Fortune', 'Trine', 5.0),
('Vertex', 'Trine', 5.0),
('ASC', 'Trine', 5.0),
('MC', 'Trine', 5.0),
('IC', 'Trine', 5.0),
('DSC', 'Trine', 5.0);

-- ============================================================================
-- SESQUIQUADRATE (135°) - Полутораквадрат
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Sesquiquadrate', 3.5),
('Moon', 'Sesquiquadrate', 3.5),
('Mercury', 'Sesquiquadrate', 3.0),
('Venus', 'Sesquiquadrate', 3.0),
('Mars', 'Sesquiquadrate', 3.0),
('Jupiter', 'Sesquiquadrate', 2.0),
('Saturn', 'Sesquiquadrate', 2.0),
('Uranus', 'Sesquiquadrate', 2.0),
('Neptune', 'Sesquiquadrate', 2.0),
('Pluto', 'Sesquiquadrate', 2.0),
('Chiron', 'Sesquiquadrate', 1.0),
('TrueNorthNode', 'Sesquiquadrate', 1.0),
('TrueSouthNode', 'Sesquiquadrate', 1.0),
('BlackMoon', 'Sesquiquadrate', 1.0),
('WhiteMoon', 'Sesquiquadrate', 1.0),
('Fortune', 'Sesquiquadrate', 1.0),
('Vertex', 'Sesquiquadrate', 1.0),
('ASC', 'Sesquiquadrate', 1.0),
('MC', 'Sesquiquadrate', 1.0),
('IC', 'Sesquiquadrate', 1.0),
('DSC', 'Sesquiquadrate', 1.0);

-- ============================================================================
-- BIQUINTILE (144°) - Биквинтиль
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Biquintile', 1.5),
('Moon', 'Biquintile', 1.5),
('Mercury', 'Biquintile', 1.0),
('Venus', 'Biquintile', 1.0),
('Mars', 'Biquintile', 1.0),
('Jupiter', 'Biquintile', 1.0),
('Saturn', 'Biquintile', 1.0),
('Uranus', 'Biquintile', 1.0),
('Neptune', 'Biquintile', 1.0),
('Pluto', 'Biquintile', 1.0),
('Chiron', 'Biquintile', 1.0),
('TrueNorthNode', 'Biquintile', 1.0),
('TrueSouthNode', 'Biquintile', 1.0),
('BlackMoon', 'Biquintile', 1.0),
('WhiteMoon', 'Biquintile', 1.0),
('Fortune', 'Biquintile', 1.0),
('Vertex', 'Biquintile', 1.0),
('ASC', 'Biquintile', 1.0),
('MC', 'Biquintile', 1.0),
('IC', 'Biquintile', 1.0),
('DSC', 'Biquintile', 1.0);

-- ============================================================================
-- QUINCUNX (150°) - Квинконс (Инконъюнкт)
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Quincunx', 4.0),
('Moon', 'Quincunx', 4.0),
('Mercury', 'Quincunx', 3.0),
('Venus', 'Quincunx', 3.0),
('Mars', 'Quincunx', 3.0),
('Jupiter', 'Quincunx', 2.0),
('Saturn', 'Quincunx', 2.0),
('Uranus', 'Quincunx', 2.0),
('Neptune', 'Quincunx', 2.0),
('Pluto', 'Quincunx', 2.0),
('Chiron', 'Quincunx', 1.0),
('TrueNorthNode', 'Quincunx', 1.0),
('TrueSouthNode', 'Quincunx', 1.0),
('BlackMoon', 'Quincunx', 1.0),
('WhiteMoon', 'Quincunx', 1.0),
('Fortune', 'Quincunx', 1.0),
('Vertex', 'Quincunx', 1.0),
('ASC', 'Quincunx', 1.0),
('MC', 'Quincunx', 1.0),
('IC', 'Quincunx', 1.0),
('DSC', 'Quincunx', 1.0);

-- ============================================================================
-- OPPOSITION (180°) - Оппозиция
-- ============================================================================
INSERT INTO ref_planet_orbs (planet, aspect_type, orb) VALUES
('Sun', 'Opposition', 12.0),
('Moon', 'Opposition', 10.0),
('Mercury', 'Opposition', 7.0),
('Venus', 'Opposition', 7.0),
('Mars', 'Opposition', 7.0),
('Jupiter', 'Opposition', 7.0),
('Saturn', 'Opposition', 7.0),
('Uranus', 'Opposition', 5.0),
('Neptune', 'Opposition', 5.0),
('Pluto', 'Opposition', 5.0),
('Chiron', 'Opposition', 5.0),
('TrueNorthNode', 'Opposition', 3.0),
('TrueSouthNode', 'Opposition', 3.0),
('BlackMoon', 'Opposition', 3.0),
('WhiteMoon', 'Opposition', 3.0),
('Fortune', 'Opposition', 5.0),
('Vertex', 'Opposition', 5.0),
('ASC', 'Opposition', 5.0),
('MC', 'Opposition', 5.0),
('IC', 'Opposition', 5.0),
('DSC', 'Opposition', 5.0);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'Inserted ' || COUNT(*) || ' planet orb records' as status FROM ref_planet_orbs;
SELECT 'For ' || COUNT(DISTINCT planet) || ' planets/points' as planets FROM ref_planet_orbs;
SELECT 'Across ' || COUNT(DISTINCT aspect_type) || ' aspect types' as aspects FROM ref_planet_orbs;


