-- Free moon letters: visitors of the public /moon pages who asked for their new moon and
-- full moon prompts by email. No account; every link carries a signed token (MOON_LINK_SECRET).
--
-- This is the cheap validation of a paid lunar journal, so the table also records what the
-- test measures: confirmations, letters sent, visits to the letter page and interest in the
-- paid journal. The answers people write go to moon_journal_entries below.
-- Birth data and journal entries are personal data (GDPR): POST /api/v1/moon/erase deletes
-- the subscriber and every entry on request.
CREATE TABLE IF NOT EXISTS moon_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'en',
    birth_date DATE NOT NULL,
    birth_time TIME,
    timezone VARCHAR(64) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    place_label VARCHAR(200),
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    consent_at TIMESTAMP NOT NULL,
    confirm_sent_at TIMESTAMP,
    confirmed_at TIMESTAMP,
    unsubscribed_at TIMESTAMP,
    last_lunation_at TIMESTAMP,
    letters_sent INTEGER NOT NULL DEFAULT 0,
    last_opened_at TIMESTAMP,
    opens INTEGER NOT NULL DEFAULT 0,
    journal_interest_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_moon_subscribers_status CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
    CONSTRAINT uq_moon_subscribers_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_moon_subscribers_status ON moon_subscribers (status);

-- One answer to one question of one lunation. The signed link is the only key to it.
CREATE TABLE IF NOT EXISTS moon_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES moon_subscribers (id) ON DELETE CASCADE,
    lunation_kind VARCHAR(16) NOT NULL,
    lunation_utc TIMESTAMP NOT NULL,
    prompt_index INTEGER NOT NULL,
    question VARCHAR(500),
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_moon_journal_entries_kind CHECK (lunation_kind IN ('new_moon', 'full_moon')),
    CONSTRAINT uq_moon_journal_entries_prompt UNIQUE (subscriber_id, lunation_utc, prompt_index)
);

CREATE INDEX IF NOT EXISTS idx_moon_journal_entries_subscriber ON moon_journal_entries (subscriber_id);
