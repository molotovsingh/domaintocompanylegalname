# Beta V2 Axios + Cheerio Implementation Plan

## Date: July 31, 2025

## Overview
Add Axios + Cheerio as the fourth collection method in Beta Testing Platform V2, providing ultra-fast baseline extraction for static content analysis.

## Business Value
- **Speed Baseline**: 10x faster than browser methods (100-500ms vs 5-15s)
- **Resource Efficiency**: Minimal CPU/memory usage
- **Clear Decision Making**: Shows exactly when browser rendering is needed
- **Cost Optimization**: Use lightest method that works

## Architecture Design

### 1. Service Structure
```
server/beta-v2/axios-cheerio-dump/
├── axiosCheerioService.ts      # Main service class
├── axiosCheerioStorage.ts      # Database operations
├── axiosCheerioTypes.ts        # TypeScript interfaces
├── axiosCheerioRoutes.ts       # API endpoints
├── axiosCheerioIndex.ts        # Router registration
└── public/
    └── index.html              # UI for Axios+Cheerio tab
```

### 2. Database Schema
```sql
-- New table in beta_v2 database
CREATE TABLE axios_cheerio_dumps (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Extraction results
  company_name TEXT,
  extraction_method VARCHAR(100),
  confidence_score INTEGER,
  
  -- Technical data
  http_status INTEGER,
  response_time_ms INTEGER,
  html_size_bytes INTEGER,
  
  -- Raw data
  raw_html TEXT,
  headers JSONB,
  meta_tags JSONB,
  
  -- Extraction details
  extraction_strategies JSONB,  -- Array of attempted strategies
  page_metadata JSONB,          -- Title, description, etc.
  
  -- Error handling
  error_message TEXT,
  error_details JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Processing stats
  processing_time_ms INTEGER
);

-- Index for fast lookups
CREATE INDEX idx_axios_cheerio_domain ON axios_cheerio_dumps(domain);
CREATE INDEX idx_axios_cheerio_status ON axios_cheerio_dumps(status);
```

### 3. Integration Points

#### With Beta Data Processing
- Axios+Cheerio dumps available as source type 'axios_cheerio_dump'
- Raw HTML can be processed with any of the 10 LLM models
- Enables comparison: raw extraction vs LLM-enhanced extraction

#### With Existing UI
- New tab in Beta Testing V2: "Axios + Cheerio"
- Consistent UI pattern with other methods
- Real-time status updates

## Implementation Steps

### Phase 1: Backend Foundation (Day 1)

#### Step 1.1: Create Service Structure
```typescript
// axiosCheerioTypes.ts
export interface AxiosCheerioConfig {
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export interface AxiosCheerioData {
  rawHtml: string;
  headers: Record<string, string>;
  metaTags: MetaTag[];
  extractionResults: ExtractionResult;
  pageMetadata: PageMetadata;
}

export interface ExtractionResult {
  companyName: string | null;
  extractionMethod: string | null;
  confidence: number;
  alternativeCandidates: CompanyCandidate[];
}
```

#### Step 1.2: Implement Core Service
```typescript
// axiosCheerioService.ts
export class AxiosCheerioService {
  constructor(private storage: AxiosCheerioStorage) {}
  
  async startExtraction(domain: string, config?: AxiosCheerioConfig): Promise<number> {
    // Create database entry
    const dumpId = await this.storage.createDump(domain);
    
    // Start extraction in background
    this.performExtraction(dumpId, domain, config)
      .catch(error => {
        this.storage.updateDumpStatus(dumpId, 'failed', error.message);
      });
    
    return dumpId;
  }
  
  private async performExtraction(
    dumpId: number, 
    domain: string, 
    config?: AxiosCheerioConfig
  ): Promise<void> {
    // Reuse existing AxiosCheerioExtractor logic
    // Add enhanced error handling and progress tracking
  }
}
```

#### Step 1.3: Database Storage Layer
```typescript
// axiosCheerioStorage.ts
export class AxiosCheerioStorage {
  async createDump(domain: string): Promise<number> {
    // Insert into axios_cheerio_dumps table
  }
  
  async updateDumpData(
    dumpId: number, 
    data: AxiosCheerioData, 
    processingTime: number
  ): Promise<void> {
    // Update with extraction results
  }
  
  async getDumpStatus(dumpId: number): Promise<DumpStatus> {
    // Get current status and results
  }
}
```

### Phase 2: API Endpoints (Day 1-2)

#### Step 2.1: Create Routes
```typescript
// axiosCheerioRoutes.ts
router.post('/start', async (req, res) => {
  const { domain, config } = req.body;
  const dumpId = await service.startExtraction(domain, config);
  res.json({ dumpId, status: 'started' });
});

router.get('/status/:dumpId', async (req, res) => {
  const status = await service.getDumpStatus(req.params.dumpId);
  res.json(status);
});

router.get('/results/:dumpId', async (req, res) => {
  const results = await service.getResults(req.params.dumpId);
  res.json(results);
});
```

### Phase 3: Frontend Integration (Day 2)

#### Step 3.1: Create UI Component
- Copy existing Crawlee/Scrapy UI pattern
- Add Axios+Cheerio specific options:
  - Timeout configuration
  - User agent selection
  - Follow redirects toggle

#### Step 3.2: Real-time Updates
- WebSocket or polling for status updates
- Show extraction progress:
  - Connecting...
  - Downloading HTML...
  - Extracting company name...
  - Complete!

### Phase 4: Beta Data Processing Integration (Day 2-3)

#### Step 4.1: Update CleaningService
```typescript
// Add to getAvailableDumps()
const axiosCheerioResult = await executeBetaV2Query(`
  SELECT id, domain, created_at, 
         html_size_bytes as size,
         company_name,
         confidence_score
  FROM axios_cheerio_dumps
  WHERE status = 'completed'
  ORDER BY created_at DESC
  LIMIT 20
`);
```

#### Step 4.2: Enable LLM Processing
- Add 'axios_cheerio_dump' as source type
- Extract raw HTML for LLM processing
- Compare raw extraction vs LLM results

### Phase 5: Testing & Documentation (Day 3)

#### Step 5.1: Test Suite
```typescript
// Test extraction strategies
describe('AxiosCheerioExtractor', () => {
  it('extracts from meta tags', async () => {
    // Test og:site_name extraction
  });
  
  it('falls back to title tag', async () => {
    // Test title extraction
  });
  
  it('handles timeouts gracefully', async () => {
    // Test timeout handling
  });
});
```

#### Step 5.2: Documentation
- Add to Beta V2 documentation
- Include performance benchmarks
- Show when to use each method

## Technical Enhancements

### 1. Enhanced Extraction Strategies
Beyond existing strategies, add:
- JSON-LD structured data extraction
- Schema.org organization data
- Footer copyright extraction
- Logo alt text analysis

### 2. Smart Redirect Handling
- Follow up to 3 redirects
- Detect redirect loops
- Handle www vs non-www

### 3. Performance Optimizations
- Connection pooling
- DNS caching
- Compression support

## Success Metrics

1. **Speed**: Average extraction time < 500ms
2. **Success Rate**: > 70% for static sites
3. **Accuracy**: Confidence score correlates with correctness
4. **Resource Usage**: < 50MB memory per extraction

## Risk Mitigation

1. **Rate Limiting**: Implement request throttling
2. **Timeouts**: Configurable timeout with reasonable defaults
3. **Large HTML**: Limit processing to first 1MB of HTML
4. **SSL Issues**: Option to ignore certificate errors

## Timeline

- **Day 1**: Backend service implementation
- **Day 2**: API endpoints and UI
- **Day 3**: Integration and testing
- **Total**: 3 days to production

## Future Enhancements

1. **Batch Processing**: Extract multiple domains in parallel
2. **Caching Layer**: Cache results for repeated domains
3. **Advanced Selectors**: User-defined CSS selectors
4. **Screenshot Capture**: Optional screenshot via separate service
5. **Performance Analytics**: Track extraction patterns by industry

## Comparison with Other Methods

| Feature | Axios+Cheerio | Scrapy | Crawlee | Playwright |
|---------|---------------|---------|----------|------------|
| Speed | ⚡ 100-500ms | 🚀 1-3s | 🏃 2-5s | 🐢 5-15s |
| JS Support | ❌ | ❌ | ✅ | ✅ |
| Multi-page | ❌ | ✅ | ✅ | ✅ |
| Resource Use | Minimal | Low | Medium | High |
| Best For | Static sites | Crawling | Advanced | Complex JS |

## Conclusion

Adding Axios + Cheerio completes the extraction method spectrum, providing users with a full range of options from ultra-light to heavy browser automation. This enables data-driven decisions about which extraction method to use for each domain, optimizing both performance and accuracy.