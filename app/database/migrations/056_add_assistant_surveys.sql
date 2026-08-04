-- Migration 056: persisted forecast surveys (spec §22.2).
--
-- A survey is expensive (discovery scan plus per-pair root finding) and, until
-- now, lived only inside the turn that produced it. Three consequences: the
-- intersection and pattern tools re-ran the whole survey instead of referencing
-- it, an astrologer returning to a conversation could not reopen the same
-- dataset, and the full-table view has nothing to page through.
--
-- Storing the events lets a survey_id mean something across turns. Rows are
-- tenant-scoped and cascade with the astrologer, and carry the methodology hash
-- so a stored survey can be told apart from one computed under different orbs.

CREATE TABLE IF NOT EXISTS assistant_surveys (
    survey_id         TEXT PRIMARY KEY,
    astrologer_id     UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    chart_user_id     UUID NOT NULL,
    conversation_id   UUID REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    kind              TEXT NOT NULL DEFAULT 'transit_survey',
    parameters        JSONB NOT NULL DEFAULT '{}'::jsonb,
    events            JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary           JSONB,
    methodology_hash  TEXT,
    event_count       INTEGER NOT NULL DEFAULT 0,
    truncated         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT now()
);

-- Reopening a chart's recent surveys, and the tenant scope check on every read.
CREATE INDEX IF NOT EXISTS idx_assistant_surveys_owner
    ON assistant_surveys (astrologer_id, chart_user_id, created_at DESC);

-- Continuing a conversation ("покажи полную таблицу по тому обзору").
CREATE INDEX IF NOT EXISTS idx_assistant_surveys_conversation
    ON assistant_surveys (conversation_id, created_at DESC)
    WHERE conversation_id IS NOT NULL;
