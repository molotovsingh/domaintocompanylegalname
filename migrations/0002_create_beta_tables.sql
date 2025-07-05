
-- Beta Testing Platform Schema
-- Completely isolated from production data

-- Beta Experiments Table
CREATE TABLE IF NOT EXISTS beta_experiments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'alpha',
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  success_rate REAL,
  average_response_time_ms INTEGER,
  created_by TEXT DEFAULT 'system'
);

-- Beta Smoke Test Results (isolated from production)
CREATE TABLE IF NOT EXISTS beta_smoke_tests (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  method TEXT NOT NULL,
  company_name TEXT,
  confidence INTEGER,
  processing_time_ms INTEGER,
  success BOOLEAN DEFAULT FALSE,
  error TEXT,
  extraction_method TEXT,
  technical_details TEXT,
  experiment_id INTEGER REFERENCES beta_experiments(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Beta Performance Metrics
CREATE TABLE IF NOT EXISTS beta_performance_metrics (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER REFERENCES beta_experiments(id),
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial smoke testing experiment
INSERT INTO beta_experiments (name, description, status, created_by)
VALUES ('Smoke Testing', 'Compare extraction performance across different scraping libraries', 'beta', 'system')
ON CONFLICT (name) DO NOTHING;
