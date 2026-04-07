CREATE TABLE IF NOT EXISTS client_relationships (
    id UUID PRIMARY KEY,
    astrologer_id UUID NOT NULL REFERENCES astrologers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    related_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    relation_label VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT client_relationship_not_self CHECK (user_id <> related_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_relationships_owner_pair
    ON client_relationships(astrologer_id, user_id, related_user_id);

CREATE INDEX IF NOT EXISTS idx_client_relationships_astrologer_user
    ON client_relationships(astrologer_id, user_id);

CREATE INDEX IF NOT EXISTS idx_client_relationships_astrologer_related
    ON client_relationships(astrologer_id, related_user_id);
