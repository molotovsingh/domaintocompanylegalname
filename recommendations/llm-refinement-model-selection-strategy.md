# LLM Refinement and Model Selection Strategy for Cleaning Pipeline
Date: August 2, 2025

## Overview
This document outlines the LLM refinement and model selection strategy for each stage of the cleaning pipeline. The goal is to optimize performance, cost, and accuracy through intelligent model selection and specialized refinement techniques.

## Pipeline Stages & LLM Requirements

### Stage 1: Smart Extraction (Cheerio-based)
- **LLM Need**: None
- **Rationale**: Pure algorithmic extraction using CSS selectors and patterns
- **Benefit**: Deterministic, fast, cost-effective

### Stage 2: Jurisdiction Intelligence Layer
- **LLM Need**: Minimal
- **Rationale**: Pattern matching and rule-based logic using jurisdictions.ts
- **Benefit**: Reliable jurisdiction detection without LLM overhead

### Stage 3: Evidence Collection
- **LLM Need**: Light
- **Use Cases**: Entity recognition in unstructured text
- **Approach**: Mostly pattern-based with selective LLM enhancement

### Stage 4: Multi-Entity LLM Enhancement
- **LLM Need**: Heavy
- **Complex Tasks**:
  - Entity disambiguation
  - Jurisdiction validation
  - Parent/subsidiary relationship mapping
  - Evidence quality assessment
- **Critical Stage**: Where LLM intelligence adds most value

## Model Selection Strategy

### High-Performance Models (Complex Domains)
1. **DeepSeek-V3**
   - Current choice - excellent cost/performance ratio
   - Strong at structured extraction
   - Good multilingual support

2. **Claude-3.5-Sonnet**
   - Superior for nuanced entity relationships
   - Excellent at understanding context
   - Higher cost but worth it for complex cases

3. **GPT-4o**
   - Strong structured output capabilities
   - Excellent instruction following
   - Reliable JSON generation

### Speed-Optimized Models (Simple Domains)
1. **DeepSeek-Chat**
   - Faster and cheaper than V3
   - Good for straightforward extractions
   - Sufficient for single-entity domains

2. **Llama-3.1-70B**
   - Open source option
   - Good performance/cost balance
   - Strong community support

3. **Mixtral-8x7B**
   - Very fast inference
   - Decent quality for basic tasks
   - Cost-effective for high volume

## Dynamic Model Selection Framework

### Domain Complexity Scoring
```typescript
interface ComplexityScore {
  multipleLanguages: 2,      // Multiple languages detected
  multipleJurisdictions: 2,  // Cross-border presence
  crossBorderIndicators: 3,  // International structure markers
  financialLegalIndustry: 2, // Regulated industries
  simpleUSOnly: 0           // Basic .com with US presence
}
```

### Selection Logic
- **Score 0-3**: Speed-optimized model (DeepSeek-Chat, Mixtral)
- **Score 4-6**: Balanced model (Llama-3.1-70B, DeepSeek-V3)
- **Score 7+**: High-performance model (Claude-3.5, GPT-4o)

### Consensus Approach (Critical Domains)
For Fortune 500 and complex multinationals:
1. Run 2-3 different models in parallel
2. Compare and validate outputs
3. Use voting mechanism for final decision
4. Flag significant disagreements for review

## Refinement Strategies

### 1. Model-Specific Prompt Engineering
Different models respond optimally to different prompt styles:

**DeepSeek Models**
- Prefer structured, technical prompts
- Explicit output format specifications
- Clear section delineation

**Claude Models**
- Excel with conversational instructions
- Better at nuanced understanding
- Can handle complex reasoning chains

**GPT-4 Models**
- Require very explicit JSON schemas
- Strong at following strict formats
- Good with step-by-step instructions

### 2. Parameter Optimization
```typescript
interface OptimalParameters {
  temperature: 0.1-0.3,     // Low for consistency
  maxTokens: 4000+,         // Don't truncate entities
  jsonMode: true,           // Where available
  topP: 0.9,               // Focused sampling
  frequencyPenalty: 0.0,   // Allow repetition of entity names
  presencePenalty: 0.0     // No penalty for common terms
}
```

### 3. Multi-Stage Refinement Pipeline
Instead of monolithic processing:

**Stage 4a: Initial Entity Extraction**
- Model: Fast (DeepSeek-Chat)
- Focus: Find all potential entities
- Output: Raw entity list

**Stage 4b: Jurisdiction Validation**
- Model: Specialized (Fine-tuned or prompted)
- Focus: Validate suffixes against jurisdiction rules
- Output: Validated entities with jurisdiction info

**Stage 4c: Relationship Mapping**
- Model: Reasoning-focused (Claude-3.5)
- Focus: Understand corporate structure
- Output: Entity relationship graph

**Stage 4d: Confidence Scoring**
- Model: Ensemble/Consensus
- Focus: Final validation and scoring
- Output: Confident entity claims

### 4. Task-Specific Model Selection

**Non-English Domains**
- Primary: Models with strong multilingual training
- Fallback: Language-specific models for CJK languages
- Consider: Translation + English model pipeline

**Legal Entity Validation**
- Primary: Models exposed to corporate/legal data
- Enhancement: Provide jurisdiction rules in context
- Future: Fine-tuned models on entity datasets

**Relationship Extraction**
- Primary: Models good at graph reasoning
- Enhancement: Provide examples of structures
- Technique: Chain-of-thought prompting

## Cost Optimization Strategies

### 1. Cascading Model Approach
```typescript
async function cascadingExtraction(domain: DomainData) {
  // Start with cheapest
  let result = await cheapModel.extract(domain);
  
  if (result.confidence < 0.7) {
    // Upgrade to mid-tier
    result = await midTierModel.extract(domain);
  }
  
  if (result.confidence < 0.85 && domain.complexity > 6) {
    // Use premium for complex cases
    result = await premiumModel.extract(domain);
  }
  
  return result;
}
```

### 2. Intelligent Caching
- Cache jurisdiction detections by domain TLD
- Store validated entity patterns
- Reuse extractions for similar domains
- Build knowledge base of confirmed entities

### 3. Batch Processing Optimization
- Group domains by complexity score
- Use same model for similar batches
- Optimize context window usage
- Parallel processing where possible

## Quality Assurance Framework

### 1. Model Performance Metrics
Track per model:
- Success rate by domain type
- Jurisdiction accuracy
- False positive rate (wrong entities)
- False negative rate (missed entities)
- Average processing time
- Cost per successful extraction

### 2. A/B Testing Infrastructure
```typescript
interface ABTestConfig {
  testPercentage: 10,        // % of traffic for new model
  minimumSampleSize: 1000,   // Before drawing conclusions
  significanceLevel: 0.95,   // Statistical confidence
  metrics: ['accuracy', 'cost', 'speed']
}
```

### 3. Human-in-the-Loop Refinement
- Low confidence → Manual review queue
- Learn from corrections → Update prompts
- Track common failure patterns
- Build model-specific adjustments

## Future Optimization Opportunities

### 1. Reasoning Models Integration
**o1-preview, DeepSeek-R1**
- Revolutionary for Stage 4 complexity
- Can explain entity relationship logic
- Higher accuracy on ambiguous cases
- Worth premium cost for high-value domains

### 2. Fine-Tuning Strategy
With sufficient volume (>10k examples):
- Fine-tune smaller models for specific tasks
- Create jurisdiction-specific models
- Build industry-specific extractors
- Reduce reliance on expensive general models

### 3. Multi-Modal Enhancement
- Vision models for logo/screenshot analysis
- Extract entities from website images
- Validate text extraction with visual confirmation
- Cross-reference multiple data sources

### 4. Hybrid Approaches
- Rule-based pre-filtering
- LLM for ambiguous cases only
- Symbolic AI for relationship logic
- LLM for natural language understanding

## Implementation Recommendations

### Phase 1: Foundation (Current)
- Implement complexity scoring
- Set up cascading model selection
- Track basic performance metrics

### Phase 2: Optimization (Next 3 months)
- A/B testing framework
- Performance tracking dashboard
- Cost optimization rules
- Caching layer

### Phase 3: Advanced (6+ months)
- Fine-tuning experiments
- Multi-modal integration
- Reasoning model adoption
- Industry-specific pipelines

## Key Insights

1. **One Size Doesn't Fit All**: Different domains need different models
2. **Cascading Saves Money**: Start cheap, upgrade only when needed
3. **Jurisdiction Context is Critical**: Provides essential validation rules
4. **Consensus Improves Quality**: Multiple models catch different errors
5. **Continuous Improvement**: Track, measure, and refine constantly

## Conclusion

The federated architecture perfectly supports this multi-model strategy. Each stage can independently evolve its model selection without affecting others. The OpenRouter integration provides the flexibility to experiment and optimize continuously.

The key is to match model capabilities to task requirements while optimizing for cost and performance. This strategy ensures high-quality extraction for complex domains while maintaining efficiency for simple cases.