-- 053: make Person the canonical client-profile identity while retaining the
-- chart-based columns for one compatibility cycle.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE persons
    ADD COLUMN IF NOT EXISTS primary_chart_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- Any chart that already owns client history or a relationship must have a
-- Person before the new foreign keys can be backfilled.
CREATE TEMP TABLE IF NOT EXISTS _profile_person_backfill (
    user_id UUID PRIMARY KEY,
    person_id UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO _profile_person_backfill (user_id, person_id)
SELECT u.user_id, uuid_generate_v4()
FROM users u
WHERE u.person_id IS NULL
  AND (
      EXISTS (SELECT 1 FROM consultations c WHERE c.user_id = u.user_id)
      OR EXISTS (SELECT 1 FROM call_sessions cs WHERE cs.user_id = u.user_id)
      OR EXISTS (SELECT 1 FROM consultation_transcripts ct WHERE ct.user_id = u.user_id)
      OR EXISTS (SELECT 1 FROM client_memory_entries cme WHERE cme.user_id = u.user_id)
      OR EXISTS (
          SELECT 1 FROM client_relationships cr
          WHERE cr.user_id = u.user_id OR cr.related_user_id = u.user_id
      )
  )
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO persons (
    person_id, astrologer_id, first_name, last_name, display_name,
    email, phone, messenger, tags, notes, created_at, updated_at
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
FROM _profile_person_backfill b
JOIN users u ON u.user_id = b.user_id
ON CONFLICT (person_id) DO NOTHING;

UPDATE users u
SET person_id = b.person_id
FROM _profile_person_backfill b
WHERE u.user_id = b.user_id
  AND u.person_id IS NULL;

ALTER TABLE consultations
    ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(person_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS chart_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE call_sessions
    ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(person_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS chart_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

ALTER TABLE consultation_transcripts
    ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(person_id) ON DELETE SET NULL;

ALTER TABLE client_memory_entries
    ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(person_id) ON DELETE SET NULL;

-- Person is now sufficient ownership; legacy chart pointers remain nullable for
-- compatibility and chart-specific context.
ALTER TABLE consultations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE call_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE consultation_transcripts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE client_memory_entries ALTER COLUMN user_id DROP NOT NULL;

-- Legacy chart pointers must no longer cascade-delete Person-owned history.
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_user_id_fkey;
ALTER TABLE consultations
    ADD CONSTRAINT consultations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS call_sessions_user_id_fkey;
ALTER TABLE call_sessions
    ADD CONSTRAINT call_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE consultation_transcripts DROP CONSTRAINT IF EXISTS consultation_transcripts_user_id_fkey;
ALTER TABLE consultation_transcripts
    ADD CONSTRAINT consultation_transcripts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE client_memory_entries DROP CONSTRAINT IF EXISTS client_memory_entries_user_id_fkey;
ALTER TABLE client_memory_entries
    ADD CONSTRAINT client_memory_entries_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;

UPDATE consultations c
SET person_id = u.person_id,
    chart_id = COALESCE(c.chart_id, c.user_id)
FROM users u
WHERE c.user_id = u.user_id
  AND (c.person_id IS NULL OR c.chart_id IS NULL);

UPDATE call_sessions cs
SET person_id = u.person_id,
    chart_id = COALESCE(cs.chart_id, cs.user_id)
FROM users u
WHERE cs.user_id = u.user_id
  AND (cs.person_id IS NULL OR cs.chart_id IS NULL);

UPDATE consultation_transcripts ct
SET person_id = u.person_id
FROM users u
WHERE ct.user_id = u.user_id
  AND ct.person_id IS NULL;

UPDATE client_memory_entries cme
SET person_id = u.person_id
FROM users u
WHERE cme.user_id = u.user_id
  AND cme.person_id IS NULL;

CREATE TABLE IF NOT EXISTS person_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
    related_person_id UUID NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
    relation_label VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT person_relationship_not_self CHECK (person_id <> related_person_id),
    CONSTRAINT uq_person_relationship_owner_pair UNIQUE (astrologer_id, person_id, related_person_id)
);

INSERT INTO person_relationships (
    astrologer_id, person_id, related_person_id, relation_label, notes, created_at, updated_at
)
SELECT
    cr.astrologer_id,
    owner.person_id,
    related.person_id,
    cr.relation_label,
    cr.notes,
    cr.created_at,
    cr.updated_at
FROM client_relationships cr
JOIN users owner ON owner.user_id = cr.user_id
JOIN users related ON related.user_id = cr.related_user_id
WHERE owner.person_id IS NOT NULL
  AND related.person_id IS NOT NULL
  AND owner.person_id <> related.person_id
ON CONFLICT (astrologer_id, person_id, related_person_id) DO NOTHING;

-- Deterministic default: oldest owned natal chart, then oldest owned chart.
UPDATE persons p
SET primary_chart_id = (
    SELECT u.user_id
    FROM users u
    WHERE u.person_id = p.person_id
      AND u.astrologer_id = p.astrologer_id
    ORDER BY
        CASE WHEN COALESCE(u.chart_kind, 'birth') = 'birth' THEN 0 ELSE 1 END,
        u.created_at ASC NULLS LAST,
        u.user_id ASC
    LIMIT 1
)
WHERE p.primary_chart_id IS NULL
  AND EXISTS (
      SELECT 1 FROM users owned
      WHERE owned.person_id = p.person_id
        AND owned.astrologer_id = p.astrologer_id
  );

CREATE INDEX IF NOT EXISTS idx_persons_primary_chart_id
    ON persons(primary_chart_id);
CREATE INDEX IF NOT EXISTS idx_consultations_person_id
    ON consultations(astrologer_id, person_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_call_sessions_person_id
    ON call_sessions(astrologer_id, person_id, created_at);
CREATE INDEX IF NOT EXISTS idx_consultation_transcripts_person_id
    ON consultation_transcripts(astrologer_id, person_id, created_at);
CREATE INDEX IF NOT EXISTS idx_client_memory_person_id
    ON client_memory_entries(astrologer_id, person_id, created_at)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_person_relationships_owner
    ON person_relationships(astrologer_id, person_id);
CREATE INDEX IF NOT EXISTS idx_person_relationships_related
    ON person_relationships(astrologer_id, related_person_id);

CREATE TABLE IF NOT EXISTS person_profile_migration_metrics (
    migration VARCHAR(32) PRIMARY KEY,
    created_persons INTEGER NOT NULL,
    unlinked_history_rows INTEGER NOT NULL,
    unresolved_relationship_rows INTEGER NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO person_profile_migration_metrics (
    migration, created_persons, unlinked_history_rows, unresolved_relationship_rows, recorded_at
)
SELECT
    '053',
    (SELECT count(*) FROM _profile_person_backfill),
    (
        (SELECT count(*) FROM consultations WHERE person_id IS NULL)
        + (SELECT count(*) FROM call_sessions WHERE person_id IS NULL)
        + (SELECT count(*) FROM consultation_transcripts WHERE person_id IS NULL)
        + (SELECT count(*) FROM client_memory_entries WHERE person_id IS NULL)
    ),
    (
        SELECT count(*)
        FROM client_relationships cr
        LEFT JOIN users owner ON owner.user_id = cr.user_id
        LEFT JOIN users related ON related.user_id = cr.related_user_id
        WHERE owner.person_id IS NULL OR related.person_id IS NULL
    ),
    CURRENT_TIMESTAMP
ON CONFLICT (migration) DO UPDATE SET
    created_persons = EXCLUDED.created_persons,
    unlinked_history_rows = EXCLUDED.unlinked_history_rows,
    unresolved_relationship_rows = EXCLUDED.unresolved_relationship_rows,
    recorded_at = EXCLUDED.recorded_at;

COMMENT ON COLUMN persons.primary_chart_id IS 'Explicit default owned chart for the client profile';
COMMENT ON COLUMN consultations.person_id IS 'Canonical client identity; user_id retained temporarily for compatibility';
COMMENT ON COLUMN consultations.chart_id IS 'Optional chart context for this consultation';
COMMENT ON COLUMN call_sessions.person_id IS 'Canonical client identity; user_id retained temporarily for compatibility';
COMMENT ON COLUMN call_sessions.chart_id IS 'Optional chart context for this call';
