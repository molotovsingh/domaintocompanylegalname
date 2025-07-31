# Beta V2 Separate Cleaning Stage - Implementation Plan

## Date: July 31, 2025

## Overview
Detailed implementation plan for adding a separate, modular cleaning stage to Beta V2 that can process raw data from any collection method using various LLM models.

## Architecture Principles
1. **Complete Separation**: Cleaning service knows nothing about collection methods
2. **Data Agnostic**: Works with any raw dump format (HTML, text, structured data)
3. **Model Flexibility**: Support multiple LLM providers and models
4. **Non-Intrusive**: Zero changes to existing collection methods
5. **Optional Processing**: Cleaning is always an optional step

## Database Schema Changes

### 1. New Tables

```sql
-- Store cleaned/processed results
CREATE TABLE beta_v2.cleaned_data (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(50), -- 'crawlee_dump', 'scrapy_crawl', 'playwright_dump'
  source_id INTEGER, -- References the original dump ID
  model_name VARCHAR(100), -- 'deepseek-chat', 'llama-3-8b', etc.
  model_provider VARCHAR(50), -- 'openrouter', 'openai', etc.
  cleaned_data JSONB, -- Extracted entities, addresses, etc.
  processing_time_ms INTEGER,
  token_count INTEGER,
  cost_estimate DECIMAL(10,6),
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track model comparison sessions
CREATE TABLE beta_v2.cleaning_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(50) UNIQUE,
  source_type VARCHAR(50),
  source_id INTEGER,
  models_used TEXT[], -- Array of model names
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model performance tracking
CREATE TABLE beta_v2.model_performance (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(100),
  domain VARCHAR(255),
  extraction_quality INTEGER, -- 1-5 rating
  processing_time_ms INTEGER,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Indexes
```sql
CREATE INDEX idx_cleaned_data_source ON beta_v2.cleaned_data(source_type, source_id);
CREATE INDEX idx_cleaned_data_model ON beta_v2.cleaned_data(model_name);
CREATE INDEX idx_model_performance ON beta_v2.model_performance(model_name, domain);
```

## Backend Implementation

### 1. Core Cleaning Service
```typescript
// server/beta-v2/services/cleaningService.ts
interface CleaningRequest {
  sourceType: 'crawlee_dump' | 'scrapy_crawl' | 'playwright_dump';
  sourceId: number;
  modelName: string;
  compareModels?: string[]; // For A/B testing
}

interface CleaningResult {
  id: number;
  extractedData: {
    companyName?: string;
    legalEntity?: string;
    addresses?: string[];
    phones?: string[];
    emails?: string[];
    currencies?: string[];
    countries?: string[];
    socialMedia?: string[];
    businessIdentifiers?: {
      registrationNumbers?: string[];
      taxIds?: string[];
      licenses?: string[];
    };
  };
  metadata: {
    processingTimeMs: number;
    tokenCount: number;
    costEstimate: number;
    confidenceScore: number;
    model: string;
  };
}
```

### 2. Model Adapter Pattern
```typescript
// server/beta-v2/services/modelAdapters/
interface ModelAdapter {
  clean(rawData: string, prompt?: string): Promise<CleaningResult>;
  estimateCost(tokenCount: number): number;
  getModelInfo(): ModelInfo;
}

// Implementations:
// - OpenRouterAdapter (DeepSeek, Llama, Mixtral, etc.)
// - OpenAIAdapter (GPT-3.5, GPT-4)
// - LocalModelAdapter (for future local models)
```

### 3. API Endpoints

```typescript
// GET /api/beta/cleaning/available-data
// Returns list of raw dumps available for processing
{
  dumps: [
    {
      type: 'crawlee_dump',
      id: 1,
      domain: 'apple.com',
      pages: 5,
      size: '245KB',
      collectedAt: '2025-07-31T10:00:00Z',
      hasBeenCleaned: true,
      cleanedWith: ['deepseek-chat']
    }
  ]
}

// POST /api/beta/cleaning/process
// Process a single dump with one or more models
{
  sourceType: 'crawlee_dump',
  sourceId: 1,
  models: ['deepseek-chat', 'llama-3-8b'] // Optional array for comparison
}

// GET /api/beta/cleaning/results/:sourceType/:sourceId
// Get all cleaning results for a specific dump
{
  results: [
    {
      model: 'deepseek-chat',
      extractedData: {...},
      metadata: {...}
    }
  ]
}

// GET /api/beta/cleaning/models
// Get available models and their status
{
  models: [
    {
      name: 'deepseek-chat',
      provider: 'openrouter',
      status: 'available',
      costPer1kTokens: 0,
      averageProcessingTime: 3200
    }
  ]
}

// GET /api/beta/cleaning/compare/:sessionId
// Get comparison results for a multi-model session
```

## Frontend Implementation

### 1. New Components

```typescript
// client/src/pages/beta-data-processing.tsx
- Main page component with tab navigation
- Data selection interface
- Model selection with comparison option
- Results display with comparison table

// client/src/components/beta-v2/DataSelector.tsx
- Lists available dumps from all collection methods
- Shows metadata (size, age, method)
- Indicates if already processed

// client/src/components/beta-v2/ModelSelector.tsx
- Dropdown for single model selection
- Checkbox for comparison mode
- Model info tooltips (cost, speed)

// client/src/components/beta-v2/CleaningResults.tsx
- Single model result display
- Extracted data visualization
- Processing metadata

// client/src/components/beta-v2/ModelComparison.tsx
- Side-by-side or table comparison
- Highlight differences
- Performance metrics
```

### 2. React Query Integration

```typescript
// Queries
useAvailableData() // Fetch raw dumps
useCleaningModels() // Get available models
useCleaningResults(sourceType, sourceId) // Get results
useComparisonResults(sessionId) // Get comparison

// Mutations
useProcessData() // Trigger cleaning
useRateExtraction() // Rate model performance
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create database tables and indexes
- [ ] Implement basic cleaning service structure
- [ ] Add OpenRouter adapter for free models
- [ ] Create API endpoints for single-model processing
- [ ] Basic UI for data selection and processing

### Phase 2: Model Comparison (Week 2)
- [ ] Implement multi-model processing
- [ ] Add comparison session tracking
- [ ] Create comparison UI components
- [ ] Add model performance tracking
- [ ] Implement A/B testing interface

### Phase 3: Advanced Features (Week 3)
- [ ] Batch processing capabilities
- [ ] Model recommendation engine
- [ ] Cost tracking and budgets
- [ ] Export cleaned data
- [ ] Historical reprocessing

### Phase 4: Optimization (Week 4)
- [ ] Caching for repeated requests
- [ ] Model performance analytics
- [ ] Auto-selection based on domain type
- [ ] Queue system for large batches
- [ ] API rate limiting

## Integration Points

### 1. No Changes to Collection Methods
- Crawlee, Scrapy, Playwright remain unchanged
- They continue to store raw dumps as before
- Cleaning service reads from their tables

### 2. Shared Database Access
- Cleaning service has read-only access to dump tables
- Writes only to its own tables
- No cross-contamination of data

### 3. UI Integration
- New tab in Beta Testing V2
- Separate route: /beta-testing-v2/data-processing
- Independent from collection UIs

## Configuration

### 1. Model Configuration
```typescript
// server/beta-v2/config/cleaning-models.ts
export const CLEANING_MODELS = {
  'deepseek-chat': {
    provider: 'openrouter',
    modelId: 'deepseek/deepseek-chat',
    maxTokens: 4000,
    temperature: 0.3,
    systemPrompt: 'Extract company information...'
  },
  // ... other models
};
```

### 2. Environment Variables
```
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-xxx

# Model Selection
DEFAULT_CLEANING_MODEL=deepseek-chat
ENABLE_PAID_MODELS=false

# Performance
MAX_CONCURRENT_CLEANINGS=3
CLEANING_TIMEOUT_MS=30000
```

## Testing Strategy

### 1. Unit Tests
- Model adapter tests
- Cleaning service logic
- API endpoint validation

### 2. Integration Tests
- End-to-end cleaning flow
- Model comparison accuracy
- Database operations

### 3. Performance Tests
- Concurrent processing
- Large dump handling
- Model response times

## Success Metrics

1. **Flexibility**: Can process any dump with any model
2. **Performance**: <5s average processing time
3. **Accuracy**: Model comparison shows clear winners
4. **User Experience**: Simple 2-click process
5. **Cost Control**: Free tier stays free

## Risk Mitigation

1. **API Rate Limits**: Queue system with retry logic
2. **Model Failures**: Fallback to alternative models
3. **Large Dumps**: Chunking strategy for big HTML files
4. **Cost Overruns**: Strict budget controls and warnings

## Future Enhancements

1. **Local Model Support**: Run models on-device
2. **Custom Prompts**: User-defined extraction templates
3. **Training Data Export**: Build datasets from results
4. **Model Fine-tuning**: Improve models with feedback
5. **Webhook Integration**: Notify when processing complete