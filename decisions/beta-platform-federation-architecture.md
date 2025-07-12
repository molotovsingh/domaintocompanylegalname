# Beta Platform Federation Architecture Plan

## Executive Summary
Build a new Beta Testing Platform v2 with a federated microservice-like architecture where each data collection method operates as an independent module with its own database, API routes, and storage strategy. The existing Beta Platform v1 will continue running unchanged during the transition period.

## Current Problems with Beta v1
1. Single `betaIndex.ts` becoming unwieldy and hard to maintain
2. Adding new methods requires modifying existing code
3. Risk of breaking working methods when adding features
4. All methods forced to share same schema/storage approach
5. Difficult to develop and test methods in isolation
6. Mixing data collection with extraction logic in same layer

## Strategy: Parallel Development
Rather than attempting a complex migration, we will:
1. **Keep Beta v1 running as-is** - No changes, no risk
2. **Build Beta v2 fresh** - Clean architecture from day one
3. **Run both in parallel** - Gradual transition
4. **Archive v1** - Once v2 is proven and adopted

## Proposed Architecture for Beta v2

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
# Beta v1 (Existing - No Changes)
server/betaIndex.ts                    # Current beta platform
server/betaServices/                   # Current services
client/src/pages/beta-testing.tsx      # Current UI

# Beta v2 (New Federation Architecture)
server/beta-v2/
├── shared/
│   ├── domainRegistry.ts      # Shared domain management
│   ├── runTracker.ts          # Shared run tracking
│   └── types.ts               # Common interfaces
├── playwright-dump/
│   ├── playwrightDumpIndex.ts     # Playwright routes
│   ├── playwrightDumpService.ts   # Pure dump logic
│   ├── playwrightDumpStorage.ts   # Database access
│   └── schema.sql                 # Playwright tables
├── scrapy-dump/
│   ├── scrapyDumpIndex.ts
│   ├── scrapyDumpService.ts
│   ├── scrapyDumpStorage.ts
│   └── schema.sql
├── crawlee-dump/
│   └── ... similar structure
└── betaV2Router.ts              # Main v2 router

client/src/pages/beta-testing-v2/
├── index.tsx                      # v2 Landing with method selector
├── playwright-dump/
│   └── PlaywrightDumpPage.tsx
├── scrapy-dump/
│   └── ScrapyDumpPage.tsx
└── ... other methods
```

### API Routes Structure

```
# Beta v1 (Existing - Unchanged)
/api/beta/*                    # All current beta routes remain

# Beta v2 (New Routes)
/api/beta-v2/                          # v2 Landing/health check
/api/beta-v2/methods                   # List available methods

# Playwright Dump routes
/api/beta-v2/playwright-dump/test      # Run dump
/api/beta-v2/playwright-dump/results   # Get results
/api/beta-v2/playwright-dump/dumps     # List dumps
/api/beta-v2/playwright-dump/dump/:id  # Get specific dump

# Scrapy Dump routes
/api/beta-v2/scrapy-dump/crawl         # Start crawl
/api/beta-v2/scrapy-dump/crawls        # List crawls
/api/beta-v2/scrapy-dump/items/:id     # Get items

# Shared v2 routes
/api/beta-v2/domains                   # Domain registry
/api/beta-v2/runs                      # Cross-method runs
```

## Implementation Plan

### Phase 1: Foundation Setup (Week 1)
1. Create Beta v2 directory structure alongside v1
2. Set up v2 database schemas (separate from v1)
3. Implement shared domain registry for v2
4. Create v2 landing page with method selector
5. Set up v2 routing (`/beta-testing-v2`)

### Phase 2: First Method - Playwright Dump (Week 2)
1. Build fresh Playwright Dump implementation
2. Focus on pure data collection (no extraction logic)
3. Store all raw data: HTML, screenshots, console logs, network data
4. Create simple UI for testing dumps
5. No migration of v1 logic - reference only if needed

### Phase 3: Add Additional Methods (Week 3+)
1. Scrapy Dump - Python integration for web crawling
2. Crawlee Dump - Advanced crawling capabilities
3. Puppeteer Dump - Alternative browser automation
4. Each method developed independently in isolation

### Transition Strategy

**During Development:**
- Beta v1 continues running at `/beta-testing`
- Beta v2 developed at `/beta-testing-v2`
- No shared code or dependencies between versions
- Developers can reference v1 code but don't modify it

**User Experience:**
1. Add link on main dashboard: "Try Beta Platform v2 (Preview)"
2. v1 remains default, v2 is opt-in
3. Clear labeling that v2 is experimental
4. Users can switch between versions freely

**Data Strategy:**
- v1 and v2 use separate database schemas
- No data migration during development
- If needed later, can build export/import tools
- Each version maintains its own data

**Sunset Timeline:**
1. v2 reaches feature parity (2-3 months)
2. Promote v2 to primary, v1 becomes legacy
3. Keep v1 running for reference (3-6 months)
4. Archive v1 code and decommission

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

## Key Principles of Parallel Development

1. **Zero Risk to v1**
   - No code changes to existing beta platform
   - v1 continues serving current needs
   - All experimentation happens in v2

2. **Fresh Start Benefits**
   - Clean separation of collection vs extraction
   - Proper federation from day one
   - No legacy constraints

3. **Reference, Don't Migrate**
   - v1 code available for algorithm reference
   - Copy specific logic only when needed
   - Build v2 patterns fresh

4. **Gradual Transition**
   - Users choose when to switch
   - Run both versions as long as needed
   - Natural migration as v2 matures

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