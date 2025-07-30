# Crawlee Integration Plan for Beta Testing Platform V2

## Executive Summary
Add Crawlee as the third data collection method in the Beta Testing Platform V2, following the established federated architecture pattern. Crawlee will provide advanced web crawling capabilities with support for both Puppeteer and Playwright backends, request queuing, and sophisticated crawling strategies.

## Crawlee Overview
Crawlee is a powerful web scraping and browser automation library that offers:
- Multiple browser engines (Puppeteer, Playwright)
- Smart request queue management
- Automatic retry and error handling
- Session rotation and proxy support
- Advanced crawling patterns (BFS, DFS)
- Built-in data extraction helpers
- Memory and CPU management

## Architecture Design

### Directory Structure
```
server/beta-v2/
├── crawlee-dump/
│   ├── crawleeDumpIndex.ts       # Express routes for Crawlee
│   ├── crawleeDumpService.ts     # Core Crawlee logic
│   ├── crawleeDumpStorage.ts     # Database operations
│   ├── crawleeDumpTypes.ts       # TypeScript interfaces
│   └── schema.sql                # Crawlee-specific tables

client/src/pages/beta-testing-v2/
├── crawlee-dump/
│   └── CrawleeDumpPage.tsx       # UI for Crawlee dumps
```

### Database Schema
```sql
-- Crawlee dumps table
CREATE TABLE IF NOT EXISTS crawlee_dumps (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  crawler_type TEXT DEFAULT 'playwright', -- 'playwright' or 'puppeteer'
  crawl_config JSONB DEFAULT '{}',
  pages_crawled INTEGER DEFAULT 0,
  total_links_found INTEGER DEFAULT 0,
  raw_data JSONB,
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crawlee pages table (for multi-page crawls)
CREATE TABLE IF NOT EXISTS crawlee_pages (
  id SERIAL PRIMARY KEY,
  dump_id INTEGER REFERENCES crawlee_dumps(id),
  url TEXT NOT NULL,
  title TEXT,
  content_type TEXT,
  status_code INTEGER,
  page_data JSONB,
  extraction_data JSONB,
  crawled_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_crawlee_dumps_domain ON crawlee_dumps(domain);
CREATE INDEX idx_crawlee_dumps_status ON crawlee_dumps(status);
CREATE INDEX idx_crawlee_pages_dump_id ON crawlee_pages(dump_id);
```

### API Routes
```
# Crawlee-specific routes
POST   /api/beta/crawlee-dump/crawl          # Start a crawl
GET    /api/beta/crawlee-dump/crawls         # List crawls
GET    /api/beta/crawlee-dump/crawl/:id      # Get crawl details
GET    /api/beta/crawlee-dump/crawl/:id/pages # Get crawled pages
DELETE /api/beta/crawlee-dump/crawl/:id      # Cancel/delete crawl
POST   /api/beta/crawlee-dump/config         # Test crawl configuration
```

## Implementation Plan

### Phase 1: Core Infrastructure (Day 1)
1. **Install Crawlee**
   ```bash
   npm install crawlee
   ```

2. **Create Database Schema**
   - Add crawlee_dumps and crawlee_pages tables
   - Update beta_v2 database initialization

3. **Basic Service Structure**
   - Create crawleeDumpService.ts with minimal crawler
   - Implement basic single-page crawling
   - Store raw HTML and metadata

### Phase 2: Advanced Features (Day 2)
1. **Multi-page Crawling**
   - Implement request queue for crawling multiple pages
   - Add depth limiting and URL filtering
   - Store page relationships

2. **Data Extraction**
   - Extract structured data (JSON-LD, microdata)
   - Capture page metadata (title, description, images)
   - Extract legal entity signals (terms, privacy, about pages)

3. **Configuration Options**
   - Browser selection (Playwright vs Puppeteer)
   - Crawl depth and page limits
   - Custom selectors and extraction rules

### Phase 3: UI Development (Day 3)
1. **Crawlee Dump Page**
   - Domain input with configuration options
   - Real-time crawl progress display
   - Results viewer with page hierarchy

2. **Integration with Beta V2 Landing**
   - Add Crawlee option to method selector
   - Update health check to include Crawlee

## Key Features to Implement

### 1. Smart Crawling Strategy
```typescript
interface CrawlConfig {
  maxDepth: number;          // Default: 2
  maxPages: number;          // Default: 50
  includePaths: string[];    // e.g., ['/about', '/company', '/legal']
  excludePaths: string[];    // e.g., ['/blog', '/news']
  crawlerType: 'playwright' | 'puppeteer';
  waitForSelector?: string;  // Wait for specific content
  extractSelectors?: {       // Custom extraction
    companyName?: string;
    legalInfo?: string;
  };
}
```

### 2. Enhanced Data Collection
- **Page Content**: Full HTML, cleaned text, markdown
- **Visual Data**: Screenshots (full page + above fold)
- **Structured Data**: JSON-LD, Open Graph, Twitter cards
- **Links Analysis**: Internal/external links, sitemap
- **Legal Signals**: Terms, privacy policy, legal notices
- **Technical Data**: Response headers, load times, resources

### 3. Comparison with Existing Methods

| Feature | Playwright Dump | Scrapy Crawl | Crawlee Dump |
|---------|----------------|--------------|--------------|
| Single Page | ✓ | ✗ | ✓ |
| Multi Page | ✗ | ✓ | ✓ |
| JavaScript | ✓ | ✗ | ✓ |
| Request Queue | ✗ | ✓ | ✓ |
| Error Recovery | Basic | Good | Excellent |
| Memory Management | Manual | Basic | Advanced |
| Proxy Support | ✗ | ✗ | ✓ |

## Integration Points

### 1. With OpenRouter Models
- Crawlee can collect comprehensive data for LLM analysis
- Multi-page context provides better entity extraction
- Structured data helps reasoning models

### 2. With Existing Dumps
- Can reference Playwright dumps for comparison
- Share domain registry for deduplication
- Cross-method analysis capabilities

### 3. With Main Application
- Export crawled data to main entity extraction pipeline
- Use crawled legal pages for verification
- Enhance GLEIF matching with more context

## Success Metrics
1. **Performance**: Crawl 50 pages in under 60 seconds
2. **Reliability**: 95% success rate on accessible domains
3. **Data Quality**: Extract structured data from 80% of pages
4. **Memory Efficiency**: Stay under 500MB for typical crawls

## Risk Mitigation
1. **Memory Leaks**: Use Crawlee's built-in resource management
2. **Infinite Crawls**: Strict limits on depth and page count
3. **Rate Limiting**: Implement delays and concurrent request limits
4. **Browser Crashes**: Automatic restart and resume capability

## Future Enhancements
1. **Session Management**: Login and authenticated crawling
2. **API Integration**: Combine with API discovery
3. **Change Detection**: Track website changes over time
4. **Export Formats**: Direct export to LLM-ready formats
5. **Visual Analysis**: Use screenshots for layout understanding

## Implementation Timeline
- **Day 1**: Core infrastructure and basic crawling
- **Day 2**: Advanced features and multi-page support  
- **Day 3**: UI development and integration
- **Day 4**: Testing and optimization
- **Day 5**: Documentation and deployment

This plan ensures Crawlee integration follows the established Beta V2 patterns while leveraging its unique capabilities for comprehensive web data collection.