-- Processing results table for Data Processing Stage 2
CREATE TABLE IF NOT EXISTS beta_v2_processing_results (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL, -- 'crawlee_dump', 'scrapy_crawl', 'playwright_dump', 'axios_cheerio_dump'
  source_id INTEGER NOT NULL,
  domain VARCHAR(255) NOT NULL,
  
  -- Stage 1: HTML Stripping
  stage1_stripped_text TEXT,
  stage1_processing_time_ms INTEGER,
  
  -- Stage 2: Data Extraction (existing cleaning)
  stage2_extracted_data JSONB,
  stage2_model_used VARCHAR(100),
  stage2_processing_time_ms INTEGER,
  
  -- Stage 3: Entity Name Extraction (new)
  stage3_entity_name VARCHAR(255),
  stage3_entity_confidence DECIMAL(3,2),
  stage3_model_used VARCHAR(100),
  stage3_processing_time_ms INTEGER,
  stage3_reasoning TEXT,
  stage3_alternative_names JSONB,
  
  -- Stage 4: GLEIF Results
  stage4_gleif_search_id INTEGER,
  stage4_primary_lei VARCHAR(20),
  stage4_primary_legal_name VARCHAR(500),
  stage4_confidence_score DECIMAL(3,2),
  stage4_total_candidates INTEGER,
  
  -- Overall status
  processing_status VARCHAR(50) DEFAULT 'pending', -- pending, stage1, stage2, stage3, stage4, completed, failed
  error_message TEXT,
  total_processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_processing_source ON beta_v2_processing_results(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_processing_domain ON beta_v2_processing_results(domain);
CREATE INDEX IF NOT EXISTS idx_processing_status ON beta_v2_processing_results(processing_status);
CREATE INDEX IF NOT EXISTS idx_processing_created ON beta_v2_processing_results(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE beta_v2_processing_results IS 'Stores multi-stage processing results linking dumps to GLEIF verification';
COMMENT ON COLUMN beta_v2_processing_results.source_type IS 'Collection method: crawlee_dump, scrapy_crawl, etc.';
COMMENT ON COLUMN beta_v2_processing_results.stage3_entity_name IS 'LLM-extracted legal entity name for GLEIF search';
COMMENT ON COLUMN beta_v2_processing_results.stage4_gleif_search_id IS 'Links to gleif_search_requests.id';