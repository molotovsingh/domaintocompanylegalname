-- Beta V2 Cleaning Stage Tables
-- Date: July 31, 2025

-- Store cleaned/processed results
CREATE TABLE IF NOT EXISTS beta_v2.cleaned_data (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL, -- 'crawlee_dump', 'scrapy_crawl', 'playwright_dump'
  source_id INTEGER NOT NULL, -- References the original dump ID
  model_name VARCHAR(100) NOT NULL, -- 'deepseek-chat', 'llama-3-8b', etc.
  model_provider VARCHAR(50) NOT NULL, -- 'openrouter', 'openai', etc.
  cleaned_data JSONB NOT NULL, -- Extracted entities, addresses, etc.
  processing_time_ms INTEGER,
  token_count INTEGER,
  cost_estimate DECIMAL(10,6) DEFAULT 0,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track model comparison sessions
CREATE TABLE IF NOT EXISTS beta_v2.cleaning_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(50) UNIQUE NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_id INTEGER NOT NULL,
  models_used TEXT[] NOT NULL, -- Array of model names
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model performance tracking
CREATE TABLE IF NOT EXISTS beta_v2.model_performance (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  domain VARCHAR(255),
  extraction_quality INTEGER CHECK (extraction_quality >= 1 AND extraction_quality <= 5), -- 1-5 rating
  processing_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cleaned_data_source ON beta_v2.cleaned_data(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_cleaned_data_model ON beta_v2.cleaned_data(model_name);
CREATE INDEX IF NOT EXISTS idx_cleaned_data_created ON beta_v2.cleaned_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_performance ON beta_v2.model_performance(model_name, domain);
CREATE INDEX IF NOT EXISTS idx_cleaning_sessions_source ON beta_v2.cleaning_sessions(source_type, source_id);

-- Add comments for documentation
COMMENT ON TABLE beta_v2.cleaned_data IS 'Stores LLM-cleaned results from raw dumps';
COMMENT ON TABLE beta_v2.cleaning_sessions IS 'Tracks multi-model comparison sessions';
COMMENT ON TABLE beta_v2.model_performance IS 'Records model performance metrics for optimization';

COMMENT ON COLUMN beta_v2.cleaned_data.source_type IS 'Type of dump: crawlee_dump, scrapy_crawl, or playwright_dump';
COMMENT ON COLUMN beta_v2.cleaned_data.source_id IS 'ID from the respective dump table';
COMMENT ON COLUMN beta_v2.cleaned_data.cleaned_data IS 'JSON structure with extracted company info, addresses, etc.';
COMMENT ON COLUMN beta_v2.model_performance.extraction_quality IS 'User or system rating of extraction quality (1-5)';