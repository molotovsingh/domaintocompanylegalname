# Crawlee Integration Plan for Beta Testing Platform V2 (REVISED)

## Critical Issues with Original Plan
1. **Redundancy**: Overlaps too much with existing Scrapy crawler
2. **Extraction vs Dumping**: Violates architectural principle of separating dumps from extraction
3. **Missing OpenRouter/GLEIF Integration**: No clear path to leverage reasoning models
4. **Performance**: Doesn't address known timeout issues from combining crawl+extract

## Revised Executive Summary
Add Crawlee as a **specialized JavaScript-heavy site dumper** that complements (not duplicates) existing methods:
- **Playwright Dump**: Single-page, deep analysis
- **Scrapy Crawl**: Multi-page, fast HTML-only crawling  
- **Crawlee Dump**: JavaScript-heavy sites requiring complex interactions

## Unique Value Proposition
Crawlee should focus on sites that defeat our other methods:
1. **Heavy JavaScript SPAs** (React, Vue, Angular sites)
2. **Dynamic content loading** (infinite scroll, lazy loading)
3. **Complex interactions required** (hover states, tabs, accordions)
4. **Anti-bot protection** (Cloudflare challenges, captchas)

## Architectural Alignment

### CRITICAL: Separation of Concerns
Following the architectural decision from replit.md:
```
"ARCHITECTURAL DECISION: SEPARATION OF DUMPS FROM EXTRACTION"
- Current all-in-one approach causes timeouts
- Crawlee will ONLY dump raw data
- NO entity extraction in crawling phase
- Data ready for OpenRouter reasoning models
```

### Database Schema (Simplified)
```sql
-- Focus on raw data storage, not extraction
CREATE TABLE IF NOT EXISTS crawlee_dumps (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  interaction_type TEXT, -- 'static', 'dynamic', 'complex'
  
  -- Raw dump data (no extraction)
  raw_html JSONB,
  interaction_logs JSONB,
  screenshots JSONB,
  network_data JSONB,
  
  -- Metadata for OpenRouter processing
  js_framework_detected TEXT,
  requires_interaction BOOLEAN,
  anti_bot_detected BOOLEAN,
  
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## OpenRouter Integration Strategy

### Data Collection for Reasoning Models
Crawlee will collect specific data that benefits reasoning models:

1. **Multi-state captures**: 
   - Initial page load
   - After interactions (clicks, hovers)
   - Hidden content revealed

2. **Context preservation**:
   - Full navigation paths
   - Interaction sequences
   - State changes over time

3. **Reasoning-friendly format**:
   ```json
   {
     "states": [
       {
         "action": "initial_load",
         "html": "...",
         "visible_text": "...",
         "hidden_elements": ["..."]
       },
       {
         "action": "clicked_about_menu",
         "html_diff": "...",
         "newly_visible": "..."
       }
     ]
   }
   ```

This allows reasoning models like DeepSeek R1 and Kimi K2 to:
- Understand site structure through interactions
- Find hidden legal entity information
- Reason about dynamic content patterns

## Revised Implementation Focus

### Phase 1: JavaScript-Heavy Site Handler
```typescript
// Focus on sites that need interaction
const crawleeConfig = {
  // NOT for general crawling - specific use cases only
  handleJavaScriptSites: true,
  captureInteractions: true,
  recordStateChanges: true,
  
  // Strict limits to prevent timeouts
  maxInteractionTime: 30000, // 30 seconds max
  maxStates: 5, // Capture up to 5 different states
  
  // No extraction - just dump
  extractEntities: false,
  analyzeContent: false
};
```

### Phase 2: Anti-Bot Bypass Collection
- Detect Cloudflare/reCAPTCHA
- Capture challenge pages
- Document protection methods for manual review

### Phase 3: GLEIF Enhancement Data
- Capture legal/about pages behind JavaScript
- Find hidden subsidiary information in dropdowns
- Collect investor relations data in tabs

## Integration with Existing Systems

### 1. Triggers for Crawlee Use
Crawlee should ONLY be used when:
- Playwright/Scrapy return "Protected - Manual Review"
- Site detected as heavy JavaScript (React/Vue/Angular)
- GLEIF matching needs additional context
- Manual flag for "complex site"

### 2. OpenRouter Model Selection
Based on Crawlee's complex data:
- Use reasoning models (DeepSeek R1, Phi-4) for multi-state analysis
- Apply consensus strategy for ambiguous JavaScript sites
- Leverage Perplexity models for sites requiring search context

### 3. Performance Optimization
- Crawlee runs AFTER initial methods fail
- Separate queue from main processing
- Results fed to OpenRouter in second phase
- No inline extraction = no timeouts

## Success Metrics (Revised)
1. **Specificity**: <5% of domains need Crawlee (only hard cases)
2. **Success Rate**: 80% success on JavaScript-heavy sites
3. **Data Quality**: Capture 3+ states for dynamic sites
4. **No Timeouts**: 0 timeout errors (vs current extraction timeouts)

## What We're NOT Building
❌ Another general-purpose crawler
❌ Extraction logic inside Crawlee
❌ Replacement for Scrapy multi-page
❌ Default method for all domains

## What We ARE Building
✅ Specialized JavaScript site handler
✅ Anti-bot detection documenter
✅ Multi-state capturer for reasoning models
✅ Complement to existing methods

## Revised Timeline
- **Day 1**: Basic JavaScript interaction capture
- **Day 2**: Multi-state recording system
- **Day 3**: Integration triggers (when to use Crawlee)
- **Day 4**: OpenRouter data formatting
- **Day 5**: Performance optimization

This revised plan aligns with:
- Architectural decision to separate dumps from extraction
- Focus on feeding OpenRouter reasoning models
- Complementing (not duplicating) existing methods
- Solving specific problems our current tools can't handle