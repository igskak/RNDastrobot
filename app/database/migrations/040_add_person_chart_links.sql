-- Migration 040: M2M junction table for Person ↔ Chart links
-- Allows one chart to be linked to multiple persons and vice versa.

CREATE TABLE IF NOT EXISTS person_chart_links (
    person_id UUID NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
    chart_id  UUID NOT NULL REFERENCES users(user_id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_person_chart_links PRIMARY KEY (person_id, chart_id),
    CONSTRAINT uq_person_chart_links UNIQUE (person_id, chart_id)
);

CREATE INDEX IF NOT EXISTS idx_pcl_person_id ON person_chart_links(person_id);
CREATE INDEX IF NOT EXISTS idx_pcl_chart_id  ON person_chart_links(chart_id);
