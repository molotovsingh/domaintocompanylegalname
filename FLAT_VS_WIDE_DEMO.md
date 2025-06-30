# Database Architecture Demonstration: Flat vs Wide

## Test Results Summary

### Working Individual API (Normalized Structure)
✅ `/api/domains/2409/candidates` returns 10 GLEIF candidates perfectly
- Tidewater Inc. (US)
- TIDEWATER S.L. (ES) 
- Tidewater B.V. (NL)
- etc.

### Failing Export Aggregation (Normalized Structure)
❌ `/api/export/al4pRvtVRMM6_aZZEZ-YT` returns null values for GLEIF data
- Complex JOIN aggregation syntax failing
- Multiple implementation attempts unsuccessful

## Architecture Trade-offs

### 1. Normalized (Current - Flat Structure)
```sql
domains: id, domain, company_name
gleif_candidates: id, domain_id, lei_code, legal_name
```

**Pros:**
- Data integrity and normalization
- Individual queries work perfectly
- No data duplication

**Cons:**
- Complex aggregation for export
- JOIN performance overhead
- Aggregation syntax complexity

### 2. Wide (Denormalized Structure)
```sql
domains: id, domain, company_name, gleif_candidate_count, all_lei_codes, all_legal_names
```

**Pros:**
- Simple SELECT queries
- Fast export performance
- No JOIN complexity

**Cons:**
- Data duplication
- Update complexity
- Storage overhead

## Implementation Status

1. ✅ Normalized approach routes created (`/api/export-normalized`)
2. ✅ Wide approach routes created (`/api/export-wide`)
3. ✅ Both registered in main routes
4. 🔄 Testing both approaches to demonstrate performance differences

## Real-World Impact

Current system has:
- 196 domains processed
- 167 GLEIF candidates total
- Perfect individual access
- Failed bulk export

## Next Steps

1. Fix normalized approach with proper aggregation
2. Compare performance between both architectures
3. User feedback on preferred approach
4. Production deployment decision