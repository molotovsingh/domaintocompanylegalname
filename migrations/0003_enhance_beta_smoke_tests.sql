-- Enhanced Beta Smoke Test Results Schema
-- Captures comprehensive website intelligence beyond just company names

-- Drop the old table to redesign properly
DROP TABLE IF EXISTS beta_smoke_tests CASCADE;

-- Create enhanced beta smoke tests table
CREATE TABLE beta_smoke_tests (
  id SERIAL PRIMARY KEY,
  
  -- Test Metadata
  domain TEXT NOT NULL,
  method TEXT NOT NULL, -- puppeteer, playwright, axios_cheerio
  experiment_id INTEGER REFERENCES beta_experiments(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Performance Metrics
  processing_time_ms INTEGER,
  success BOOLEAN DEFAULT FALSE,
  error TEXT,
  
  -- Company Extraction Results
  company_name TEXT,
  company_confidence INTEGER,
  company_extraction_method TEXT, -- meta_property, structured_data, etc
  
  -- Geographic Intelligence
  detected_country TEXT,
  country_confidence INTEGER,
  geo_markers JSONB, -- {addresses: [], phones: [], currencies: [], languages: []}
  
  -- Legal Document Discovery
  terms_url TEXT,
  privacy_url TEXT,
  legal_urls JSONB, -- [{type: 'cookies', url: '...'}, ...]
  legal_content_extracted BOOLEAN DEFAULT FALSE,
  
  -- About Us Extraction
  about_url TEXT,
  about_content TEXT, -- First 1000 chars of about content
  about_extraction_success BOOLEAN DEFAULT FALSE,
  
  -- Social Media Discovery
  social_media_links JSONB, -- {twitter: '...', linkedin: '...', facebook: '...'}
  social_media_count INTEGER DEFAULT 0,
  
  -- Contact Information
  contact_emails JSONB, -- ['info@example.com', 'sales@example.com']
  contact_phones JSONB, -- ['+1-555-0123', '1-800-COMPANY']
  contact_addresses JSONB, -- ['123 Main St, City, State']
  has_contact_page BOOLEAN DEFAULT FALSE,
  
  -- Raw Data Storage (for debugging)
  raw_html_size INTEGER, -- Size in bytes
  raw_extraction_data JSONB, -- All extracted data in structured format
  page_metadata JSONB, -- {title, meta_tags, headers, etc}
  
  -- Technical Details
  http_status INTEGER,
  render_required BOOLEAN,
  javascript_errors JSONB,
  extraction_steps JSONB -- Step-by-step log of what was tried
);

-- Indexes for performance
CREATE INDEX idx_beta_smoke_domain ON beta_smoke_tests(domain);
CREATE INDEX idx_beta_smoke_method ON beta_smoke_tests(method);
CREATE INDEX idx_beta_smoke_country ON beta_smoke_tests(detected_country);
CREATE INDEX idx_beta_smoke_created ON beta_smoke_tests(created_at DESC);

-- Create a view for easy analytics
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