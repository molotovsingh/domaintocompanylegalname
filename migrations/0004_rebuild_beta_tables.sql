
-- Complete Beta Database Rebuild
-- This will create a clean, consistent schema for beta testing

-- Drop existing beta tables completely
DROP TABLE IF EXISTS beta_smoke_tests CASCADE;
DROP TABLE IF EXISTS beta_performance_metrics CASCADE;
DROP TABLE IF EXISTS beta_experiments CASCADE;

-- Recreate beta_experiments table
CREATE TABLE beta_experiments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'alpha',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  success_rate REAL,
  average_response_time_ms INTEGER,
  created_by TEXT DEFAULT 'system'
);

-- Recreate beta_smoke_tests table with correct column names
CREATE TABLE beta_smoke_tests (
  id SERIAL PRIMARY KEY,
  
  -- Test Metadata
  domain TEXT NOT NULL,
  method TEXT NOT NULL,
  experiment_id INTEGER REFERENCES beta_experiments(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Performance Metrics
  processing_time_ms INTEGER,
  success BOOLEAN DEFAULT FALSE,
  error TEXT,
  
  -- Company Extraction Results (matching the code expectations)
  company_name TEXT,
  company_confidence INTEGER,
  company_extraction_method TEXT,
  
  -- Geographic Intelligence
  detected_country TEXT,
  country_confidence INTEGER,
  geo_markers JSONB,
  
  -- Legal Document Discovery
  terms_url TEXT,
  privacy_url TEXT,
  legal_urls JSONB,
  legal_content_extracted BOOLEAN DEFAULT FALSE,
  
  -- About Us Extraction
  about_url TEXT,
  about_content TEXT,
  about_extraction_success BOOLEAN DEFAULT FALSE,
  
  -- Social Media Discovery
  social_media_links JSONB,
  social_media_count INTEGER DEFAULT 0,
  
  -- Contact Information
  contact_emails JSONB,
  contact_phones JSONB,
  contact_addresses JSONB,
  has_contact_page BOOLEAN DEFAULT FALSE,
  
  -- Raw Data Storage
  raw_html_size INTEGER,
  raw_extraction_data JSONB,
  page_metadata JSONB,
  
  -- Technical Details
  http_status INTEGER,
  render_required BOOLEAN,
  javascript_errors JSONB,
  extraction_steps JSONB
);

-- Recreate beta_performance_metrics table
CREATE TABLE beta_performance_metrics (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER REFERENCES beta_experiments(id),
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_beta_smoke_domain ON beta_smoke_tests(domain);
CREATE INDEX idx_beta_smoke_method ON beta_smoke_tests(method);
CREATE INDEX idx_beta_smoke_country ON beta_smoke_tests(detected_country);
CREATE INDEX idx_beta_smoke_created ON beta_smoke_tests(created_at DESC);
CREATE INDEX idx_beta_experiments_name ON beta_experiments(name);

-- Insert the default smoke testing experiment
INSERT INTO beta_experiments (name, description, status, created_by)
VALUES ('Smoke Testing', 'Compare extraction performance across different scraping libraries', 'beta', 'system');

-- Create the analytics view
CREATE VIEW beta_smoke_test_analytics AS
SELECT 
  method,
  COUNT(*) as total_tests,
  COUNT(CASE WHEN success THEN 1 END) as successful_tests,
  AVG(processing_time_ms) as avg_processing_time,
  AVG(company_confidence) as avg_company_confidence,
  AVG(country_confidence) as avg_country_confidence,
  COUNT(CASE WHEN legal_content_extracted THEN 1 END) as legal_docs_found,
  COUNT(CASE WHEN about_extraction_success THEN 1 END) as about_pages_found
FROM beta_smoke_tests
GROUP BY method;
