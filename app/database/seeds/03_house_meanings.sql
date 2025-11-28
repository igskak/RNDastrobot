-- ============================================================================
-- Reference Data: House Meanings
-- ============================================================================
-- This file populates the ref_house_meanings table with house interpretations
-- ============================================================================

INSERT INTO ref_house_meanings (house_number, theme_keywords, extended_description, main_topics) VALUES
(1, 'Self, Identity, Appearance, First Impressions',
    'The house of self and personality. Represents how you present yourself to the world, your physical appearance, and your approach to life.',
    '["identity", "appearance", "personality", "vitality", "self-expression"]'),

(2, 'Values, Money, Possessions, Self-Worth',
    'The house of personal resources and values. Governs material possessions, earning ability, and what you value most.',
    '["finances", "possessions", "values", "self-worth", "resources"]'),

(3, 'Communication, Learning, Siblings, Short Trips',
    'The house of communication and immediate environment. Covers learning, siblings, neighbors, and short-distance travel.',
    '["communication", "learning", "siblings", "neighbors", "short_travel", "writing"]'),

(4, 'Home, Family, Roots, Private Life',
    'The house of home and family. Represents your roots, ancestry, home environment, and emotional foundation.',
    '["home", "family", "roots", "parents", "emotional_foundation", "real_estate"]'),

(5, 'Creativity, Romance, Children, Self-Expression',
    'The house of creativity and pleasure. Governs romance, children, creative expression, and recreational activities.',
    '["creativity", "romance", "children", "pleasure", "hobbies", "self_expression"]'),

(6, 'Health, Work, Service, Daily Routines',
    'The house of health and service. Covers daily work, health habits, service to others, and pets.',
    '["health", "work", "service", "daily_routines", "pets", "wellness"]'),

(7, 'Partnerships, Marriage, Relationships, Contracts',
    'The house of partnerships. Represents marriage, business partnerships, open enemies, and one-on-one relationships.',
    '["marriage", "partnerships", "relationships", "contracts", "cooperation", "open_enemies"]'),

(8, 'Transformation, Shared Resources, Death, Rebirth',
    'The house of transformation and shared resources. Governs inheritance, taxes, death, rebirth, and deep psychological processes.',
    '["transformation", "shared_resources", "inheritance", "death", "rebirth", "psychology", "occult"]'),

(9, 'Philosophy, Higher Education, Long Travel, Beliefs',
    'The house of higher learning and expansion. Covers philosophy, religion, higher education, and long-distance travel.',
    '["philosophy", "higher_education", "religion", "long_travel", "beliefs", "publishing", "foreign_cultures"]'),

(10, 'Career, Public Image, Reputation, Achievements',
    'The house of career and public standing. Represents professional life, reputation, and social status.',
    '["career", "public_image", "reputation", "achievements", "authority", "social_status"]'),

(11, 'Friends, Groups, Hopes, Humanitarian Causes',
    'The house of friendships and aspirations. Governs friends, groups, social networks, and hopes for the future.',
    '["friends", "groups", "social_networks", "hopes", "wishes", "humanitarian_causes", "technology"]'),

(12, 'Spirituality, Subconscious, Isolation, Hidden Matters',
    'The house of the subconscious and spirituality. Represents hidden enemies, self-undoing, spirituality, and transcendence.',
    '["spirituality", "subconscious", "isolation", "hidden_enemies", "karma", "meditation", "hospitals"]')
ON CONFLICT (house_number) DO NOTHING;

-- Verify insertion
SELECT 'Inserted ' || COUNT(*) || ' house meanings' as status FROM ref_house_meanings;

