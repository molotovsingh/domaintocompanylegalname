# Data Processing Stage 2 - Implementation Plan

## Overview
Build a unified data processing pipeline that connects raw data collection (Stage 1) with GLEIF verification through an intelligent multi-stage cleaning and extraction process.

## Architecture Design

### Processing Pipeline Flow
```
Raw Dumps → HTML Strip → Data Extract → Entity Extract → GLEIF Search → Combined Results
(Stage 1)    (Clean 1)    (Clean 2)      (Clean 3)        (Verify)      (Final)
```

### Key Principles
1. **Method Agnostic**: Works with dumps from any collection method
2. **Stage Independence**: Each stage can run independently
3. **Result Transparency**: Store and display results at each stage
4. **Model Flexibility**: Support different LLM models per stage

## Database Schema Updates

```sql
-- Processing results table
CREATE TABLE IF NOT EXISTS beta_v2_processing_results (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL, -- 'crawlee_dump', 'scrapy_crawl', etc.
  source_id INTEGER NOT NULL,
  domain VARCHAR(255) NOT NULL,
  
  -- Stage 1: HTML Stripping
  stage1_stripped_text TEXT,
  stage1_processing_time_ms INTEGER,
  
  -- Stage 2: Data Extraction (existing cleaning)
  stage2_extracted_data JSONB,
  stage2_model_used VARCHAR(100),
  stage2_processing_time_ms INTEGER,
  
  -- Stage 3: Entity Name Extraction (new)
  stage3_entity_name VARCHAR(255),
  stage3_entity_confidence DECIMAL(3,2),
  stage3_model_used VARCHAR(100),
  stage3_processing_time_ms INTEGER,
  stage3_reasoning TEXT,
  
  -- Stage 4: GLEIF Results
  stage4_gleif_search_id INTEGER,
  stage4_primary_lei VARCHAR(20),
  stage4_confidence_score DECIMAL(3,2),
  
  -- Overall status
  processing_status VARCHAR(50) DEFAULT 'pending',
  total_processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_processing_source ON beta_v2_processing_results(source_type, source_id);
CREATE INDEX idx_processing_domain ON beta_v2_processing_results(domain);
CREATE INDEX idx_processing_status ON beta_v2_processing_results(processing_status);
```

## Implementation Phases

### Phase 1: Backend Infrastructure (Day 1-2)

#### 1.1 Entity Extraction Service
Create `server/services/entityExtractionService.ts`:
```typescript
interface EntityExtractionResult {
  entityName: string;
  confidence: number;
  reasoning: string;
  alternativeNames?: string[];
}

class EntityExtractionService {
  async extractLegalEntity(
    rawData: string,
    domain: string,
    existingData?: any
  ): Promise<EntityExtractionResult>
}
```

#### 1.2 Processing Pipeline Service
Create `server/beta-v2/processing/processingPipelineService.ts`:
- Orchestrates all stages
- Handles stage failures gracefully
- Supports partial processing

#### 1.3 API Routes
Create `server/beta-v2/processing/processingIndex.ts`:
```
GET  /api/beta/processing/dumps        # List all available dumps
POST /api/beta/processing/process      # Start processing a dump
GET  /api/beta/processing/results      # List processing results
GET  /api/beta/processing/result/:id   # Get detailed result
```

### Phase 2: Frontend UI (Day 3-4)

#### 2.1 Page Structure
Create `client/src/pages/beta-testing-v2/DataProcessingStage2.tsx`:

```
┌─────────────────────────────────────────┐
│ Data Processing Stage 2                 │
├─────────────────────────────────────────┤
│ Available Dumps                         │
│ ┌─────────────────────────────────────┐ │
│ │ Domain     Method    Date    Action │ │
│ │ apple.com  Crawlee   Today   Process│ │
│ │ tesla.com  Scrapy    Today   Process│ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Processing Pipeline                     │
│ ┌─────────────────────────────────────┐ │
│ │ Stage 1: HTML Strip         ✓ 10ms │ │
│ │ Stage 2: Data Extract       ✓ 500ms│ │
│ │ Stage 3: Entity Extract     ⟳       │ │
│ │ Stage 4: GLEIF Search       -       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### 2.2 Results Display
- Collapsible sections for each stage
- Before/after comparisons
- Confidence scores visualization
- GLEIF candidates with selection

### Phase 3: Integration (Day 5)

#### 3.1 Connect to Existing Services
- Link to existing cleaning service
- Integrate GLEIF search service
- Reuse dump storage interfaces

#### 3.2 Navigation Updates
- Add to Beta Testing V2 landing page
- Update routing in App.tsx
- Add breadcrumb navigation

## Entity Extraction Prompt Design

### Primary Prompt Template
```
You are a legal entity extraction specialist. Extract the official legal entity name from the provided website data.

Rules:
1. Return the complete legal name with proper suffix (Inc., LLC, Ltd., Corp., etc.)
2. Remove marketing taglines and slogans
3. Prefer names from legal/copyright sections
4. If multiple entities, return the primary operating entity
5. Handle international entities correctly

Domain: {domain}
Existing extracted data: {existing_data}
Raw text: {raw_text}

Return JSON:
{
  "entityName": "exact legal entity name",
  "confidence": 0.95,
  "reasoning": "Found in copyright notice with Inc. suffix",
  "alternativeNames": ["other potential names found"]
}
```

### Model Selection Strategy
- Default: DeepSeek Chat (good reasoning)
- Fallback: Llama 3.1 8B (free)
- Premium: GPT-4o (highest accuracy)

## Success Metrics

1. **Processing Speed**: < 5 seconds total pipeline
2. **Entity Accuracy**: > 90% correct legal names
3. **GLEIF Match Rate**: > 80% successful matches
4. **User Satisfaction**: Clear, actionable results

## Testing Plan

### Test Domains
1. Simple: apple.com, google.com
2. Complex: alphabet.com (holding company)
3. International: samsung.com, toyota.com
4. Ambiguous: delta.com (which Delta?)

### Validation Process
1. Manual review of first 50 results
2. Compare against known legal entities
3. Track GLEIF match success rates
4. User feedback collection

## Future Enhancements

1. **Batch Processing**: Process multiple dumps simultaneously
2. **Confidence Thresholds**: Auto-approve high confidence results
3. **Learning Loop**: Improve prompts based on results
4. **Export Options**: CSV/JSON export of processed data
5. **API Access**: Programmatic access to pipeline

## Implementation Timeline

- **Day 1-2**: Backend services and database
- **Day 3-4**: Frontend UI and integration
- **Day 5**: Testing and refinement
- **Week 2**: User feedback and optimization