# Beta V2 Cleaning Stage - Discrete Implementation Steps

## Date: July 31, 2025

## Phase 1: Core Infrastructure (Target: 3-4 days)

### Step 1: Database Setup
1. Create new tables in beta_v2 schema:
   ```sql
   -- File: migrations/beta-v2-cleaning-tables.sql
   CREATE TABLE beta_v2.cleaned_data (...)
   CREATE TABLE beta_v2.cleaning_sessions (...)
   CREATE TABLE beta_v2.model_performance (...)
   ```
2. Add indexes for performance
3. Test table creation with sample inserts

### Step 2: Basic Cleaning Service Structure
1. Create directory structure:
   ```
   server/beta-v2/cleaning/
   ├── cleaningService.ts
   ├── modelAdapters/
   │   ├── baseAdapter.ts
   │   └── openRouterAdapter.ts
   ├── types.ts
   └── config.ts
   ```

2. Implement base types in `types.ts`:
   - CleaningRequest interface
   - CleaningResult interface
   - ModelInfo interface
   - ExtractedData interface

3. Create abstract ModelAdapter in `baseAdapter.ts`:
   - clean() method signature
   - estimateCost() method signature
   - getModelInfo() method signature

### Step 3: OpenRouter Integration
1. Implement OpenRouterAdapter:
   - Constructor with API key from env
   - clean() method using existing llmCleaningService patterns
   - Cost estimation (0 for free models)
   - Model info getter

2. Add model configurations in `config.ts`:
   - DeepSeek Chat configuration
   - System prompts for extraction
   - Token limits and temperature

3. Test with simple HTML cleaning

### Step 4: Core Cleaning Service
1. Implement CleaningService class:
   - getRawData() - fetch from dump tables
   - processWithModel() - use adapter to clean
   - saveResults() - store in cleaned_data table
   - getCleaningResults() - retrieve results

2. Add error handling:
   - Timeout handling (30s default)
   - Model failure fallbacks
   - Invalid data handling

### Step 5: API Endpoints
1. Create `server/beta-v2/cleaning/cleaningRoutes.ts`

2. Implement endpoints:
   - GET /api/beta/cleaning/available-data
     - Query all dump tables
     - Return unified list with metadata
   - POST /api/beta/cleaning/process
     - Validate request
     - Call cleaning service
     - Return job ID or immediate result
   - GET /api/beta/cleaning/results/:sourceType/:sourceId
     - Fetch from cleaned_data table
   - GET /api/beta/cleaning/models
     - Return available models and status

3. Add routes to beta server

### Step 6: Basic Frontend UI
1. Create new page component:
   - `client/src/pages/beta-data-processing.tsx`
   - Add route in beta-testing-v2.tsx

2. Implement DataSelector component:
   - Fetch available dumps
   - Display as selectable list
   - Show dump metadata

3. Implement ModelSelector component:
   - Simple dropdown for now
   - Only show free models initially

4. Add process button and basic results display

## Phase 2: Model Comparison (Target: 2-3 days)

### Step 7: Multi-Model Processing
1. Update CleaningService:
   - processWithMultipleModels() method
   - Parallel processing with Promise.all
   - Session ID generation

2. Update database operations:
   - Create cleaning session records
   - Link multiple results to session

### Step 8: Comparison UI
1. Create ModelComparison component:
   - Table layout for side-by-side view
   - Highlight differences in extracted data
   - Show processing times

2. Update results display:
   - Detect multi-model results
   - Switch between single/comparison view

### Step 9: Model Performance Tracking
1. Add performance recording:
   - After each extraction
   - User ratings (optional)
   - Automatic quality metrics

2. Create performance API endpoint:
   - GET /api/beta/cleaning/performance/:model

## Phase 3: Advanced Features (Target: 3-4 days)

### Step 10: Batch Processing
1. Implement batch queue:
   - Process multiple dumps sequentially
   - Progress tracking
   - Batch results API

2. Update UI for batch selection:
   - Checkbox selection
   - Batch progress indicator

### Step 11: Cost Tracking
1. Add cost calculation:
   - Track tokens used
   - Calculate costs for paid models
   - Store in database

2. Create cost dashboard:
   - Total costs by model
   - Cost per extraction

### Step 12: Export Functionality
1. Add export endpoints:
   - CSV export of cleaned data
   - JSON export with full details
   - Comparison export

2. Add export buttons to UI

## Phase 4: Polish & Optimization (Target: 2-3 days)

### Step 13: Caching Layer
1. Implement result caching:
   - Cache identical requests
   - TTL-based expiration
   - Cache invalidation

### Step 14: Model Recommendations
1. Create recommendation engine:
   - Based on domain type
   - Based on past performance
   - Success rate analysis

2. Add to UI as suggestions

### Step 15: Testing & Documentation
1. Write tests:
   - Unit tests for adapters
   - Integration tests for API
   - E2E tests for UI flow

2. Create user documentation:
   - How to use cleaning stage
   - Model comparison guide
   - Best practices

## Validation Checkpoints

### After Phase 1:
- [ ] Can select a Crawlee dump and process with DeepSeek
- [ ] Results are saved and retrievable
- [ ] Basic UI shows extracted data

### After Phase 2:
- [ ] Can compare 3 models on same data
- [ ] Comparison table shows differences
- [ ] Performance is tracked

### After Phase 3:
- [ ] Batch processing works smoothly
- [ ] Costs are tracked accurately
- [ ] Data can be exported

### After Phase 4:
- [ ] System recommends best models
- [ ] Caching improves performance
- [ ] Full test coverage

## Implementation Order Priority

1. **Critical Path** (Must have for MVP):
   - Steps 1-6 (Basic single-model processing)

2. **High Value** (Major feature additions):
   - Steps 7-9 (Model comparison)
   - Steps 10-12 (Batch & export)

3. **Nice to Have** (Polish and optimization):
   - Steps 13-15 (Caching & recommendations)

## Risk Mitigation Steps

### At Each Phase:
1. Test with real data from existing dumps
2. Monitor API rate limits
3. Check memory usage with large HTMLs
4. Validate cost calculations
5. Ensure backward compatibility

### Before Production:
1. Load test with 100+ dumps
2. Test all error scenarios
3. Verify data isolation
4. Security review of API endpoints