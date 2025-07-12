
# Beta Services - Extraction Methods

## Purpose
This folder contains standalone extraction services for the beta testing environment. Each extractor implements a different approach to company name extraction from domain websites.

## Available Extractors

### `axiosCheerioExtractor.ts`
- **Method**: HTTP request + HTML parsing
- **Best for**: Fast extraction from static content
- **Pros**: Lightweight, fast, good for simple sites
- **Cons**: Cannot handle JavaScript-rendered content
- **Use when**: Site content is server-rendered

### `puppeteerExtractor.ts` 
- **Method**: Full browser automation with Chromium
- **Best for**: JavaScript-heavy sites, dynamic content
- **Pros**: Handles all modern web features, most comprehensive
- **Cons**: Resource intensive, slower
- **Use when**: Site requires JavaScript rendering

### `playwrightExtractor.ts`
- **Method**: Browser automation (alternative to Puppeteer)
- **Best for**: Cross-browser compatibility needs
- **Pros**: Multi-browser support, modern API
- **Cons**: Resource intensive
- **Use when**: Need specific browser engines

### `perplexityExtractor.ts`
- **Method**: AI-powered extraction via Perplexity API
- **Best for**: Complex company identification
- **Pros**: Intelligent analysis, handles edge cases
- **Cons**: API costs, external dependency
- **Use when**: Other methods fail or need high accuracy

### `gleifExtractor.ts`
- **Method**: Official entity verification via GLEIF API
- **Best for**: Legal entity validation and enrichment
- **Pros**: Authoritative data, official records
- **Cons**: Limited to registered entities
- **Use when**: Need official company verification

## Usage Pattern

1. **Start with**: `axiosCheerioExtractor` for speed
2. **Fallback to**: `puppeteerExtractor` for dynamic content
3. **Enhance with**: `gleifExtractor` for official validation
4. **Last resort**: `perplexityExtractor` for complex cases

## Integration

Each extractor follows the same interface pattern:
- `initialize()` - Setup the extractor
- `extractFromDomain(domain)` - Extract company data
- `close()` - Cleanup resources

## Database Integration

All extractors integrate with the beta database via `server/betaDb.ts` for isolated testing.
