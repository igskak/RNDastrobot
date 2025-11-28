-- ============================================================================
-- Reference Data: Chakra Mapping
-- ============================================================================
-- This file populates the ref_chakra_mapping table with planet-chakra associations
-- ============================================================================

INSERT INTO ref_chakra_mapping (planet, chakra_number, chakra_name, function_description) VALUES
('Saturn',  1, 'Root (Muladhara)',       'Survival, grounding, physical security, material foundation'),
('Moon',    2, 'Sacral (Svadhisthana)',  'Emotions, sexuality, creativity, pleasure, relationships'),
('Sun',     3, 'Solar Plexus (Manipura)', 'Personal power, will, ego, self-esteem, vitality'),
('Venus',   4, 'Heart (Anahata)',        'Love, compassion, harmony, relationships, beauty'),
('Mercury', 5, 'Throat (Vishuddha)',     'Communication, self-expression, truth, creativity'),
('Jupiter', 6, 'Third Eye (Ajna)',       'Intuition, wisdom, vision, higher knowledge, insight'),
('Neptune', 7, 'Crown (Sahasrara)',      'Spirituality, transcendence, cosmic consciousness, unity')
ON CONFLICT (planet) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' chakra mappings' as status FROM ref_chakra_mapping;

