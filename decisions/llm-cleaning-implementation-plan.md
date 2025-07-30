# LLM Cleaning Implementation Plan

## Overview
Implement a simple two-step cleaning pipeline for Beta V2 using free Llama 3.1 8B model via OpenRouter.

## Important Notes
- ✅ OpenRouter API key already exists in Replit vault as `openrouter`
- ✅ Configuration panel available at `/openrouter-settings` and `/openrouter-models`
- ✅ Llama 3.1 8B is completely FREE on OpenRouter (confirmed)

## Architecture: Simple Sequential Pipeline
```
Raw HTML → Traditional Strip → LLM Clean → Structured JSON
```

## Implementation Steps

### Phase 1: Backend Foundation (Week 1)

**Step 1.1: OpenRouter Integration**
- ✓ OpenRouter API key already in environment as `openrouter`
- Extend existing OpenRouter service for cleaning use case
- Add Llama 3.1 8B configuration to model list
- Test free tier connectivity

**Step 1.2: Cleaning Service**
- Create `llmCleaningService.ts` with two methods:
  - `stripHTML()` - reuse existing regex patterns
  - `enhanceWithLLM()` - call OpenRouter with Llama 3.1 8B
- Define TypeScript interfaces:
  ```typescript
  interface CleanedData {
    companyName?: string;
    addresses: string[];
    phones: string[];
    emails: string[];
    currencies: string[];
    footerLegal?: string;
    keyText?: string;
  }
  ```

**Step 1.3: Integration with Crawlee Dump**
- Modify `/api/beta/crawlee-dump` endpoint
- Add `includeCleanedData` parameter
- Call cleaning pipeline after dump collection
- Return both raw and cleaned data

### Phase 2: Database & Storage (Week 1)

**Step 2.1: Schema Updates**
```sql
ALTER TABLE beta_dumps ADD COLUMN cleaned_data JSONB;
ALTER TABLE beta_dumps ADD COLUMN cleaning_time_ms INTEGER;
ALTER TABLE beta_dumps ADD COLUMN cleaning_method VARCHAR(50);
```

**Step 2.2: Storage Updates**
- Update dump storage interface
- Store cleaning results alongside raw dumps
- Maintain backward compatibility

### Phase 3: Frontend UI (Week 2)

**Step 3.1: UI Components**
- Split-view component showing before/after
- Toggle buttons: Raw | Clean | Split
- JSON syntax highlighting
- Collapsible sections for different data types

**Step 3.2: Status Updates**
```
✓ Collecting HTML... (2s)
✓ Traditional cleaning... (10ms)
✓ LLM structuring... (500ms)
✓ Complete!
```

**Step 3.3: User Actions**
- Download cleaned JSON
- Copy to clipboard
- Beta feedback form

### Phase 4: Testing & Optimization (Week 2)

**Step 4.1: Test Domains**
- Corporate: apple.com, microsoft.com
- News: cnn.com, bbc.com
- E-commerce: amazon.com, shopify.com
- Complex: linkedin.com, facebook.com

**Step 4.2: Error Handling**
- 5-second timeout for LLM calls
- Fallback to traditional only if LLM fails
- Clear error messages in UI

**Step 4.3: Performance Monitoring**
- Track cleaning times
- Monitor success rates
- Collect user feedback

### Phase 5: Documentation & Launch

**Step 5.1: Documentation**
- Update Beta V2 docs
- Add example inputs/outputs
- Document JSON structure

**Step 5.2: Configuration**
- Add to OpenRouter models config
- Enable in settings panel
- Set appropriate prompts

## User Journey

1. **Collection**: User enters domain → clicks "Start Collection"
2. **Processing**: Shows cleaning progress with timing
3. **Results**: Split view with raw HTML and cleaned JSON
4. **Actions**: Download, copy, or provide feedback

## Success Metrics

- **Performance**: <1s total cleaning time
- **Reliability**: >95% successful cleaning
- **Quality**: >80% user satisfaction
- **Cost**: Confirm $0 with free tier

## MVP Scope

**IN Scope:**
- Two-step cleaning (strip + LLM)
- Simple before/after UI
- JSON download
- Basic error handling

**OUT of Scope (for now):**
- Multiple cleaning strategies
- Custom prompts per domain
- Batch cleaning
- Advanced UI features

## Technical Details

**LLM Model**: `meta-llama/llama-3.1-8b-instruct:free`
**Context Window**: 128k tokens (plenty for our use)
**Temperature**: 0.1 (for consistent output)
**Max Tokens**: 4096 (for response)

## Next Steps

1. Start with backend cleaning service implementation
2. Test with real dumps from Crawlee
3. Build simple UI for side-by-side comparison
4. Gather beta feedback for improvements