# Beta V2 Phase 5: Next Steps Planning

## Overview
Based on the successful implementation of three collection methods and comprehensive learnings documented, this plan outlines the next phase focusing on consolidation, enhancement, and LLM integration.

## Current State Summary

### Working Methods
1. **Crawlee Dump** - Fully operational, most stable
2. **Scrapy Crawl** - Functional but needs API fixes
3. **Playwright Dump** - Ready but needs endpoint configuration

### Key Achievements
- Federated architecture validated
- State isolation patterns established
- Dump vs extraction separation proven
- Performance baselines established

## Phase 5 Objectives

### 1. Fix Existing Issues (Week 1)
**Priority: High**

#### Scrapy API Routing Fix
- Fix 404 errors on `/api/beta/scrapy-crawl/api/*` routes
- Ensure proper data retrieval endpoints work
- Test with various domain types

#### Playwright Endpoint Configuration
- Complete `/api/beta/playwright-dump/*` routes
- Enable screenshot and browser automation features
- Add proper error handling for browser failures

#### Unified Error Handling
- Create consistent error response format across all methods
- Implement retry logic for transient failures
- Add proper timeout handling patterns

### 2. Session-Based Enhancement (Week 2)
**Priority: High**

Build on Crawlee's stability to add:

#### Cookie Management
```javascript
// Example implementation approach
class SessionCrawler extends CrawleeDump {
  constructor() {
    super();
    this.cookieJar = new CookieJar();
  }
  
  async crawlWithSession(domain, credentials) {
    // Login flow
    // Cookie persistence
    // Stateful crawling
  }
}
```

#### Authentication Support
- Basic auth handling
- Form-based login flows
- OAuth token management
- Session persistence across crawls

#### Request Filtering
- Smart asset filtering (images, CSS, tracking)
- API request capture
- WebSocket monitoring
- Priority-based request processing

### 3. LLM Integration Foundation (Week 3)
**Priority: Medium**

Prepare dumps for AI analysis:

#### OpenRouter Integration
- Use existing OpenRouter service configuration
- Focus on open-source models (user preference)
- Implement extraction pipeline:
  ```
  Raw Dump → LLM Analysis → Structured Output → Storage
  ```

#### Extraction Templates
- Legal entity extraction prompt templates
- Business information discovery patterns
- Contact information extraction
- Geographic marker identification

#### Async Processing
- Queue-based extraction to prevent timeouts
- Progress tracking for LLM operations
- Cost monitoring per extraction

### 4. Data Pipeline Architecture (Week 4)
**Priority: Medium**

#### Processing Pipeline
```
Collection → Storage → Analysis → Enrichment → API
    ↓           ↓          ↓           ↓         ↓
 Crawlee    PostgreSQL    LLM     GLEIF/APIs  Results
```

#### Storage Optimization
- Implement data retention policies
- Add compression for large HTML dumps
- Create indexing for faster retrieval
- Archive old dumps to object storage

#### API Unification
- Create `/api/beta/v2/unified/*` endpoints
- Aggregate data across all methods
- Implement GraphQL for flexible queries
- Add pagination and filtering

## Technical Architecture Decisions

### Database Schema Evolution
```sql
-- Unified results table
CREATE TABLE beta_v2_extraction_results (
  id SERIAL PRIMARY KEY,
  dump_id INTEGER NOT NULL,
  method VARCHAR(50) NOT NULL,
  extraction_type VARCHAR(100),
  extracted_data JSONB,
  confidence_score DECIMAL(3,2),
  llm_model VARCHAR(100),
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session management
CREATE TABLE beta_v2_sessions (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255),
  cookies JSONB,
  auth_tokens JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Structure
```
/api/beta/v2/
  /collect/              # Unified collection endpoint
    POST   /crawl        # Start any method
    GET    /status/:id   # Check progress
    GET    /data/:id     # Retrieve raw data
  
  /extract/              # LLM extraction
    POST   /analyze      # Start LLM analysis
    GET    /results/:id  # Get extraction results
  
  /sessions/             # Session management
    POST   /create       # Create new session
    PUT    /update/:id   # Update session data
    DELETE /expire/:id   # Expire session
```

## Success Metrics

### Phase 5 Completion Criteria
1. All three methods fully operational with <5% error rate
2. Session-based crawling working on 3 test sites
3. LLM extraction achieving 80%+ accuracy
4. Unified API serving all methods
5. Documentation complete for all features

### Performance Targets
- Simple sites: <2 seconds collection time
- Complex sites: <10 seconds collection time
- LLM extraction: <5 seconds per page
- API response time: <100ms for queries

## Risk Mitigation

### Technical Risks
1. **LLM Costs**: Implement strict token limits and monitoring
2. **Storage Growth**: Set up automatic archival policies
3. **Browser Resources**: Implement resource pooling for Playwright
4. **Python Integration**: Consider moving to subprocess pools

### Architectural Risks
1. **Over-Engineering**: Keep solutions simple and focused
2. **Feature Creep**: Stick to planned objectives
3. **Performance Degradation**: Monitor and optimize continuously

## Timeline

### Week 1: Stabilization
- Fix Scrapy and Playwright issues
- Implement unified error handling
- Update documentation

### Week 2: Session Enhancement
- Build cookie management
- Add authentication support
- Implement request filtering

### Week 3: LLM Foundation
- Integrate OpenRouter
- Create extraction templates
- Build async processing

### Week 4: Pipeline & API
- Design data pipeline
- Optimize storage
- Unify APIs

## Next Steps

1. Start with fixing Scrapy API routing (highest impact)
2. Complete Playwright configuration
3. Design session management schema
4. Create LLM extraction proof of concept

## Conclusion

Phase 5 focuses on stabilizing what we've built and preparing for intelligent data extraction. By maintaining the successful federated architecture while adding cross-cutting concerns like sessions and LLM analysis, we can build a robust platform for comprehensive web intelligence gathering.