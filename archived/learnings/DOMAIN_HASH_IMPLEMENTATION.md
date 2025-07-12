# Domain Hash Implementation Strategy

## Problem Analysis
- 196 domains appearing twice (392 total rows) causing export aggregation failures
- tidewater.com has IDs 2293 and 2409 - same domain, different batches
- GLEIF candidates reference domain IDs, creating duplicate associations
- Export queries fail because JOIN aggregation gets confused by duplicate domains

## Solution: Domain Hash Strategy

### Phase 1: Add Domain Hash Column
```sql
ALTER TABLE domains ADD COLUMN domain_hash VARCHAR(32) NOT NULL DEFAULT '';
CREATE INDEX idx_domain_hash ON domains(domain_hash);
```

### Phase 2: Populate Hashes for Existing Data
```sql
-- Generate MD5 hashes for all existing domains
UPDATE domains SET domain_hash = md5(domain) WHERE domain_hash = '';
```

### Phase 3: Update Processing Logic
- Generate domain hash during upload processing
- Use domain hash for duplicate detection across batches
- Enable cross-batch intelligence accumulation

### Phase 4: Fix Export Aggregation
```sql
-- Working aggregation query using domain hash
SELECT 
  domain_hash,
  domain,
  array_agg(DISTINCT gc.lei_code) as all_lei_codes,
  array_agg(DISTINCT gc.legal_name) as all_legal_names
FROM domains d
LEFT JOIN gleif_candidates gc ON d.id = gc.domain_id
GROUP BY domain_hash, domain;
```

## Benefits
1. **Persistent Unique IDs**: Same domain = same hash across all batches
2. **Historical Tracking**: Track domain processing evolution over time
3. **Duplicate Prevention**: Detect when same domain uploaded in different batches
4. **Export Fix**: Clean aggregation using domain hash grouping
5. **Intelligence Accumulation**: Build comprehensive domain knowledge base

## Implementation Plan
1. Add domain_hash column to existing schema
2. Create hash generation utility
3. Update upload processing to generate hashes
4. Fix export aggregation using domain hash grouping
5. Add cross-batch analytics and intelligence