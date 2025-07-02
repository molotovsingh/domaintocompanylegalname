
-- Add entity category prediction columns to domains table
ALTER TABLE domains ADD COLUMN IF NOT EXISTS predicted_entity_category TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS entity_category_confidence INTEGER;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS entity_category_indicators TEXT;
