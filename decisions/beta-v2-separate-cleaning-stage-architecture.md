# Beta V2 Separate Cleaning Stage Architecture

## Date: July 31, 2025

## Overview
A separate on-demand cleaning stage that can be applied to ANY collection method output, maintaining the federated architecture principle while adding a powerful experimentation layer.

## Benefits of Separate Cleaning Stage

### 1. Maximum Flexibility
- Crawlee dumps + DeepSeek cleaning
- Scrapy multi-page + Llama cleaning  
- Playwright dumps + Qwen cleaning
- Mix and match any combination!

### 2. A/B Testing Capabilities
- Compare same raw data with different LLM models
- Find which LLM works best for which type of site
- Test new models without changing collection code

### 3. Async Processing
- Collect now, clean later
- Batch process overnight
- Reprocess old dumps with better models

### 4. Cost Optimization
- Only clean what you need
- Skip cleaning for test runs
- Use expensive models selectively

## Potential Implementation

```
Raw Dumps (from any method) → Cleaning Service API → Choose Model → Get Cleaned Data
```

## Advanced Features

This architecture enables:
- Save cleaning results separately
- Compare outputs from different models
- Build a "best model selector" based on domain type

## Architectural Principles

This maintains the federated architecture principle by:
1. Keeping collection services focused on their core purpose
2. Separating concerns between data collection and data processing
3. Allowing independent evolution of collection and cleaning methods
4. Enabling experimentation without changing stable collection code

## Use Cases

1. **Research & Development**
   - Test new LLM models on existing data
   - Compare extraction quality across models
   - Build training datasets from successful extractions

2. **Production Optimization**
   - Route different domain types to optimal models
   - Implement cost-based routing (use expensive models only when needed)
   - Retry failed extractions with different models

3. **Quality Improvement**
   - Reprocess historical data with improved models
   - A/B test model updates before deployment
   - Build confidence scoring based on model consensus