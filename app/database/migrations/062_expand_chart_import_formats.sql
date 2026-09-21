-- Allow additional source formats without changing existing import batches.
ALTER TABLE chart_import_batches DROP CONSTRAINT IF EXISTS valid_chart_import_format;
ALTER TABLE chart_import_batches ADD CONSTRAINT valid_chart_import_format
    CHECK (source_format IN ('zet', 'aaf', 'sfcht', 'astrolog', 'solar_fire'));
