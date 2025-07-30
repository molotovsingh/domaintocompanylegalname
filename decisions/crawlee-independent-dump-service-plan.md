# Crawlee as Independent Dump Service - Beta V2

## Core Philosophy
Crawlee is an independent dump method in Beta V2, focused solely on collecting raw data. No extraction, no analysis - just comprehensive data collection using Crawlee's powerful crawling capabilities.

## What Crawlee Dumps

### Unique Capabilities
1. **Session Management** - Maintains cookies/state across pages
2. **Request Interception** - Captures API calls made by the site
3. **Parallel Crawling** - Efficient multi-page processing
4. **Smart Queue Management** - Handles large sites intelligently
5. **Automatic Retries** - Built-in resilience for flaky sites

### Data Collected (Raw Dumps Only)
```typescript
interface CrawleeDump {
  // Page Data
  pages: Array<{
    url: string;
    html: string;
    text: string;
    statusCode: number;
    headers: Record<string, string>;
    cookies: Array<Cookie>;
  }>;
  
  // Network Data
  requests: Array<{
    url: string;
    method: string;
    response: any;
    timestamp: number;
  }>;
  
  // Site Structure
  siteMap: {
    internal_links: string[];
    external_links: string[];
    sitemap_xml?: string;
    robots_txt?: string;
  };
  
  // Metadata
  crawlStats: {
    pages_crawled: number;
    time_taken_ms: number;
    errors: string[];
  };
}
```

## Implementation Structure

### Directory Layout
```
server/beta-v2/crawlee-dump/
├── crawleeDumpIndex.ts      # Routes
├── crawleeDumpService.ts    # Core crawling logic
├── crawleeDumpStorage.ts    # Database operations
└── schema.sql              # Tables
```

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS crawlee_dumps (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Configuration used
  max_pages INTEGER DEFAULT 10,
  max_depth INTEGER DEFAULT 2,
  
  -- Raw dump data
  dump_data JSONB,
  
  -- Stats
  pages_crawled INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_crawlee_dumps_domain ON crawlee_dumps(domain);
CREATE INDEX idx_crawlee_dumps_status ON crawlee_dumps(status);
```

## API Design

### Endpoints
```
POST /api/beta/crawlee-dump/dump
{
  "domain": "example.com",
  "config": {
    "maxPages": 10,      // Default: 10
    "maxDepth": 2,       // Default: 2
    "includePaths": [],  // Optional: Focus on specific paths
    "waitTime": 1000     // Default: 1000ms between requests
  }
}

GET /api/beta/crawlee-dump/dumps
- List all dumps with status

GET /api/beta/crawlee-dump/dump/:id
- Get specific dump data

GET /api/beta/crawlee-dump/dump/:id/download
- Download dump as JSON file
```

## Service Implementation

### Core Crawling Logic
```typescript
// crawleeDumpService.ts
import { PlaywrightCrawler, Dataset } from 'crawlee';

export async function executeCrawleeDump(domain: string, config: CrawlConfig) {
  const startTime = Date.now();
  const pages: PageData[] = [];
  const requests: NetworkRequest[] = [];
  
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: config.maxPages,
    maxRequestDepth: config.maxDepth,
    
    // Just collect data, no processing
    requestHandler: async ({ page, request, enqueueLinks }) => {
      // Collect raw HTML
      const html = await page.content();
      const text = await page.evaluate(() => document.body.innerText);
      
      // Collect network data
      const cdpSession = await page.context().newCDPSession(page);
      await cdpSession.send('Network.enable');
      
      // Store page data
      pages.push({
        url: request.url,
        html,
        text,
        statusCode: response?.status() || 0,
        headers: response?.headers() || {},
        cookies: await page.context().cookies()
      });
      
      // Enqueue more links
      await enqueueLinks({
        globs: [`https://${domain}/**`],
      });
    },
    
    failedRequestHandler: async ({ request }) => {
      console.log(`Failed: ${request.url}`);
    }
  });
  
  await crawler.run([`https://${domain}`]);
  
  return {
    pages,
    requests,
    siteMap: extractSiteStructure(pages),
    crawlStats: {
      pages_crawled: pages.length,
      time_taken_ms: Date.now() - startTime,
      errors: []
    }
  };
}
```

## UI Design

### Simple Dump Interface
```tsx
// CrawleeDumpPage.tsx
interface CrawleeDumpUI {
  // Input Section
  domainInput: string;
  
  // Configuration
  maxPages: number;        // Slider: 1-100
  maxDepth: number;        // Slider: 1-5
  waitTime: number;        // Slider: 100-5000ms
  
  // Actions
  startDump: () => void;
  downloadResults: () => void;
  
  // Display
  status: 'idle' | 'crawling' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
  };
  
  // Results Summary (no extraction data)
  results?: {
    pagesCrawled: number;
    totalSize: string;     // "2.3 MB"
    timeTaken: string;     // "15.2s"
    preview: string[];     // First 5 URLs crawled
  };
}
```

## Comparison with Other Dump Methods

| Feature | Playwright Dump | Scrapy Crawl | Crawlee Dump |
|---------|----------------|--------------|--------------|
| **Pages** | Single | Multiple | Multiple |
| **JavaScript** | Full | None | Full |
| **Session State** | Per page | Basic | Advanced |
| **Queue Management** | None | Basic | Advanced |
| **Network Capture** | Basic | None | Comprehensive |
| **Parallelization** | No | Yes | Yes |
| **Use Case** | Deep single page | Fast HTML crawl | Stateful JS sites |

## When to Use Crawlee Dumps

1. **E-commerce sites** - Session state for product pages
2. **Corporate sites** - Multiple related pages
3. **JavaScript apps** - SPAs with client-side routing
4. **API-heavy sites** - Capture AJAX/fetch requests
5. **Large sites** - Efficient queue management

## Future Pipeline Integration

While Crawlee focuses only on dumps, the data structure is designed for future services:

```
Crawlee Dumps → Cleaning Service → LLM Extraction → GLEIF Matching
     ↓               ↓                   ↓              ↓
  Raw Data      Clean Text         Company Names    LEI Codes
```

## Success Metrics

1. **Coverage**: Capture 95%+ of accessible pages
2. **Performance**: 10 pages in <30 seconds
3. **Reliability**: Handle JavaScript-heavy sites
4. **Storage**: Efficient JSONB compression
5. **Reusability**: Dumps can be reprocessed multiple times

## What We're NOT Doing
- ❌ Entity extraction
- ❌ Content analysis  
- ❌ GLEIF lookups
- ❌ Data cleaning
- ❌ LLM processing

## What We ARE Doing
- ✅ Comprehensive raw data collection
- ✅ Network request capture
- ✅ Session state preservation
- ✅ Efficient multi-page crawling
- ✅ Future-proof data structure

This positions Crawlee as a powerful, independent dump service that complements existing methods while maintaining clear separation of concerns.