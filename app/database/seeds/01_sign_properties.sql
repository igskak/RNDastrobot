-- ============================================================================
-- Reference Data: Sign Properties
-- ============================================================================
-- This file populates the ref_sign_properties table with zodiac sign data
-- ============================================================================

-- ============================================================================
-- Classical Dignity System (Western Astrology)
-- Based on: Ptolemy, William Lilly, and modern Western tradition
-- ============================================================================
-- Ruler: Planet that rules the sign (domicile)
-- Exaltation: Planet that is exalted in the sign
-- Detriment: Planet in detriment (opposite of ruler)
-- Fall: Planet in fall (opposite of exaltation)
-- ============================================================================

INSERT INTO ref_sign_properties (sign, element, mode, gender, zone, life_quadrant, ruler, exaltation, detriment, fall) VALUES
-- Fire Signs (Brahma - Creation/Impulse)
('Aries',       'Fire',  'Cardinal', 'Masculine', 'Brahma', 'Childhood', 'Mars',    'Sun',     'Venus',   'Saturn'),
('Leo',         'Fire',  'Fixed',    'Masculine', 'Brahma', 'Youth',     'Sun',     NULL,      'Saturn',  NULL),
('Sagittarius', 'Fire',  'Mutable',  'Masculine', 'Brahma', 'Maturity',  'Jupiter', NULL,      'Mercury', NULL),

-- Earth Signs (Material plane - dense world, not assigned to Trimurti zones)
('Taurus',      'Earth', 'Fixed',    'Feminine',  'Brahma', 'Childhood', 'Venus',   'Moon',    'Mars',    NULL),
('Virgo',       'Earth', 'Mutable',  'Feminine',  'Vishnu', 'Youth',     'Mercury', 'Mercury', 'Jupiter', 'Venus'),
('Capricorn',   'Earth', 'Cardinal', 'Feminine',  'Shiva',  'Maturity',  'Saturn',  'Mars',    'Moon',    'Jupiter'),

-- Air Signs (Shiva - Dissolution/Liberation)
('Gemini',      'Air',   'Mutable',  'Masculine', 'Brahma', 'Childhood', 'Mercury', NULL,      'Jupiter', NULL),
('Libra',       'Air',   'Cardinal', 'Masculine', 'Vishnu', 'Youth',     'Venus',   'Saturn',  'Mars',    'Sun'),
('Aquarius',    'Air',   'Fixed',    'Masculine', 'Shiva',  'Maturity',  'Uranus',  NULL,      'Sun',     NULL),

-- Water Signs (Vishnu - Preservation/Life)
('Cancer',      'Water', 'Cardinal', 'Feminine',  'Brahma', 'Childhood', 'Moon',    'Jupiter', 'Saturn',  'Mars'),
('Scorpio',     'Water', 'Fixed',    'Feminine',  'Vishnu', 'Youth',     'Pluto',   NULL,      'Venus',   'Moon'),
('Pisces',      'Water', 'Mutable',  'Feminine',  'Shiva',  'Maturity',  'Neptune', 'Venus',   'Mercury', 'Mercury')
ON CONFLICT (sign) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' zodiac signs' as status FROM ref_sign_properties;

