-- Migration 027: remove AI chatbot and AI interpretation schema artifacts
-- Drops AI cache/chat tables and removes CRM links to chat-specific entities.

BEGIN;

ALTER TABLE IF EXISTS public.consultations
    DROP CONSTRAINT IF EXISTS consultations_conversation_id_fkey;

ALTER TABLE IF EXISTS public.consultations
    DROP CONSTRAINT IF EXISTS consultations_forecast_run_id_fkey;

ALTER TABLE IF EXISTS public.consultations
    DROP COLUMN IF EXISTS conversation_id;

ALTER TABLE IF EXISTS public.consultations
    DROP COLUMN IF EXISTS forecast_run_id;

DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.chat_conversations;
DROP TABLE IF EXISTS public.forecast_runs;
DROP TABLE IF EXISTS public.prognostic_interpretations;
DROP TABLE IF EXISTS public.natal_interpretations;

COMMIT;
