# Unique Domain ID Strategy

## Current Problem
**Every domain exists twice** with different IDs:
- tidewater.com: ID 2293 (batch YVJ1JPKpNscayj8ndzwO2) + ID 2409 (batch al4pRvtVRMM6_aZZEZ-YT)
- 196 domains × 2 batches = 392 total rows instead of 196 unique domains

## Export Aggregation Failure Root Cause
```sql
-- This JOIN produces duplicate GLEIF candidates
SELECT d.domain, string_agg(gc.lei_code, '; ') 
FROM domains d 
LEFT JOIN gleif_candidates gc ON d.id = gc.domain_id
GROUP BY d.domain
-- Problem: gc.domain_id matches BOTH IDs for same domain
```

## Three Strategic Options

### Option 1: Composite Primary Key (Recommended)
**Schema Change:**
```sql
-- Remove auto-increment ID, use domain+batch as primary key
ALTER TABLE domains DROP COLUMN id;
ALTER TABLE domains ADD PRIMARY KEY (domain, batch_id);

-- Update GLEIF candidates to use composite key
ALTER TABLE gleif_candidates DROP COLUMN domain_id;
ALTER TABLE gleif_candidates ADD COLUMN domain VARCHAR NOT NULL;
ALTER TABLE gleif_candidates ADD COLUMN batch_id VARCHAR NOT NULL;
ALTER TABLE gleif_candidates ADD FOREIGN KEY (domain, batch_id) REFERENCES domains(domain, batch_id);
```

**Benefits:**
- Prevents duplicate domain entries per batch
- Natural business logic enforcement
- Clean aggregation across batches

### Option 2: Domain Master Table
**Schema Design:**
```sql
-- Master domains table (unique domains only)
CREATE TABLE unique_domains (
  domain_id SERIAL PRIMARY KEY,
  domain VARCHAR UNIQUE NOT NULL,
  first_seen TIMESTAMP DEFAULT NOW()
);

-- Batch processing results
CREATE TABLE domain_results (
  id SERIAL PRIMARY KEY,
  domain_id INTEGER REFERENCES unique_domains(domain_id),
  batch_id VARCHAR NOT NULL,
  company_name VARCHAR,
  -- ... all other processing fields
  UNIQUE(domain_id, batch_id)
);

-- GLEIF candidates reference unique domain
CREATE TABLE gleif_candidates (
  id SERIAL PRIMARY KEY,
  domain_id INTEGER REFERENCES unique_domains(domain_id),
  lei_code VARCHAR NOT NULL,
  -- ... GLEIF fields
);
```

**Benefits:**
- True unique domain identification
- Historical processing tracking
- Single GLEIF candidate storage per domain

### Option 3: Domain Hash ID
**Implementation:**
```sql
-- Add computed unique domain identifier
ALTER TABLE domains ADD COLUMN domain_hash VARCHAR GENERATED ALWAYS AS (md5(domain)) STORED;
CREATE UNIQUE INDEX idx_domain_hash ON domains(domain_hash);

-- Update GLEIF candidates to use domain hash
ALTER TABLE gleif_candidates ADD COLUMN domain_hash VARCHAR;
UPDATE gleif_candidates SET domain_hash = (SELECT domain_hash FROM domains WHERE domains.id = gleif_candidates.domain_id LIMIT 1);
```

## Recommendation: Option 2 (Domain Master Table)

**Why Option 2 is best:**
1. **Business Logic Alignment**: Domains are truly unique entities
2. **GLEIF Integration**: One domain = one set of GLEIF candidates
3. **Historical Intelligence**: Track processing evolution across batches
4. **Export Simplicity**: Clean aggregation without duplicates
5. **Future-Proof**: Supports cross-batch analytics and intelligence accumulation

## Implementation Plan

### Phase 1: Schema Migration
1. Create `unique_domains` table
2. Create `domain_results` table  
3. Migrate existing data
4. Update GLEIF candidates

### Phase 2: Application Updates
1. Modify domain processing to use unique domain IDs
2. Update all APIs to reference unique domains
3. Fix export aggregation using unique domain keys

### Phase 3: Validation
1. Verify no duplicate domains exist
2. Test GLEIF candidate aggregation
3. Validate export functionality

This strategy solves both the duplicate domain issue and export aggregation failures while positioning the system for advanced domain intelligence features.