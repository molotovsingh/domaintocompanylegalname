
# OpenRouter Integration Requirements Document

## Executive Summary

Integrate OpenRouter API to enhance the domain intelligence platform with multi-model LLM capabilities, enabling advanced entity extraction, validation, and arbitration beyond the current Perplexity-only approach.

## Project Overview

### Current State
- **Primary LLM**: Perplexity API for entity extraction (`server/betaServices/perplexityExtractor.ts`)
- **Data Sources**: Playwright, Scrapy, GLEIF API integration
- **Architecture**: Express.js backend with React frontend
- **Database**: PostgreSQL with comprehensive raw data capture

### Target State
- **Multi-LLM Platform**: OpenRouter providing access to Claude, GPT-4, Llama, etc.
- **LLM Arbitration**: Multiple models validating extraction results
- **Enhanced Intelligence**: Specialized models for different domain types
- **Cost Optimization**: Model selection based on complexity and requirements

## Business Requirements

### BR-1: Multi-Model Entity Extraction
**Priority**: High  
**Description**: Implement OpenRouter service to access multiple LLM models for entity extraction
**Success Criteria**:
- Support for at least 3 different model families (Claude, GPT-4, Llama)
- Model selection based on domain complexity
- Fallback mechanisms when primary models unavailable

### BR-2: LLM Arbitration System
**Priority**: High  
**Description**: Implement the database arbitration strategy using multiple LLMs
**Success Criteria**:
- Confidence-based routing (>85% auto-approve, 50-85% LLM review, <50% human review)
- Cross-validation between Perplexity and OpenRouter results
- Arbitration decision logging and audit trail

### BR-3: Enhanced Raw Data Analysis
**Priority**: Medium  
**Description**: Process comprehensive scraped data using specialized models
**Success Criteria**:
- Utilize existing raw data capture from Playwright/Scrapy extractors
- Extract additional insights not captured by current methods
- Generate confidence scores for different extraction approaches

### BR-4: Geographic Intelligence Enhancement
**Priority**: Medium  
**Description**: Use region-specific models for better jurisdiction detection
**Success Criteria**:
- Improved accuracy for international domains
- Better legal entity type detection per jurisdiction
- Enhanced address and contact information extraction

## Technical Requirements

### TR-1: OpenRouter Service Implementation
**File**: `server/betaServices/openRouterExtractor.ts`
**Dependencies**: axios, existing extraction interfaces
**Requirements**:
```typescript
interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  models: ModelConfig[];
  rateLimits: RateLimitConfig;
  timeout: number;
}

interface ModelConfig {
  name: string;
  provider: string;
  costPerToken: number;
  useCase: ExtractionUseCase[];
  maxTokens: number;
}
```

### TR-2: Model Selection Logic
**File**: `server/services/modelSelectionService.ts`
**Requirements**:
- Domain complexity scoring algorithm
- Model capability matching
- Cost optimization logic
- Performance monitoring and switching

### TR-3: Database Schema Enhancement
**File**: `migrations/0005_add_openrouter_tracking.sql`
**Requirements**:
```sql
-- Add OpenRouter tracking columns to domains table
ALTER TABLE domains ADD COLUMN openrouter_models_used TEXT[];
ALTER TABLE domains ADD COLUMN openrouter_results JSONB;
ALTER TABLE domains ADD COLUMN arbitration_consensus JSONB;
ALTER TABLE domains ADD COLUMN total_processing_cost DECIMAL(10,4);

-- Create model performance tracking table
CREATE TABLE model_performance (
  id SERIAL PRIMARY KEY,
  model_name TEXT NOT NULL,
  domain_id INTEGER REFERENCES domains(id),
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  cost_usd DECIMAL(10,4),
  accuracy_score INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### TR-4: Beta v2 Integration
**File**: `server/beta-v2/routes.ts`
**Requirements**:
- Add OpenRouter endpoint: `/api/beta/openrouter/extract`
- Model comparison endpoint: `/api/beta/compare-models`
- Cost analysis endpoint: `/api/beta/model-costs`

### TR-5: Frontend Integration
**File**: `client/src/pages/openrouter-testing.tsx`
**Requirements**:
- Model selection interface
- Real-time cost tracking
- Comparison view between Perplexity and OpenRouter results
- Performance metrics dashboard

## Implementation Phases

### Phase 1: Core OpenRouter Service (Week 1-2)
**Deliverables**:
1. `openRouterExtractor.ts` - Basic service implementation
2. `modelSelectionService.ts` - Model routing logic
3. Beta v2 API endpoints
4. Unit tests for OpenRouter service

**Acceptance Criteria**:
- Successfully extract entities using at least 2 OpenRouter models
- Cost tracking functional
- Error handling and fallbacks working
- Integration with existing beta platform

### Phase 2: Arbitration System (Week 3-4)
**Deliverables**:
1. Database schema updates
2. Arbitration logic implementation
3. Confidence scoring enhancement
4. Cross-validation between models

**Acceptance Criteria**:
- Arbitration system correctly routes decisions based on confidence
- Multiple model results properly aggregated
- Performance metrics collected and stored
- Audit trail complete

### Phase 3: Frontend Enhancement (Week 5-6)
**Deliverables**:
1. OpenRouter testing interface
2. Model comparison views
3. Cost analysis dashboard
4. Performance monitoring UI

**Acceptance Criteria**:
- Users can select and test different models
- Real-time cost and performance data displayed
- Comparison between Perplexity and OpenRouter results
- Export functionality for analysis

### Phase 4: Optimization & Analytics (Week 7-8)
**Deliverables**:
1. Intelligent model selection based on historical performance
2. Cost optimization algorithms
3. Advanced analytics and reporting
4. Production readiness assessment

**Acceptance Criteria**:
- Automated model selection improves accuracy by 10%
- Cost per extraction reduced by 15% through optimization
- Performance analytics provide actionable insights
- System ready for production deployment

## API Specifications

### OpenRouter Extraction Endpoint
```typescript
POST /api/beta/openrouter/extract
{
  "domain": "example.com",
  "models": ["claude-3-sonnet", "gpt-4"],
  "rawData": {
    "html": "...",
    "metadata": "...",
    "screenshots": "..."
  },
  "extractionContext": {
    "industry": "technology",
    "jurisdiction": "US",
    "complexity": "high"
  }
}

Response:
{
  "success": true,
  "results": [
    {
      "model": "claude-3-sonnet",
      "extractedEntity": "Apple Inc.",
      "confidence": 95,
      "processingTime": 1200,
      "tokensUsed": 1500,
      "cost": 0.045
    }
  ],
  "arbitration": {
    "consensus": "Apple Inc.",
    "confidenceScore": 92,
    "agreementLevel": "high"
  }
}
```

### Model Comparison Endpoint
```typescript
GET /api/beta/compare-models/:domainId
Response:
{
  "domain": "apple.com",
  "perplexityResult": {...},
  "openRouterResults": [...],
  "performance": {
    "accuracy": {...},
    "speed": {...},
    "cost": {...}
  }
}
```

## Security & Compliance

### SEC-1: API Key Management
- Store OpenRouter API key in Replit Secrets
- Implement key rotation capability
- Monitor API usage and costs

### SEC-2: Data Privacy
- Ensure compliance with existing GDPR policies
- No PII processing through OpenRouter
- Audit trail for all LLM interactions

### SEC-3: Cost Controls
- Daily/monthly spending limits
- Alert system for unusual usage patterns
- Cost per extraction monitoring

## Testing Requirements

### Unit Tests
- OpenRouter service functionality
- Model selection logic
- Cost calculation accuracy
- Error handling scenarios

### Integration Tests
- End-to-end extraction workflow
- Database arbitration system
- API endpoint functionality
- Frontend component behavior

### Performance Tests
- Response time benchmarking
- Concurrent request handling
- Cost optimization validation
- Model switching scenarios

## Success Metrics

### Technical Metrics
- **Response Time**: <3 seconds for standard extraction
- **Accuracy**: 95%+ entity extraction accuracy
- **Uptime**: 99.9% service availability
- **Cost Efficiency**: <$0.10 per successful extraction

### Business Metrics
- **Coverage**: 100% of domains get multi-model analysis
- **Consensus**: 80%+ of extractions reach model consensus
- **Quality**: 25% reduction in manual review requirements
- **ROI**: 15% improvement in acquisition research efficiency

## Risk Mitigation

### RISK-1: OpenRouter API Downtime
**Mitigation**: Fallback to Perplexity service, graceful degradation

### RISK-2: Cost Overruns
**Mitigation**: Spending limits, intelligent model selection, cost monitoring

### RISK-3: Model Performance Variance
**Mitigation**: Performance tracking, automatic model switching, manual override

### RISK-4: Integration Complexity
**Mitigation**: Phased implementation, comprehensive testing, rollback capability

## Dependencies

### External Services
- OpenRouter API access and billing setup
- Continued Perplexity API access for comparison
- Existing GLEIF API integration

### Internal Components
- PostgreSQL database with sufficient storage
- Existing beta v2 platform architecture
- Raw data capture from Playwright/Scrapy services

## Deployment Strategy

### Development Phase
- Beta v2 platform integration
- Isolated testing environment
- A/B testing capability

### Production Rollout
- Gradual migration from Perplexity-only
- Performance monitoring and rollback plan
- User training and documentation

## Documentation Requirements

1. **API Documentation**: Complete OpenAI spec for all endpoints
2. **Integration Guide**: Step-by-step setup and configuration
3. **Cost Management**: Billing and optimization guidelines
4. **Troubleshooting**: Common issues and resolutions
5. **Performance Tuning**: Model selection and optimization guide

---

**Document Version**: 1.0  
**Last Updated**: January 26, 2025  
**Next Review**: February 9, 2025  
**Owner**: Development Team  
**Stakeholders**: Product, Engineering, DevOps
