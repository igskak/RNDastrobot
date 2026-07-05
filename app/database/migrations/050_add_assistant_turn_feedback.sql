-- Migration 050: positive/negative feedback on assistant_turn_metrics.
-- Beta astrologers asked for a like/dislike pair (not just the correction flag).
-- 'like' is a positive signal (no correction needed); 'dislike' pairs with the
-- existing correction_flag/correction_note. Nullable => backfill-safe. Idempotent.

ALTER TABLE assistant_turn_metrics
    ADD COLUMN IF NOT EXISTS feedback TEXT;  -- 'like' | 'dislike' | NULL

-- Positive-feedback rate queries scan liked turns per astrologer.
CREATE INDEX IF NOT EXISTS idx_assistant_metrics_feedback
    ON assistant_turn_metrics (astrologer_id, feedback)
    WHERE feedback IS NOT NULL;
