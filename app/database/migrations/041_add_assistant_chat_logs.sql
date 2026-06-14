-- Migration 041: Assistant chat conversations, messages and per-turn metrics.
-- Logs the astrologer-assistant dialogue and the cost/latency of each turn so
-- usage can be reviewed in-app and billed later. Langfuse covers LLM-level
-- tracing; these tables are the product's own queryable record.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS assistant_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- The astrologer who owns the dialogue (the operator, not the chart).
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    -- The active chart the turn was bound to (no FK: charts may be deleted
    -- while we keep the usage record).
    chart_user_id UUID,
    title VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_conv_astrologer
    ON assistant_conversations(astrologer_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS assistant_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL
        REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_assistant_msg_role CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS idx_assistant_msg_conversation
    ON assistant_messages(conversation_id, created_at ASC);

-- One row per assistant turn: what it cost and how fast it was.
CREATE TABLE IF NOT EXISTS assistant_turn_metrics (
    id BIGSERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL
        REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    model VARCHAR(80) NOT NULL,
    iterations SMALLINT NOT NULL DEFAULT 0,
    model_calls SMALLINT NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    max_iterations_reached BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_metrics_astrologer
    ON assistant_turn_metrics(astrologer_id, created_at DESC);
