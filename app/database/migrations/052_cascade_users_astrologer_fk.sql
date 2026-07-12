ALTER TABLE users
    DROP CONSTRAINT IF EXISTS fk_users_astrologer_id;

ALTER TABLE users
    ADD CONSTRAINT fk_users_astrologer_id
    FOREIGN KEY (astrologer_id)
    REFERENCES astrologers(id)
    ON DELETE CASCADE;
