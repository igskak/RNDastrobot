-- ============================================================================
-- MIGRATION: Create natal_configuration_aspects table
-- ============================================================================
-- Purpose: Link configurations with their constituent aspects and store scores
-- Author: System
-- Date: 2025-12-07
-- ============================================================================

-- Drop table if exists (for clean re-runs)
DROP TABLE IF EXISTS natal_configuration_aspects CASCADE;

-- Create the table
CREATE TABLE natal_configuration_aspects (
    config_id UUID NOT NULL,
    aspect_id UUID NOT NULL,
    aspect_score INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Primary key
    PRIMARY KEY (config_id, aspect_id),
    
    -- Foreign keys
    CONSTRAINT fk_config_aspects_config 
        FOREIGN KEY (config_id) 
        REFERENCES natal_configurations(config_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_config_aspects_aspect 
        FOREIGN KEY (aspect_id) 
        REFERENCES natal_aspects(aspect_id) 
        ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT valid_aspect_score 
        CHECK (aspect_score >= 1 AND aspect_score <= 3)
);

-- Create indexes for performance
CREATE INDEX idx_config_aspects_config ON natal_configuration_aspects(config_id);
CREATE INDEX idx_config_aspects_aspect ON natal_configuration_aspects(aspect_id);

-- Add comments
COMMENT ON TABLE natal_configuration_aspects IS 'Связь между конфигурациями и аспектами с баллами силы';
COMMENT ON COLUMN natal_configuration_aspects.config_id IS 'ID конфигурации';
COMMENT ON COLUMN natal_configuration_aspects.aspect_id IS 'ID аспекта';
COMMENT ON COLUMN natal_configuration_aspects.aspect_score IS 'Балл аспекта: 1 (в макс. орбисе), 2 (в мин. орбисе), 3 (< 1°)';

-- Verification
SELECT 'Table natal_configuration_aspects created successfully' as status;

