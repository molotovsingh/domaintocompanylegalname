# Screenshot-Based NER Extraction Research

## Current Problem Statement
- Regex-based footer extraction has fundamental limitations with complex corporate names
- Pattern matching fails on edge cases: "Merck & Co., Inc." vs "Exxon Mobil Corporation"
- Marketing copy contamination in HTML parsing
- Legal entity suffix variations across 13+ jurisdictions create regex complexity

## Proposed Solution: Screenshot + NER Pipeline

### Architecture Overview
```
Domain URL → Headless Browser → Screenshot → OCR → NER Models → Legal Entity
```

### Technical Components

#### 1. Screenshot Capture
- **Tool**: Puppeteer/Playwright for headless browsing
- **Target**: Last 10% of page (footer region)
- **Format**: PNG/JPEG for OCR processing
- **Viewport**: Standard desktop resolution (1920x1080)

#### 2. OCR (Optical Character Recognition)
- **On-Premise Options**:
  - Tesseract.js (JavaScript implementation)
  - PaddleOCR (Python, high accuracy)
  - EasyOCR (Python, multilingual)
- **Benefits**: Extract all text from visual elements, bypassing HTML parsing

#### 3. NER (Named Entity Recognition)
- **On-Premise Models**:
  - spaCy with custom legal entity models
  - Hugging Face Transformers (BERT-based)
  - Custom fine-tuned models for corporate entities
- **Target Entities**: Organization names, legal suffixes, corporate structures

## Feasibility Analysis

### Advantages
1. **Bypasses HTML Parsing Issues**: No more regex complexity or markup contamination
2. **Visual Context**: Can identify company names in visual layouts (logos, styled text)
3. **Jurisdiction Agnostic**: NER models can learn patterns vs hardcoded rules
4. **Marketing Copy Resistance**: Footer screenshots focus on legal/copyright content
5. **Future-Proof**: Adaptable to new corporate naming patterns

### Technical Challenges
1. **Performance**: Screenshot + OCR + NER pipeline vs regex speed
2. **Resource Usage**: Memory/CPU intensive compared to HTML parsing
3. **Accuracy**: OCR errors could introduce new extraction failures
4. **Model Training**: Need corporate entity dataset for NER fine-tuning
5. **Scalability**: Processing time per domain significantly higher

### Scalability Considerations

#### Performance Benchmarks (Estimated)
- **Current Regex**: ~100-500ms per domain
- **Screenshot Pipeline**: ~3-8 seconds per domain
- **Batch Processing**: May require queue management for large batches

#### Resource Requirements
- **Memory**: Headless browser instances (~50-100MB each)
- **Storage**: Temporary screenshot files
- **Models**: NER model loading (1-2GB RAM)
- **Concurrent Processing**: Limited by browser instance pool

## Implementation Strategy

### Phase 1: Proof of Concept
1. Create isolated test environment
2. Implement basic screenshot capture for single domain
3. Test OCR accuracy on footer regions
4. Evaluate existing NER models for organization extraction

### Phase 2: Model Development
1. Collect corporate entity training dataset
2. Fine-tune NER models for legal entity recognition
3. Validate against known Fortune 500 entities
4. Compare accuracy vs current regex method

### Phase 3: Performance Optimization
1. Optimize screenshot dimensions and quality
2. Implement parallel processing with browser pools
3. Cache screenshots for repeated processing
4. Benchmark end-to-end performance

## Risk Assessment

### High Risk
- **Processing Time**: 10x slower than current method
- **Resource Consumption**: Significant memory/CPU overhead
- **OCR Accuracy**: Text recognition errors in footer regions

### Medium Risk  
- **Model Training**: Requires corporate entity dataset development
- **Maintenance**: More complex pipeline than regex patterns
- **Error Handling**: Multiple failure points (browser, OCR, NER)

### Low Risk
- **Technology Maturity**: Well-established OCR and NER tools
- **Isolation**: Can be developed parallel to existing system
- **Fallback**: Current regex method remains as backup

## Recommended Next Steps

1. **Quick Prototype**: Test screenshot capture + OCR on 5-10 domains
2. **Accuracy Comparison**: Evaluate NER results vs current extractions
3. **Performance Baseline**: Measure processing time and resource usage
4. **Decision Point**: Determine if accuracy gains justify performance cost

## Alternative Approaches to Consider

1. **Hybrid Method**: Screenshot for failed regex cases only
2. **Enhanced HTML Parsing**: Better content area detection vs footer focus
3. **Machine Learning on HTML**: Train models on HTML structure patterns
4. **API-First**: Prioritize GLEIF/corporate registry lookups over extraction

Would you like me to start with a proof-of-concept implementation to test the basic feasibility?