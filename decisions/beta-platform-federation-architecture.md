# Beta Platform Federation Architecture Plan

## Executive Summary
Transform the beta testing platform from a monolithic structure into a federated microservice-like architecture where each data collection method operates as an independent module with its own database, API routes, and storage strategy.

## Current Problems
1. Single `betaIndex.ts` becoming unwieldy and hard to maintain
2. Adding new methods requires modifying existing code
3. Risk of breaking working methods when adding features
4. All methods forced to share same schema/storage approach
5. Difficult to develop and test methods in isolation

## Proposed Architecture

### Core Principles
- Each collection method is an independent vertical slice
- Zero coupling between methods
- Shared minimal data for cross-method analysis
- Complete development isolation

### Database Federation Model

#### Shared Core Tables
```sql
-- Shared domain registry
CREATE TABLE beta_domains (
    domain_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name VARCHAR(255) NOT NULL,
    normalized_domain VARCHAR(255) NOT NULL, -- for matching variations
    first_seen TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(normalized_domain)
);

-- Shared run tracking
CREATE TABLE beta_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES beta_domains(domain_id),
    method VARCHAR(50) NOT NULL, -- 'playwright', 'scrapy', 'crawlee', etc
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT
);
```

#### Method-Specific Databases

**Playwright Schema:**
```sql
-- Playwright-specific dumps
CREATE TABLE playwright_dumps (
    dump_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES beta_runs(run_id),
    html_content TEXT,
    text_content TEXT,
    screenshots JSONB, -- array of base64 images
    console_logs JSONB,
    network_har JSONB,
    browser_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Playwright-specific extractions
CREATE TABLE playwright_extractions (
    extraction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dump_id UUID REFERENCES playwright_dumps(dump_id),
    structured_data JSONB,
    meta_properties JSONB,
    visual_elements JSONB,
    dom_metrics JSONB
);
```

**Scrapy Schema:**
```sql
-- Scrapy-specific crawls
CREATE TABLE scrapy_crawls (
    crawl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES beta_runs(run_id),
    spider_name VARCHAR(100),
    crawl_depth INTEGER,
    item_count INTEGER,
    crawl_stats JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Scrapy-specific items
CREATE TABLE scrapy_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawl_id UUID REFERENCES scrapy_crawls(crawl_id),
    item_type VARCHAR(50),
    url TEXT,
    scraped_data JSONB,
    depth INTEGER,
    referer TEXT,
    scraped_at TIMESTAMP DEFAULT NOW()
);
```

### File Structure

```
server/beta/
├── shared/
│   ├── domainRegistry.ts      # Shared domain management
│   ├── runTracker.ts          # Shared run tracking
│   └── types.ts               # Common interfaces
├── playwright/
│   ├── playwrightIndex.ts     # Playwright routes
│   ├── playwrightService.ts   # Business logic
│   ├── playwrightStorage.ts   # Database access
│   └── schema.sql             # Playwright tables
├── scrapy/
│   ├── scrapyIndex.ts
│   ├── scrapyService.ts
│   ├── scrapyStorage.ts
│   └── schema.sql
├── crawlee/
│   └── ... similar structure
└── betaRouter.ts              # Main router aggregator

client/src/pages/beta-testing/
├── index.tsx                  # Landing page with method selector
├── playwright/
│   └── PlaywrightDumpPage.tsx
├── scrapy/
│   └── ScrapyDumpPage.tsx
└── ... other methods
```

### API Routes Structure

```
/api/beta/                     # Landing/health check
/api/beta/methods              # List available methods

# Playwright routes
/api/beta/playwright/test      # Run test
/api/beta/playwright/results   # Get results
/api/beta/playwright/dumps     # List dumps
/api/beta/playwright/dump/:id  # Get specific dump

# Scrapy routes (different structure if needed)
/api/beta/scrapy/crawl         # Start crawl
/api/beta/scrapy/crawls        # List crawls
/api/beta/scrapy/items/:crawl_id # Get crawled items

# Shared routes
/api/beta/domains              # Domain registry
/api/beta/runs                 # Cross-method runs
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Create shared domain registry and run tracker
2. Implement new beta landing page with method selector
3. Set up routing structure
4. Create base interfaces

### Phase 2: Playwright Migration (Week 2)
1. Move existing Playwright code to new structure
2. Create Playwright-specific tables
3. Update UI to new routing
4. Test in isolation

### Phase 3: Add New Methods (Week 3+)
1. Implement Scrapy integration
2. Add Crawlee support
3. Add Puppeteer dump
4. Each can be developed independently

## Benefits

1. **Development Flexibility**
   - Work on any method without touching others
   - Different developers can work simultaneously
   - Easy to experiment with new approaches

2. **Technical Freedom**
   - Each method can use optimal storage
   - Different schema designs per method
   - Can even use different databases (PostgreSQL, SQLite, Redis)

3. **Operational Independence**
   - Deploy updates to one method only
   - Scale methods independently
   - Different retention policies per method

4. **Easy Integration**
   - New methods just plug in
   - No modification of existing code
   - Clear boundaries and interfaces

## Considerations

1. **Cross-Method Queries**
   - Use JOIN on shared tables when needed
   - Consider materialized views for common queries
   - May need aggregation service later

2. **Storage Management**
   - Each method manages its own storage
   - Need monitoring for disk usage
   - Consider S3/object storage for large dumps

3. **Testing Strategy**
   - Each method has independent tests
   - Integration tests for shared components
   - No cross-method test dependencies

## Migration Strategy

1. Keep existing beta platform running
2. Build new structure in parallel
3. Migrate Playwright first as proof of concept
4. Gradually move traffic to new structure
5. Deprecate old platform once stable

## Future Extensions

- GraphQL federation for unified queries
- Method-specific optimization services
- Pluggable storage backends
- Method marketplace for community contributions

## Decision Required

Before proceeding, need approval on:
1. Federation approach vs monolithic
2. Separate databases vs shared with namespacing
3. Development timeline and priorities
4. Which methods to implement first