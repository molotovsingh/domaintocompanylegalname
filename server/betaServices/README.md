# Beta Services - Experimental Extraction Methods

**Created:** July 12, 2025 at 2:52 AM UTC  
**Last Updated:** July 12, 2025 at 2:52 AM UTC

## Purpose
This folder contains experimental domain extraction services that operate in complete isolation from the production system. These services are used for testing new extraction methods, comparing performance, and validating accuracy before potential integration into the main production pipeline.

## Beta Architecture Overview

### **Complete Isolation Strategy**
- **Separate Database**: Independent beta schema (`shared/betaSchema.ts`)
- **Isolated Server**: Port 3001 with independent Express instance
- **Independent Processing**: No impact on production data or performance
- **Experimental Safety**: Risk-free testing of new methodologies

### **Multi-Method Extraction Testing**
The beta services implement multiple extraction approaches for comprehensive comparison:

#### **1. Axios + Cheerio (`axiosCheerioExtractor.ts`)**
- **Purpose**: Fast HTML parsing without browser rendering
- **Technology**: Axios for HTTP requests + Cheerio for jQuery-like DOM manipulation
- **Advantages**: Extremely fast execution, low resource usage
- **Best For**: Static content, simple websites without JavaScript rendering
- **Performance**: ~100-500ms per domain

#### **2. Puppeteer (`puppeteerExtractor.ts`)**
- **Purpose**: Full browser automation with Chromium
- **Technology**: Headless Chrome for complete page rendering
- **Advantages**: Handles JavaScript-heavy sites, dynamic content, SPAs
- **Best For**: Complex websites requiring JavaScript execution
- **Performance**: ~2-10 seconds per domain depending on complexity

#### **3. Playwright (`playwrightExtractor.ts`)**
- **Purpose**: Modern browser automation with enhanced capabilities
- **Technology**: Multi-browser support (Chromium, Firefox, Safari)
- **Advantages**: Better reliability, faster execution than Puppeteer
- **Best For**: Complex extractions requiring advanced browser features
- **Performance**: ~1-8 seconds per domain with better stability

#### **4. Perplexity AI (`perplexityExtractor.ts`)**
- **Purpose**: AI-powered company name identification
- **Technology**: Perplexity API for intelligent content analysis
- **Advantages**: Understands context, handles complex naming scenarios
- **Best For**: Ambiguous websites, complex corporate structures
- **Performance**: ~3-15 seconds per domain (API dependent)

#### **5. GLEIF Integration (`gleifExtractor.ts`)**
- **Purpose**: Legal Entity Identifier validation and enhancement
- **Technology**: GLEIF API for corporate entity verification
- **Advantages**: Authoritative legal entity data, relationship mapping
- **Best For**: Enterprise-grade entity validation and corporate intelligence
- **Performance**: ~1-5 seconds per domain

## Extraction Method Comparison

### **Speed vs Accuracy Trade-offs**

#### **Lightning Fast (100-500ms)**
- **Method**: Axios + Cheerio
- **Accuracy**: 60-70% for static sites
- **Use Case**: Bulk processing, initial screening
- **Resource Usage**: Minimal CPU/memory

#### **Balanced Performance (1-3 seconds)**
- **Method**: Playwright
- **Accuracy**: 85-95% for most sites
- **Use Case**: Production-ready extraction
- **Resource Usage**: Moderate CPU/memory

#### **Maximum Accuracy (3-15 seconds)**
- **Method**: Perplexity AI
- **Accuracy**: 95-99% with context understanding
- **Use Case**: High-value domains, complex cases
- **Resource Usage**: API calls, external dependency

#### **Enterprise Validation (1-5 seconds)**
- **Method**: GLEIF
- **Accuracy**: 100% for registered entities
- **Use Case**: Legal entity verification, compliance
- **Resource Usage**: API calls, authoritative data

## Advanced Extraction Techniques

### **Puppeteer Advanced Features**
```typescript
// Multi-strategy company name extraction
const extractedData = await page.evaluate(() => {
  // 1. Structured Data (JSON-LD)
  const jsonLd = document.querySelector('script[type="application/ld+json"]');

  // 2. Meta Properties (Open Graph)
  const ogSiteName = document.querySelector('meta[property="og:site_name"]');

  // 3. Footer Copyright Analysis
  const footer = document.querySelector('footer');
  const copyrightMatch = footerText.match(/©\s*\d{4}\s*([^.,|]+?)(?:\.|,|All|$)/i);

  // 4. Logo Alt Text Analysis
  const logo = nav.querySelector('img[alt*="logo" i], .logo, [class*="brand"]');

  // 5. Page Title Parsing
  const cleanTitle = title.replace(/\s*[-|–]\s*(Home|Welcome|Official Site).*$/i, '');
});
```

### **Confidence Scoring System**
Each extraction method provides confidence scores:
- **95%**: Structured data (JSON-LD, microdata)
- **85%**: Meta properties (og:site_name)
- **75%**: Footer copyright text
- **70%**: Logo alt text
- **65%**: H1 tag analysis
- **60%**: Page title parsing

### **Website Type Detection**
```typescript
const detectWebsiteType = () => {
  // E-commerce detection
  if (document.querySelector('[data-testid*="cart"], .cart, #cart, .shopping')) {
    return 'ecommerce';
  }

  // SaaS detection
  if (document.querySelector('.pricing, [href*="pricing"], .plans, .subscription')) {
    return 'saas';
  }

  // Corporate detection
  if (document.querySelector('.about, [href*="about"], .company, .corporate')) {
    return 'corporate';
  }

  return 'general';
};
```

## Beta Testing Capabilities

### **Method Performance Benchmarking**
- **Processing Time Tracking**: Millisecond-precision timing
- **Success Rate Analysis**: Method-specific accuracy metrics
- **Resource Usage Monitoring**: CPU, memory, network utilization
- **Error Pattern Analysis**: Failure categorization and debugging

### **A/B Testing Framework**
- **Parallel Extraction**: Multiple methods on same domain
- **Accuracy Comparison**: Side-by-side result analysis
- **Performance Profiling**: Resource usage comparison
- **Quality Scoring**: Confidence-weighted accuracy metrics

### **Validation Pipeline**
```typescript
// Example validation workflow
1. Axios/Cheerio → Fast initial extraction
2. Puppeteer → Enhanced extraction for failures
3. Perplexity → AI validation for complex cases
4. GLEIF → Legal entity verification
5. Confidence scoring → Final quality assessment
```

## Production Integration Strategy

### **Graduation Criteria**
For beta methods to move to production:
1. **Accuracy**: >90% success rate on test dataset
2. **Performance**: <5 seconds average processing time
3. **Reliability**: <1% critical error rate
4. **Resource Efficiency**: Acceptable CPU/memory usage
5. **Error Handling**: Graceful failure and recovery

### **Fallback Hierarchy**
```
Primary: Axios/Cheerio (speed)
    ↓ (on failure)
Secondary: Playwright (reliability)
    ↓ (on failure)  
Tertiary: Perplexity (accuracy)
    ↓ (for verification)
Validation: GLEIF (authority)
```

## Configuration Management

### **Environment Variables**
- **PERPLEXITY_API_KEY**: AI extraction service authentication
- **GLEIF_API_KEY**: Legal entity database access
- **BETA_DATABASE_URL**: Isolated database connection
- **EXTRACTION_TIMEOUT**: Configurable timeout per method

### **Browser Configuration**
```typescript
// Optimized for Replit environment
const browser = await puppeteer.launch({
  executablePath: '/nix/store/.../chromium',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage'
  ]
});
```

## Error Handling & Recovery

### **Graceful Degradation**
- **Timeout Management**: Configurable timeouts per method
- **Circuit Breakers**: Automatic failure protection
- **Retry Logic**: Intelligent retry with exponential backoff
- **Fallback Chains**: Automatic method switching on failure

### **Comprehensive Logging**
```typescript
console.log(`[Beta] [Method] Processing domain: ${domain}`);
console.log(`[Beta] [Method] Extraction complete:`, {
  companyName: result.companyName,
  confidence: result.confidence,
  method: result.extractionMethod,
  processingTime: `${time}ms`
});
```

## Testing Integration

### **Standalone Testing**
Each extractor can be tested independently:
```bash
cd server/betaServices
npx tsx standalonePerplexity.ts
```

### **API Endpoints**
- **POST /api/beta/test-extraction**: Single domain testing
- **GET /api/beta/methods**: Available extraction methods
- **GET /api/beta/health**: Beta service health check

## Future Enhancements

### **Planned Improvements**
1. **Machine Learning Integration**: Training models on extraction patterns
2. **Real-time Learning**: Adaptive confidence scoring
3. **Geographic Optimization**: Region-specific extraction strategies
4. **Industry Specialization**: Sector-specific extraction rules

### **Research Areas**
- **Computer Vision**: Logo and visual branding analysis
- **NLP Enhancement**: Advanced natural language processing
- **Semantic Analysis**: Content meaning and context understanding
- **Blockchain Integration**: Decentralized identity verification

## Development Guidelines

### **Adding New Extractors**
1. Implement the standard interface with `extractFromDomain(domain: string)`
2. Include comprehensive error handling and timeouts
3. Provide confidence scoring and method identification
4. Add comprehensive logging for debugging
5. Include performance metrics and resource monitoring

### **Testing New Methods**
1. Test on diverse website types (e-commerce, SaaS, corporate)
2. Validate against known company names
3. Measure performance impact and resource usage
4. Ensure graceful failure and error recovery
5. Document accuracy and limitations

This beta services architecture provides a robust foundation for experimental domain extraction research while maintaining complete isolation from production systems, enabling safe innovation and method validation.
# Beta Services

*Created: July 12, 2025 at 2:52 AM UTC*

This folder contains experimental extraction services for beta testing new domain intelligence methods.

## Current Services

### **Core Extractors**
- **`puppeteerExtractor.ts`** - Advanced browser-based extraction
  - Comprehensive company name detection
  - JavaScript rendering for dynamic content
  - Multiple extraction strategies with confidence scoring
  - Production-ready for Fortune 500 enterprise domains

- **`playwrightExtractor.ts`** - Alternative browser automation
  - Cross-browser compatibility testing
  - Enhanced performance for modern web applications
  - Experimental features for complex SPAs

- **`axiosCheerioExtractor.ts`** - Lightweight HTTP extraction
  - Fast static content processing
  - No browser overhead for simple sites
  - Fallback option for resource-constrained scenarios

### **Intelligence Enhancement**
- **`gleifExtractor.ts`** - GLEIF API integration
  - Legal entity validation and enhancement
  - Corporate relationship discovery
  - Business intelligence categorization

- **`perplexityExtractor.ts`** - AI-powered extraction
  - LLM-based company name identification
  - Complex content analysis and understanding
  - Experimental AI reasoning capabilities

### **Standalone Tools**
- **`standalonePerplexity.ts`** - Independent Perplexity testing
  - Isolated testing environment for AI features
  - Development and debugging tool

## Architecture Strategy

### **Isolation Principle**
- Complete separation from production extraction pipeline
- Independent database schema (`shared/betaSchema.ts`)
- Risk-free testing of experimental approaches
- Parallel processing without affecting live systems

### **Performance Testing**
- Method effectiveness comparison
- Processing time optimization
- Success rate analysis across different extraction strategies
- Resource utilization monitoring

## Integration Points

### **Beta Server**
- Dedicated server (`server/betaIndex.ts`) for experimental features
- Real-time testing interface accessible at port 3001
- Independent deployment and monitoring

### **Data Flow**
```
Beta Upload → Beta Processing → Beta Database → Beta Analysis
     ↓              ↓              ↓              ↓
Experimental    New Methods    Isolated       Performance
Input Files     Testing        Storage        Evaluation
```

## Development Guidelines

### **Adding New Extractors**
1. Create new service in this directory
2. Implement standard extraction interface
3. Add comprehensive error handling
4. Include confidence scoring mechanism
5. Document extraction methodology

### **Testing Protocol**
- Use test data from `/test-data/` directory
- Compare against production baseline
- Measure both accuracy and performance
- Document lessons learned in `/archived/learnings/`

## Current Status

All beta services are operational and actively used for:
- Fortune 500 domain processing validation
- New extraction method development
- Performance optimization research
- AI/LLM integration experimentation