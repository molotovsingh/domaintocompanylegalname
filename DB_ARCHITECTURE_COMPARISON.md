# Database Architecture Comparison: Flat vs Wide

## Current Issue: GLEIF Export Failing
- Individual candidates API works: `/api/domains/2409/candidates` returns 10 candidates
- Export aggregation fails: Returns null values despite data existing
- Root cause: Complex JOIN aggregation in export function

## Architecture 1: Normalized (Current)
```sql
-- domains table (main entity)
CREATE TABLE domains (
  id SERIAL PRIMARY KEY,
  domain TEXT,
  company_name TEXT,
  -- ... other fields
);

-- gleif_candidates table (1:many relationship)
CREATE TABLE gleif_candidates (
  id SERIAL PRIMARY KEY,
  domain_id INTEGER REFERENCES domains(id),
  lei_code TEXT,
  legal_name TEXT,
  jurisdiction TEXT,
  -- ... other GLEIF fields
);
```

### Pros:
- Data integrity and normalization
- No duplication
- Easy to update individual candidates
- Supports complex queries

### Cons:
- Requires JOINs for export
- Complex aggregation syntax
- Performance overhead for bulk operations

## Architecture 2: Wide/Denormalized
```sql
-- domains table with embedded GLEIF data
CREATE TABLE domains (
  id SERIAL PRIMARY KEY,
  domain TEXT,
  company_name TEXT,
  -- Direct GLEIF fields
  gleif_candidate_count INTEGER,
  all_lei_codes TEXT,  -- "LEI1; LEI2; LEI3"
  all_legal_names TEXT, -- "Name1; Name2; Name3"
  all_jurisdictions TEXT,
  all_entity_statuses TEXT,
  -- JSON for complex data
  gleif_candidates_json JSONB,
  -- ... other fields
);
```

### Pros:
- Simple SELECT queries
- Fast export performance
- No JOIN complexity
- Direct access to aggregated data

### Cons:
- Data duplication
- Harder to maintain consistency
- Complex updates when GLEIF data changes
- Larger storage footprint

## Hybrid Architecture 3: Both Approaches
- Keep normalized structure for data integrity
- Add materialized view or computed columns for export performance
- Best of both worlds

## Test Data Example:
Domain: tidewater.com (ID: 2409)
- 10 GLEIF candidates exist
- Individual API works
- Export aggregation fails

## Implementation Strategy:
1. Fix current normalized approach first
2. Create wide table alternative
3. Performance comparison
4. User feedback on preferred approach