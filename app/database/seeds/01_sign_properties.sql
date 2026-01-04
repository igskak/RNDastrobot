-- ============================================================================
-- Reference Data: Sign Properties
-- ============================================================================
-- This file populates the ref_sign_properties table with zodiac sign data
-- ============================================================================

-- ============================================================================
-- Classical Dignity System (Western Astrology)
-- Based on: Ptolemy, William Lilly, and modern Western tradition
-- Source: Астрокурс_main.txt (for co-rulers)
-- ============================================================================
-- Ruler: Planet that rules the sign (domicile)
-- Co-ruler: Second ruler of the sign (по Астрокурсу)
-- Exaltation: Planet that is exalted in the sign
-- Detriment: Planet in detriment (opposite of ruler)
-- Fall: Planet in fall (opposite of exaltation)
-- ============================================================================

INSERT INTO ref_sign_properties (sign, element, mode, gender, zone, life_quadrant, ruler, co_ruler, exaltation, detriment, fall) VALUES
-- Fire Signs (Brahma - Creation/Impulse)
('Aries',       'Fire',  'Cardinal', 'Masculine', 'Brahma', 'Childhood', 'Mars',    NULL,        'Sun',     'Venus',   'Saturn'),
('Leo',         'Fire',  'Fixed',    'Masculine', 'Brahma', 'Youth',     'Sun',     NULL,        NULL,      'Saturn',  NULL),
('Sagittarius', 'Fire',  'Mutable',  'Masculine', 'Brahma', 'Maturity',  'Jupiter', 'Neptune',   NULL,      'Mercury', NULL),

-- Earth Signs (Material plane - dense world, not assigned to Trimurti zones)
('Taurus',      'Earth', 'Fixed',    'Feminine',  'Brahma', 'Childhood', 'Venus',   NULL,        'Moon',    'Mars',    NULL),
('Virgo',       'Earth', 'Mutable',  'Feminine',  'Vishnu', 'Youth',     'Mercury', 'Proserpina','Mercury', 'Jupiter', 'Venus'),
('Capricorn',   'Earth', 'Cardinal', 'Feminine',  'Shiva',  'Maturity',  'Saturn',  'Uranus',    'Mars',    'Moon',    'Jupiter'),

-- Air Signs (Shiva - Dissolution/Liberation)
('Gemini',      'Air',   'Mutable',  'Masculine', 'Brahma', 'Childhood', 'Mercury', NULL,        NULL,      'Jupiter', NULL),
('Libra',       'Air',   'Cardinal', 'Masculine', 'Vishnu', 'Youth',     'Venus',   'Chiron',    'Saturn',  'Mars',    'Sun'),
('Aquarius',    'Air',   'Fixed',    'Masculine', 'Shiva',  'Maturity',  'Uranus',  'Saturn',    NULL,      'Sun',     NULL),

-- Water Signs (Vishnu - Preservation/Life)
('Cancer',      'Water', 'Cardinal', 'Feminine',  'Brahma', 'Childhood', 'Moon',    NULL,        'Jupiter', 'Saturn',  'Mars'),
('Scorpio',     'Water', 'Fixed',    'Feminine',  'Vishnu', 'Youth',     'Pluto',   'Mars',      NULL,      'Venus',   'Moon'),
('Pisces',      'Water', 'Mutable',  'Feminine',  'Shiva',  'Maturity',  'Neptune', 'Jupiter',   'Venus',   'Mercury', 'Mercury')
ON CONFLICT (sign) DO UPDATE SET co_ruler = EXCLUDED.co_ruler;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' zodiac signs' as status FROM ref_sign_properties;

