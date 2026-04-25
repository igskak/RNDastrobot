-- Migration: allow separate preferences for the new prognostic rings screen.

ALTER TABLE chart_view_overrides
    DROP CONSTRAINT IF EXISTS valid_chart_view_override_view;

ALTER TABLE chart_view_overrides
    ADD CONSTRAINT valid_chart_view_override_view
    CHECK (view_type IN ('natal', 'biwheel', 'forecast_new', 'solar'));
