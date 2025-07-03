
-- Add business intelligence fields to domains table
ALTER TABLE domains 
ADD COLUMN primary_business_description TEXT,
ADD COLUMN industry_context TEXT,
ADD COLUMN corporate_heritage TEXT,
ADD COLUMN business_scale TEXT,
ADD COLUMN corporate_structure TEXT,
ADD COLUMN hero_section_content TEXT,
ADD COLUMN about_section_summary TEXT,
ADD COLUMN business_focus_keywords TEXT,
ADD COLUMN geographic_presence TEXT,
ADD COLUMN corporate_timeline TEXT,
ADD COLUMN business_category TEXT,
ADD COLUMN business_subcategory TEXT,
ADD COLUMN market_position TEXT,
ADD COLUMN company_type TEXT,
ADD COLUMN content_sources TEXT,
ADD COLUMN extraction_timestamp TIMESTAMP,
ADD COLUMN content_quality_score INTEGER;

-- Create business intelligence patterns table
CREATE TABLE business_intelligence_patterns (
  id SERIAL PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  confidence_weight INTEGER NOT NULL,
  match_type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create domain business matches table
CREATE TABLE domain_business_matches (
  id SERIAL PRIMARY KEY,
  domain_id INTEGER NOT NULL REFERENCES domains(id),
  pattern_id INTEGER NOT NULL REFERENCES business_intelligence_patterns(id),
  matched_text TEXT NOT NULL,
  content_location TEXT NOT NULL,
  match_confidence INTEGER NOT NULL,
  extracted_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial business intelligence patterns
INSERT INTO business_intelligence_patterns (pattern_type, pattern_value, category, subcategory, confidence_weight, match_type, description) VALUES
('industry_keyword', 'pharmaceutical', 'healthcare', 'pharmaceuticals', 85, 'contains', 'Indicates pharmaceutical industry'),
('industry_keyword', 'biopharmaceutical', 'healthcare', 'biotechnology', 90, 'contains', 'Indicates biotechnology/biopharmaceutical industry'),
('industry_keyword', 'software development', 'technology', 'software', 80, 'contains', 'Indicates software development company'),
('industry_keyword', 'artificial intelligence', 'technology', 'ai', 85, 'contains', 'Indicates AI/ML technology company'),
('heritage_indicator', 'founded in', 'heritage', 'establishment', 70, 'contains', 'Company establishment date'),
('heritage_indicator', 'established', 'heritage', 'establishment', 70, 'contains', 'Company establishment indicator'),
('heritage_indicator', 'for over.*years', 'heritage', 'longevity', 75, 'regex', 'Company longevity indicator'),
('scale_marker', 'Fortune 500', 'scale', 'large_enterprise', 95, 'contains', 'Fortune 500 company indicator'),
('scale_marker', 'global leader', 'scale', 'market_leader', 80, 'contains', 'Market leadership indicator'),
('scale_marker', 'multinational', 'scale', 'global', 75, 'contains', 'Global presence indicator'),
('structure_signal', 'publicly traded', 'structure', 'public', 85, 'contains', 'Public company indicator'),
('structure_signal', 'private company', 'structure', 'private', 80, 'contains', 'Private company indicator'),
('structure_signal', 'subsidiary of', 'structure', 'subsidiary', 90, 'contains', 'Subsidiary relationship indicator');

-- Create indexes for performance
CREATE INDEX idx_business_patterns_category ON business_intelligence_patterns(category);
CREATE INDEX idx_business_patterns_type ON business_intelligence_patterns(pattern_type);
CREATE INDEX idx_domain_business_matches_domain ON domain_business_matches(domain_id);
CREATE INDEX idx_domain_business_matches_pattern ON domain_business_matches(pattern_id);
CREATE INDEX idx_domains_business_category ON domains(business_category);
CREATE INDEX idx_domains_content_quality ON domains(content_quality_score);
