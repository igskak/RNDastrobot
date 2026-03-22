-- 026: Add workflow_state JSONB column to chat_conversations
-- Stores multi-agent pipeline state (sub-agent results, synthesizer result)
-- for the natal chat workflow across conversation turns.

ALTER TABLE chat_conversations
    ADD COLUMN IF NOT EXISTS workflow_state JSONB DEFAULT '{}';

COMMENT ON COLUMN chat_conversations.workflow_state IS
    'Stores agent pipeline state: psychology_result, events_result, karmic_result, synthesizer_result';
