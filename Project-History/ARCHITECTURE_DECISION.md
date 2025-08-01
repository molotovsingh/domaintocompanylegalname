# Database Architecture Decision: FastAPI vs Express.js

## Current Problem
Express.js + Drizzle ORM failing at GLEIF export aggregation:
- Individual API works: `/api/domains/2409/candidates` returns 10 candidates
- Bulk export fails: Multiple implementation attempts return null values
- Complex JOIN syntax causing aggregation failures

## FastAPI Solution Benefits

### 1. Relationship Handling
```python
# SQLAlchemy automatic relationship loading
domains = db.query(Domain).options(
    joinedload(Domain.gleif_candidates)
).all()

# Simple list comprehension - no complex aggregation
all_lei_codes = "; ".join([c.lei_code for c in domain.gleif_candidates])
```

### 2. Type Safety
- Pydantic models ensure data integrity
- Automatic validation and serialization
- Runtime type checking

### 3. Performance
- Eager loading eliminates N+1 queries
- Connection pooling built-in
- Async support throughout

### 4. Developer Experience
- Automatic API documentation
- Clear error messages
- Simpler debugging

## Implementation Strategy

### Phase 1: Hybrid Approach (Recommended)
- Keep Express.js for file upload/processing (existing workflow)
- Add FastAPI for analytics/export endpoints
- Share PostgreSQL database
- Port 8000 for FastAPI, Port 5000 for Express.js

### Phase 2: Performance Validation
- A/B test export performance
- Compare response times
- Measure developer productivity

### Phase 3: Migration Decision
- Based on performance gains
- Team comfort with Python
- Maintenance overhead assessment

## Database Schema Compatibility
Both frameworks share same PostgreSQL schema:
- `domains` table with all existing fields
- `gleif_candidates` table with foreign key relationships
- No schema changes required

## Trade-offs Analysis

**FastAPI Advantages:**
- Solves current aggregation failures
- Better relationship handling
- Type safety throughout
- Automatic documentation

**Considerations:**
- Additional language in stack
- Team Python expertise
- Deployment complexity

## Recommendation
Implement hybrid approach to solve immediate GLEIF export crisis while evaluating long-term migration benefits.