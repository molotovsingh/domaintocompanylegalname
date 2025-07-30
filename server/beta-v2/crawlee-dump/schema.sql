-- Crawlee Dumps Table for Beta V2
CREATE TABLE IF NOT EXISTS crawlee_dumps (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Configuration used
  max_pages INTEGER DEFAULT 10,
  max_depth INTEGER DEFAULT 2,
  wait_time INTEGER DEFAULT 1000, -- milliseconds between requests
  include_paths TEXT[], -- Optional path filters
  exclude_paths TEXT[], -- Optional path exclusions
  
  -- Raw dump data (stored as JSONB for flexibility)
  dump_data JSONB,
  
  -- Statistics
  pages_crawled INTEGER DEFAULT 0,
  total_size_bytes INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crawlee_dumps_domain ON crawlee_dumps(domain);
CREATE INDEX IF NOT EXISTS idx_crawlee_dumps_status ON crawlee_dumps(status);
CREATE INDEX IF NOT EXISTS idx_crawlee_dumps_created_at ON crawlee_dumps(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_crawlee_dumps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER crawlee_dumps_updated_at_trigger
BEFORE UPDATE ON crawlee_dumps
FOR EACH ROW
EXECUTE FUNCTION update_crawlee_dumps_updated_at();