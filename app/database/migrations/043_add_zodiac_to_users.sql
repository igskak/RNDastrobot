-- 043: persist zodiac (tropical/sidereal) and ayanamsha per natal chart.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS zodiac VARCHAR(16) NOT NULL DEFAULT 'tropical';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ayanamsha VARCHAR(32);

UPDATE users
SET zodiac = COALESCE(zodiac, 'tropical')
WHERE zodiac IS NULL;
