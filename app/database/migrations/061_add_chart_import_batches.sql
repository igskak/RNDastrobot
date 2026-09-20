-- 061: resumable, owner-scoped chart import previews and receipts.

CREATE TABLE IF NOT EXISTS chart_import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    source_format VARCHAR(16) NOT NULL,
    parser_version INTEGER NOT NULL DEFAULT 1,
    file_digest VARCHAR(64) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    source_encoding VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'preview',
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    destination_person_id UUID REFERENCES persons(person_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT valid_chart_import_format CHECK (source_format IN ('zet', 'aaf')),
    CONSTRAINT valid_chart_import_batch_status CHECK (
        status IN ('preview', 'confirmed', 'processing', 'paused', 'completed', 'expired')
    )
);

CREATE TABLE IF NOT EXISTS chart_import_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES chart_import_batches(id) ON DELETE CASCADE,
    source_index INTEGER NOT NULL,
    source_line INTEGER NOT NULL,
    fingerprint VARCHAR(64),
    normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'ready',
    selected BOOLEAN NOT NULL DEFAULT FALSE,
    resulting_chart_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chart_import_item_source UNIQUE (batch_id, source_index),
    CONSTRAINT valid_chart_import_item_status CHECK (
        status IN (
            'ready', 'warning', 'error', 'possible_duplicate', 'already_imported',
            'selected', 'importing', 'imported', 'failed', 'skipped'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_chart_import_batches_owner_updated
    ON chart_import_batches (astrologer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chart_import_batches_expires
    ON chart_import_batches (expires_at);
CREATE INDEX IF NOT EXISTS idx_chart_import_items_batch_status
    ON chart_import_items (batch_id, status);
CREATE INDEX IF NOT EXISTS idx_chart_import_items_fingerprint
    ON chart_import_items (fingerprint);
CREATE INDEX IF NOT EXISTS idx_chart_import_items_result
    ON chart_import_items (resulting_chart_id);
