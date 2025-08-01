-- GLEIF Search Service Tables for Beta V2

-- Search requests table
CREATE TABLE IF NOT EXISTS gleif_search_requests (
  id SERIAL PRIMARY KEY,
  suspected_name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  search_method VARCHAR(50), -- 'exact', 'fuzzy', 'geographic'
  jurisdiction VARCHAR(10), -- Country code for geographic search
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- GLEIF candidates with all enriched data
CREATE TABLE IF NOT EXISTS gleif_candidates_v2 (
  id SERIAL PRIMARY KEY,
  search_id INTEGER REFERENCES gleif_search_requests(id) ON DELETE CASCADE,
  lei_code VARCHAR(20) NOT NULL,
  legal_name TEXT NOT NULL,
  entity_status VARCHAR(50),
  legal_form VARCHAR(255),
  legal_form_code VARCHAR(50),
  jurisdiction VARCHAR(10),
  entity_category VARCHAR(50),
  entity_sub_category VARCHAR(50),
  
  -- Headquarters address
  headquarters_country VARCHAR(10),
  headquarters_city VARCHAR(255),
  headquarters_region VARCHAR(255),
  headquarters_postal_code VARCHAR(50),
  headquarters_address_line TEXT,
  
  -- Legal address
  legal_address_country VARCHAR(10),
  legal_address_city VARCHAR(255),
  legal_address_region VARCHAR(255),
  legal_address_postal_code VARCHAR(50),
  legal_address_line TEXT,
  
  -- Registration data
  registration_status VARCHAR(50),
  initial_registration_date DATE,
  last_update_date DATE,
  next_renewal_date DATE,
  managing_lou VARCHAR(20),
  
  -- Algorithmic scores (from non-beta algorithm)
  name_match_score INTEGER,
  fortune500_score INTEGER,
  tld_jurisdiction_score INTEGER,
  entity_complexity_score INTEGER,
  weighted_total_score INTEGER,
  selection_reason TEXT,
  
  -- Additional metadata
  other_names JSONB, -- Array of alternative names
  validation_sources TEXT,
  bic_codes JSONB, -- Array of BIC codes if any
  
  -- Full GLEIF response for future analysis
  gleif_raw_data JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_gleif_search_status ON gleif_search_requests(status);
CREATE INDEX idx_gleif_candidates_search_id ON gleif_candidates_v2(search_id);
CREATE INDEX idx_gleif_candidates_lei ON gleif_candidates_v2(lei_code);
CREATE INDEX idx_gleif_candidates_scores ON gleif_candidates_v2(weighted_total_score DESC);