
# Services - Core Business Logic

## Purpose
This folder contains the core business logic services that power the Domain Intelligence Platform. These services handle everything from domain processing to GLEIF integration and batch management.

## Service Categories

### **Processing Services**
- **`processor.ts`** - Main batch processing orchestrator with Level 2 GLEIF enhancement
- **`domainExtractor.ts`** - Core domain company name extraction with multiple methods
- **`fileProcessor.ts`** - File upload and domain parsing functionality
- **`batch-recovery.ts`** - Automatic stuck domain recovery and batch monitoring

### **GLEIF Integration Services**
- **`gleifService.ts`** - Complete GLEIF API integration with multi-candidate processing
- **`gleifKnowledgeBase.ts`** - Accumulates comprehensive GLEIF entity intelligence
- **`gleifValidationService.ts`** - Enhanced accuracy validation preventing false positives
- **`gleifUpdateService.ts`** - Periodic entity intelligence synchronization

### **Export & Analytics Services**
- **`enhancedExportService.ts`** - Comprehensive data export with business intelligence
- **`batchLogger.ts`** - Advanced logging with AI-ready analysis generation
- **`changeLogger.ts`** - Code change tracking and history management

### **Testing & Quality Services**
- **`smokeTestService.ts`** - Multi-method extraction testing (Axios, Puppeteer, Playwright)
- **`scraper.ts`** - Legacy company name extraction service

## Key Service Dependencies

### Database Layer
All services integrate with `pgStorage.ts` for PostgreSQL persistence and cross-batch intelligence.

### Processing Pipeline
```
fileProcessor → processor → domainExtractor → gleifService → enhancedExportService
                    ↓
              batchLogger → batch-recovery
```

### GLEIF Intelligence Flow
```
gleifService → gleifValidationService → gleifKnowledgeBase → gleifUpdateService
```

## Critical Service Interactions

### **Level 2 GLEIF Enhancement**
- `processor.ts` orchestrates the complete Level 2 workflow
- `gleifService.ts` handles entity search and candidate processing
- `gleifValidationService.ts` prevents false positive matches
- `gleifKnowledgeBase.ts` accumulates cross-domain intelligence

### **Batch Processing Reliability**
- `processor.ts` manages domain processing with circuit breakers
- `batch-recovery.ts` monitors and recovers stuck processing
- `batchLogger.ts` provides comprehensive processing analytics

### **Quality Assurance**
- `smokeTestService.ts` validates extraction methods across different approaches
- `gleifValidationService.ts` ensures GLEIF match accuracy
- `enhancedExportService.ts` provides business intelligence classification

## Service Configuration

### Processing Limits
- **Batch Size**: 3 concurrent domains (enterprise-optimized)
- **Timeouts**: 6-11 seconds per domain extraction
- **Retry Logic**: Intelligent retry with circuit breakers
- **GLEIF Limits**: 30-second GLEIF processing timeout

### Geographic Intelligence
- **123 Jurisdiction Support**: Complete global coverage via `shared/jurisdictions.ts`
- **TLD Mapping**: Automatic jurisdiction detection from domain TLD
- **Multi-language Support**: Enhanced patterns for international entities

## Error Handling Strategy

### Circuit Breaker Pattern
- **Problematic Domains**: Automatic skip after 1 retry
- **General Domains**: Maximum 3 retry attempts
- **Timeout Protection**: Hard limits prevent infinite processing

### Failure Classification
- **Technical Issues**: Network, timeout, parsing errors
- **Protected Sites**: Cloudflare, anti-bot detection
- **Business Logic**: Invalid company names, marketing content

## Performance Characteristics

### Processing Speed
- **Domain Mapping**: Sub-100ms for Fortune 500 companies
- **Web Scraping**: 200ms-2s for standard extraction
- **GLEIF Enhancement**: 1-3 seconds per candidate search
- **Batch Analytics**: Real-time progress tracking

### Scalability Features
- **Concurrent Processing**: 3-domain parallel processing
- **Memory Management**: Cleanup after each domain
- **Database Optimization**: Efficient query patterns
- **Resource Monitoring**: Processing time and memory tracking

## Usage Guidelines

### Adding New Services
1. Follow the existing service pattern with constructor dependency injection
2. Integrate with `pgStorage.ts` for data persistence
3. Add comprehensive error handling and logging
4. Include TypeScript interfaces for all service methods

### Service Communication
- Use dependency injection rather than direct imports
- Maintain clear service boundaries and responsibilities
- Leverage shared schemas from `shared/` directory
- Follow the established error handling patterns

### Testing Strategy
- Unit tests in `server/tests/` directory
- Integration tests for service interactions
- Smoke tests for extraction method validation
- Performance benchmarking for optimization

## Business Intelligence Features

### Enhanced Classifications
- **Fortune 500 Indicators**: Automatic high-priority classification
- **Entity Categories**: Technology, Financial, Healthcare, Manufacturing, etc.
- **Geographic Intelligence**: Country detection with confidence scoring
- **Legal Entity Validation**: Corporate suffix requirements and validation

### GLEIF Knowledge Accumulation
- **Multi-domain Intelligence**: Each successful extraction builds knowledge
- **Corporate Relationships**: Automatic parent-subsidiary discovery
- **Entity Frequency Tracking**: Popular entities surface faster
- **Historical Analysis**: Entity status changes over time

This service architecture provides the foundation for comprehensive domain intelligence with enterprise-grade reliability and global jurisdiction support.
