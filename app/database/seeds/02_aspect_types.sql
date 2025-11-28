-- ============================================================================
-- Reference Data: Aspect Types
-- ============================================================================
-- This file populates the ref_aspect_types table with astrological aspects
-- ============================================================================

INSERT INTO ref_aspect_types (aspect_type, exact_angle, base_orb, class, character, color, description) VALUES
-- Major Aspects (базовые орбисы согласно ref/ref_aspect_types.json)
('Conjunction',  0,   5.0, 'major', 'neutral',     NULL,    'Union, fusion, intensification of energies'),
('Sextile',      60,  5.0, 'major', 'harmonious',  'red',   'Opportunity, cooperation, mild harmony'),
('Square',       90,  5.0, 'major', 'tense',       'black', 'Friction, challenge, dynamic tension'),
('Trine',        120, 5.0, 'major', 'harmonious',  'red',   'Flow, ease, natural talents and gifts'),
('Opposition',   180, 5.0, 'major', 'tense',       'black', 'Tension, polarity, awareness through contrast'),

-- Minor Aspects (гармоники и специальные)
('Vigintile',       18,  1.0, 'minor', 'neutral',     'green', '18° aspect, 20th harmonic'),
('Semi_Nonagon',    20,  1.0, 'minor', 'neutral',     'blue',  '20° aspect, semi-nonagon'),
('Semisextile',     30,  2.0, 'minor', 'harmonious',  'red',   'Slight connection, minor adjustment'),
('Decile',          36,  1.0, 'minor', 'neutral',     'green', '36° aspect, 10th harmonic'),
('Nonagon',         40,  1.0, 'minor', 'neutral',     'blue',  '40° aspect, 9th harmonic'),
('Semisquare',      45,  2.0, 'minor', 'tense',       'black', 'Minor friction, irritation'),
('Quintile',        72,  1.0, 'minor', 'neutral',     'green', 'Creative talent, special gifts'),
('Binonagon',       80,  1.0, 'minor', 'neutral',     'blue',  '80° aspect, bi-nonagon'),
('Sentagon',       100,  1.0, 'minor', 'neutral',     'blue',  '100° aspect, sentagon'),
('Tridecile',      108,  1.0, 'minor', 'neutral',     'green', '108° aspect, tridecile'),
('Sesquiquadrate', 135,  2.0, 'minor', 'tense',       'black', 'Persistent minor tension'),
('Biquintile',     144,  1.0, 'minor', 'neutral',     'green', 'Creative expression, artistic ability'),
('Quincunx',       150,  2.0, 'minor', 'harmonious',  'red',   'Adjustment, incompatibility requiring adaptation')
ON CONFLICT (aspect_type) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' aspect types' as status FROM ref_aspect_types;

