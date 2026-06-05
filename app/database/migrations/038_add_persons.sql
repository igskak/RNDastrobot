CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS persons (
    person_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    email VARCHAR(255),
    phone VARCHAR(50),
    messenger VARCHAR(255),
    tags JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_persons_astrologer_name
    ON persons(astrologer_id, last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_persons_astrologer_created
    ON persons(astrologer_id, created_at);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(person_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_astrologer_person_id
    ON users(astrologer_id, person_id);

CREATE TEMP TABLE IF NOT EXISTS _person_backfill (
    user_id UUID PRIMARY KEY,
    person_id UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO _person_backfill (user_id, person_id)
SELECT u.user_id, uuid_generate_v4()
FROM users u
WHERE u.person_id IS NULL
  AND COALESCE(u.chart_kind, 'birth') = 'birth'
  AND (
      NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') IS NOT NULL
      OR u.email IS NOT NULL
      OR u.phone IS NOT NULL
      OR u.messenger IS NOT NULL
  )
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO persons (
    person_id,
    astrologer_id,
    first_name,
    last_name,
    display_name,
    email,
    phone,
    messenger,
    tags,
    notes,
    created_at,
    updated_at
)
SELECT
    b.person_id,
    u.astrologer_id,
    u.first_name,
    u.last_name,
    NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
    u.email,
    u.phone,
    u.messenger,
    COALESCE(u.tags, '[]'::jsonb),
    u.notes,
    COALESCE(u.created_at, CURRENT_TIMESTAMP),
    COALESCE(u.updated_at, CURRENT_TIMESTAMP)
FROM _person_backfill b
JOIN users u ON u.user_id = b.user_id
ON CONFLICT (person_id) DO NOTHING;

UPDATE users u
SET person_id = b.person_id
FROM _person_backfill b
WHERE u.user_id = b.user_id
  AND u.person_id IS NULL;

COMMENT ON TABLE persons IS 'Люди как CRM/contact entity, отдельно от карт-источников';
COMMENT ON COLUMN users.person_id IS 'Опциональная связь карты-источника с человеком';
