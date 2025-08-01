# Technical Implementation Guide: Multi-Entity Cleaning Pipeline
Date: August 1, 2025

## Overview
This guide provides concrete implementation steps for evolving the cleaning stage from single-entity extraction to multi-entity claims with evidence, based on our strategic reexamination.

## Current Architecture Analysis

### Existing Components
- `CleaningService`: Orchestrates cleaning with multiple LLM models
- `BaseModelAdapter`: Abstract base for model implementations
- `OpenRouterAdapter`: Handles LLM API calls
- Database tables: `cleaning_results`, `model_performance`

### Key Integration Points
- Raw dumps from: Crawlee, Scrapy, Playwright, Axios+Cheerio
- Processing pipeline: Stage 2 (cleaning) feeds Stage 3 (entity extraction)
- GLEIF verification: Requires structured entity claims

## Implementation Components

### 1. Smart Extraction Service (New)

```typescript
// server/beta-v2/cleaning/smartExtractionService.ts

import * as cheerio from 'cheerio';
import { SmartExtractionResult, EntityZone, Evidence } from './types';

export class SmartExtractionService {
  private readonly entitySelectors = {
    footer: 'footer, .footer, #footer, [class*="copyright"], [class*="legal"]',
    header: 'header, .header, #header, .navbar, nav',
    about: '[class*="about"], .company-info, #about-us, [itemtype*="Organization"]',
    contact: '[class*="contact"], .address, [itemtype*="PostalAddress"]',
    legal: '.terms, .privacy, .legal-notice, .disclaimer',
    
    // Industry-specific selectors
    financial: '.regulatory-disclosure, .license-info, .aml-statement',
    healthcare: '.accreditation, .certification, .npi-info',
    technology: '.offices, .subsidiaries, .locations'
  };

  async extractStructuredContent(html: string, domain: string): Promise<SmartExtractionResult> {
    const $ = cheerio.load(html);
    
    // Remove noise elements
    $('script, style, noscript, iframe').remove();
    
    const result: SmartExtractionResult = {
      entityZones: await this.extractEntityZones($),
      evidence: await this.extractEvidence($),
      context: await this.extractContext($, domain),
      metadata: {
        extractionMethod: 'cheerio',
        selectorVersion: '2.0',
        timestamp: new Date().toISOString()
      }
    };
    
    return result;
  }

  private async extractEntityZones($: cheerio.CheerioAPI): Promise<Record<EntityZone, string[]>> {
    const zones: Record<EntityZone, string[]> = {
      footer: [],
      header: [],
      about: [],
      contact: [],
      legal: []
    };

    // Extract each zone with deduplication
    for (const [zone, selector] of Object.entries(this.entitySelectors)) {
      if (zone in zones) {
        const texts = new Set<string>();
        $(selector).each((_, elem) => {
          const text = $(elem).text().trim();
          if (text && text.length > 10 && text.length < 500) {
            // Look for entity patterns
            const entityPatterns = [
              /(?:©|Copyright)\s+\d{4}\s+([A-Z][A-Za-z\s&,.-]+(?:Inc|Corp|Ltd|LLC|GmbH|AG|SA|NV|BV|PLC|Limited|Company))/gi,
              /^([A-Z][A-Za-z\s&,.-]+(?:Inc|Corp|Ltd|LLC|GmbH|AG|SA|NV|BV|PLC|Limited|Company))/gm,
              /(?:owned by|operated by|a subsidiary of|part of)\s+([A-Z][A-Za-z\s&,.-]+(?:Inc|Corp|Ltd|LLC|GmbH|AG|SA|NV|BV|PLC))/gi
            ];
            
            for (const pattern of entityPatterns) {
              const matches = text.match(pattern);
              if (matches) {
                matches.forEach(match => texts.add(match));
              }
            }
            
            // Also store full text for context
            if (text.match(/(?:Inc|Corp|Ltd|LLC|GmbH|AG|SA|NV|BV|PLC|Limited|Company)/i)) {
              texts.add(text);
            }
          }
        });
        zones[zone as EntityZone] = Array.from(texts);
      }
    }

    return zones;
  }

  private async extractEvidence($: cheerio.CheerioAPI): Promise<Evidence> {
    const evidence: Evidence = {
      addresses: [],
      phones: [],
      emails: [],
      vatNumbers: [],
      registrationNumbers: [],
      legalJurisdictions: []
    };

    // Extract addresses
    const addressSelectors = [
      '[itemtype*="PostalAddress"]',
      '.address',
      '[class*="address"]',
      'address'
    ];
    
    for (const selector of addressSelectors) {
      $(selector).each((_, elem) => {
        const text = $(elem).text().trim();
        const structured = this.parseAddress(text);
        if (structured) {
          evidence.addresses.push(structured);
        }
      });
    }

    // Extract phone numbers with country detection
    const phonePattern = /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{0,4}/g;
    const phoneMatches = $('body').text().match(phonePattern) || [];
    evidence.phones = phoneMatches
      .filter(p => p.length >= 10)
      .map(phone => ({
        number: phone,
        countryCode: this.detectPhoneCountry(phone),
        type: 'unknown'
      }));

    // Extract VAT/Tax numbers
    const vatPattern = /(?:VAT|Tax ID|USt-?Id|TVA|IVA|BTW|MwSt)[\s:#-]*([A-Z]{2}[\dA-Z]+)/gi;
    const vatMatches = $('body').text().match(vatPattern) || [];
    evidence.vatNumbers = vatMatches.map(m => m.replace(/.*?([A-Z]{2}[\dA-Z]+)/, '$1'));

    // Extract registration numbers
    const regPattern = /(?:Company No|Reg(?:istration)?\.?\s*(?:No|Number)|HRB|Trade Register)[\s:#-]*(\d+[\dA-Z-]*)/gi;
    const regMatches = $('body').text().match(regPattern) || [];
    evidence.registrationNumbers = regMatches.map(m => m.replace(/.*?([\dA-Z-]+)$/, '$1'));

    // Extract legal jurisdictions
    const jurisdictionPattern = /(?:incorporated in|registered in|organized under the laws of)\s+([A-Za-z\s]+?)(?:\.|,|;|$)/gi;
    const jurisdictionMatches = $('body').text().match(jurisdictionPattern) || [];
    evidence.legalJurisdictions = jurisdictionMatches.map(m => 
      m.replace(/.*?(?:incorporated in|registered in|organized under the laws of)\s+/i, '').trim()
    );

    return evidence;
  }

  private async extractContext($: cheerio.CheerioAPI, domain: string): Promise<Context> {
    return {
      pageLanguage: $('html').attr('lang') || 'en',
      currencies: this.extractCurrencies($('body').text()),
      domainTLD: domain.split('.').pop() || '',
      industryKeywords: this.detectIndustryKeywords($('body').text()),
      documentTitle: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content') || ''
    };
  }

  private parseAddress(text: string): AddressEvidence | null {
    // Simple address parser - can be enhanced
    const parts = text.split(/[,\n]/);
    if (parts.length >= 2) {
      return {
        full: text,
        country: this.detectCountry(text),
        city: parts[parts.length - 2]?.trim(),
        postalCode: text.match(/\b\d{5}(?:-\d{4})?\b/) ? text.match(/\b\d{5}(?:-\d{4})?\b/)![0] : undefined
      };
    }
    return null;
  }

  private detectPhoneCountry(phone: string): string {
    if (phone.startsWith('+1') || phone.match(/^\(?[2-9]\d{2}\)?/)) return 'US';
    if (phone.startsWith('+44')) return 'GB';
    if (phone.startsWith('+49')) return 'DE';
    if (phone.startsWith('+33')) return 'FR';
    // Add more country codes as needed
    return 'unknown';
  }

  private detectCountry(text: string): string {
    const countryPatterns = {
      'US': /(?:United States|USA|U\.S\.A?\.?)/i,
      'GB': /(?:United Kingdom|UK|Great Britain)/i,
      'DE': /(?:Germany|Deutschland)/i,
      'FR': /(?:France)/i,
      // Add more countries
    };
    
    for (const [code, pattern] of Object.entries(countryPatterns)) {
      if (pattern.test(text)) return code;
    }
    return 'unknown';
  }

  private extractCurrencies(text: string): string[] {
    const currencies = new Set<string>();
    const patterns = [
      /\$|USD|US\$/gi,
      /€|EUR|Euro/gi,
      /£|GBP|British Pound/gi,
      /¥|JPY|Yen/gi,
    ];
    
    patterns.forEach(pattern => {
      if (pattern.test(text)) {
        const currency = pattern.source.split('|')[1] || pattern.source.split('|')[0];
        currencies.add(currency.replace(/[\\$]/g, ''));
      }
    });
    
    return Array.from(currencies);
  }

  private detectIndustryKeywords(text: string): string[] {
    const industries = {
      financial: /bank|finance|investment|insurance|capital|fund/i,
      healthcare: /health|medical|pharma|clinical|patient|therapy/i,
      technology: /software|technology|digital|cloud|data|AI/i,
      manufacturing: /manufacturing|production|factory|industrial/i,
      retail: /retail|store|shop|commerce|consumer/i
    };
    
    const detected: string[] = [];
    for (const [industry, pattern] of Object.entries(industries)) {
      if (pattern.test(text)) {
        detected.push(industry);
      }
    }
    
    return detected;
  }
}
```

### 2. Updated Model Adapter for Multi-Entity

```typescript
// server/beta-v2/cleaning/modelAdapters/multiEntityAdapter.ts

export class MultiEntityOpenRouterAdapter extends BaseModelAdapter {
  async clean(rawData: string, systemPrompt?: string): Promise<MultiEntityCleaningResult> {
    const startTime = Date.now();
    
    const multiEntityPrompt = systemPrompt || this.getMultiEntityPrompt();
    
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model: this.modelId,
          messages: [
            {
              role: 'system',
              content: multiEntityPrompt
            },
            {
              role: 'user',
              content: `Analyze this content and extract ALL legal entities with evidence:\n\n${rawData}`
            }
          ],
          temperature: 0.3,
          max_tokens: 4000, // Increased for multiple entities
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content);
      
      return {
        entityClaims: result.entityClaims || [],
        industryClassification: result.industryClassification,
        extractionMetadata: {
          ...result.extractionMetadata,
          modelId: this.modelId,
          processingTimeMs: Date.now() - startTime
        }
      };
      
    } catch (error) {
      console.error('[MultiEntityAdapter] Error:', error);
      throw error;
    }
  }

  private getMultiEntityPrompt(): string {
    return `You are analyzing a website to identify ALL legal entities associated with this domain.

CRITICAL: One domain often represents multiple valid entities. Do not try to pick just one "correct" answer.

Your task:
1. Identify ALL distinct legal entities mentioned (operator, holding company, subsidiaries)
2. Extract exact legal names with proper suffixes (Inc., Ltd., GmbH, S.A., N.V., etc.)
3. Collect specific evidence for each entity claim
4. Determine entity relationships (operator vs holding vs subsidiary)
5. Note geographic markers and jurisdictions

Look for entities in:
- Copyright notices (often contain legal operator names)
- Legal/privacy sections (data controller information)
- About/company sections (corporate structure)
- Contact pages (office locations)
- Footer text (subsidiary listings)

Return a JSON object with this structure:
{
  "entityClaims": [
    {
      "legalName": "exact legal name with suffix",
      "entityType": "operating_company|holding_company|subsidiary|division",
      "confidence": 0.0-1.0,
      "evidence": {
        "source": "where found (footer_copyright, legal_page, etc.)",
        "text": "exact text that mentions this entity",
        "address": "if found",
        "registrationNumber": "if found",
        "vatNumber": "if found"
      },
      "geography": {
        "country": "ISO code",
        "headquarters": "city if known",
        "jurisdiction": "legal jurisdiction"
      }
    }
  ],
  "industryClassification": "primary industry",
  "extractionMetadata": {
    "multiEntityDomain": true/false,
    "complexStructure": true/false,
    "evidenceQuality": "high|medium|low"
  }
}

Remember: Multiple entities are often correct. A website for QIAGEN would validly have both QIAGEN GmbH (German operator) and QIAGEN N.V. (Dutch holding company).`;
  }
}
```

### 3. Database Schema Updates

```sql
-- Add new table for multi-entity results
CREATE TABLE IF NOT EXISTS cleaning_results_multi_entity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cleaning_result_id UUID REFERENCES cleaning_results(id),
    entity_index INTEGER NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50),
    confidence DECIMAL(3,2),
    evidence JSONB,
    geography JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for efficient queries
CREATE INDEX idx_cleaning_results_multi_entity_result_id 
ON cleaning_results_multi_entity(cleaning_result_id);

-- Update cleaning_results table
ALTER TABLE cleaning_results 
ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(50) DEFAULT 'single_entity',
ADD COLUMN IF NOT EXISTS entity_count INTEGER DEFAULT 1;
```

### 4. Updated Cleaning Service Integration

```typescript
// Modifications to server/beta-v2/cleaning/cleaningService.ts

export class CleaningService {
  private smartExtractor: SmartExtractionService;
  private multiEntityAdapters: Map<string, MultiEntityOpenRouterAdapter> = new Map();

  constructor() {
    this.smartExtractor = new SmartExtractionService();
    this.initializeAdapters();
    this.initializeMultiEntityAdapters();
  }

  async processWithSmartExtraction(
    sourceType: 'crawlee_dump' | 'scrapy_crawl' | 'playwright_dump' | 'axios_cheerio_dump',
    sourceId: string,
    models: string[] = ['meta-llama/llama-3.1-8b-instruct:free']
  ): Promise<MultiEntityCleaningResult[]> {
    console.log(`[CleaningService] Smart extraction for ${sourceType}:${sourceId}`);
    
    // Get raw data
    const rawData = await this.getRawData(sourceType, sourceId);
    if (!rawData) {
      throw new Error('No raw data found');
    }

    // Step 1: Smart extraction
    const extracted = await this.smartExtractor.extractStructuredContent(
      rawData.content,
      rawData.domain
    );

    // Step 2: Prepare structured input for LLM
    const structuredInput = this.prepareStructuredInput(extracted);

    // Step 3: Process with multi-entity models
    const results: MultiEntityCleaningResult[] = [];
    
    for (const model of models) {
      const adapter = this.multiEntityAdapters.get(model);
      if (!adapter) continue;

      try {
        const result = await adapter.clean(structuredInput);
        
        // Save results
        const savedResult = await this.saveMultiEntityResult(
          sourceType,
          sourceId,
          model,
          result,
          extracted
        );
        
        results.push({
          ...result,
          id: savedResult.id,
          model: model
        });
        
      } catch (error) {
        console.error(`[CleaningService] Error with ${model}:`, error);
      }
    }

    return results;
  }

  private prepareStructuredInput(extracted: SmartExtractionResult): string {
    return JSON.stringify({
      entityZones: extracted.entityZones,
      evidence: extracted.evidence,
      context: extracted.context,
      instruction: "Extract ALL legal entities found in the entity zones and evidence"
    }, null, 2);
  }

  private async saveMultiEntityResult(
    sourceType: string,
    sourceId: string,
    model: string,
    result: MultiEntityCleaningResult,
    extractedData: SmartExtractionResult
  ): Promise<{ id: string }> {
    // Begin transaction
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Save main result
      const mainResult = await client.query(`
        INSERT INTO cleaning_results (
          source_type, source_id, model_name, 
          cleaned_data, metadata, extraction_method, entity_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        sourceType,
        sourceId,
        model,
        result,
        result.extractionMetadata,
        'multi_entity',
        result.entityClaims.length
      ]);

      const resultId = mainResult.rows[0].id;

      // Save each entity claim
      for (let i = 0; i < result.entityClaims.length; i++) {
        const claim = result.entityClaims[i];
        await client.query(`
          INSERT INTO cleaning_results_multi_entity (
            cleaning_result_id, entity_index, legal_name,
            entity_type, confidence, evidence, geography
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          resultId,
          i,
          claim.legalName,
          claim.entityType,
          claim.confidence,
          claim.evidence,
          claim.geography
        ]);
      }

      await client.query('COMMIT');
      return { id: resultId };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### 5. API Endpoint Updates

```typescript
// Add to server/beta-v2/routes/cleaningRoutes.ts

router.post('/clean-multi-entity', async (req, res) => {
  try {
    const { sourceType, sourceId, models, useSmartExtraction = true } = req.body;
    
    if (!sourceType || !sourceId) {
      return res.status(400).json({ 
        error: 'sourceType and sourceId are required' 
      });
    }

    const cleaningService = new CleaningService();
    
    let results;
    if (useSmartExtraction) {
      results = await cleaningService.processWithSmartExtraction(
        sourceType,
        sourceId,
        models
      );
    } else {
      // Fallback to traditional single-entity
      results = await cleaningService.processWithModels(
        sourceType,
        sourceId,
        models
      );
    }

    res.json({
      success: true,
      results,
      extractionMethod: useSmartExtraction ? 'smart_multi_entity' : 'traditional'
    });
    
  } catch (error) {
    console.error('[API] Cleaning error:', error);
    res.status(500).json({ 
      error: 'Failed to process cleaning',
      details: error.message 
    });
  }
});

// Get multi-entity results
router.get('/results/multi-entity/:cleaningResultId', async (req, res) => {
  try {
    const { cleaningResultId } = req.params;
    
    const result = await executeBetaV2Query(`
      SELECT 
        cr.id,
        cr.source_type,
        cr.source_id,
        cr.model_name,
        cr.extraction_method,
        cr.entity_count,
        cr.created_at,
        json_agg(
          json_build_object(
            'legalName', me.legal_name,
            'entityType', me.entity_type,
            'confidence', me.confidence,
            'evidence', me.evidence,
            'geography', me.geography
          ) ORDER BY me.entity_index
        ) as entity_claims
      FROM cleaning_results cr
      LEFT JOIN cleaning_results_multi_entity me 
        ON me.cleaning_result_id = cr.id
      WHERE cr.id = $1
      GROUP BY cr.id
    `, [cleaningResultId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('[API] Error fetching multi-entity results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});
```

## Testing Strategy

### Unit Tests
```typescript
// tests/smartExtraction.test.ts
describe('SmartExtractionService', () => {
  it('should extract multiple entities from footer', async () => {
    const html = `
      <footer>
        © 2024 ACME Corporation. All rights reserved.
        ACME Corp is a subsidiary of ACME Holdings Inc.
      </footer>
    `;
    
    const result = await extractor.extractStructuredContent(html, 'acme.com');
    expect(result.entityZones.footer).toContain('ACME Corporation');
    expect(result.entityZones.footer).toContain('ACME Holdings Inc');
  });

  it('should extract evidence correctly', async () => {
    const html = `
      <div class="contact">
        123 Main St, New York, NY 10001
        Tel: +1-212-555-0100
        VAT: US123456789
      </div>
    `;
    
    const result = await extractor.extractStructuredContent(html, 'example.com');
    expect(result.evidence.addresses).toHaveLength(1);
    expect(result.evidence.phones[0].countryCode).toBe('US');
    expect(result.evidence.vatNumbers).toContain('US123456789');
  });
});
```

### Integration Tests
```typescript
// tests/multiEntityCleaning.test.ts
describe('Multi-Entity Cleaning Pipeline', () => {
  it('should process QIAGEN correctly', async () => {
    // Use real QIAGEN HTML dump
    const results = await cleaningService.processWithSmartExtraction(
      'crawlee_dump',
      'test-qiagen-id'
    );
    
    const entities = results[0].entityClaims;
    const entityNames = entities.map(e => e.legalName);
    
    expect(entityNames).toContain('QIAGEN GmbH');
    expect(entityNames).toContain('QIAGEN N.V.');
    
    const gmbh = entities.find(e => e.legalName === 'QIAGEN GmbH');
    expect(gmbh.entityType).toBe('operating_company');
    expect(gmbh.geography.country).toBe('DE');
  });
});
```

## Rollout Plan

### Phase 1: Development (Week 1)
1. Implement SmartExtractionService
2. Create MultiEntityOpenRouterAdapter
3. Update database schema
4. Basic testing

### Phase 2: Testing (Week 2)
1. Unit tests for all components
2. Integration testing with real dumps
3. Performance benchmarking
4. A/B testing framework

### Phase 3: Gradual Rollout (Week 3)
1. Enable for 10% of new dumps
2. Monitor quality metrics
3. Compare with single-entity results
4. Gather user feedback

### Phase 4: Full Deployment (Week 4)
1. Enable for all new processing
2. Backfill high-value domains
3. Update documentation
4. Train users on new features

## Performance Considerations

### Optimization Strategies
1. **Cheerio Parsing**: Cache parsed DOM for multiple extractions
2. **Batch Processing**: Process multiple dumps in parallel
3. **Selective Extraction**: Only parse relevant sections based on domain
4. **LLM Token Optimization**: Send only extracted zones, not full HTML

### Expected Performance
- Smart extraction: <500ms per domain
- LLM processing: <2s per domain
- Total pipeline: <3s per domain (vs current 5s)
- Token reduction: 40-60% fewer tokens

## Monitoring and Metrics

### Key Metrics to Track
```sql
-- Multi-entity extraction effectiveness
SELECT 
  DATE(created_at) as date,
  AVG(entity_count) as avg_entities_per_domain,
  COUNT(DISTINCT source_id) as domains_processed,
  AVG(CASE WHEN entity_count > 1 THEN 1 ELSE 0 END) as multi_entity_rate
FROM cleaning_results
WHERE extraction_method = 'multi_entity'
GROUP BY DATE(created_at);

-- Evidence quality
SELECT 
  COUNT(*) FILTER (WHERE evidence->>'address' IS NOT NULL) as with_address,
  COUNT(*) FILTER (WHERE evidence->>'vatNumber' IS NOT NULL) as with_vat,
  COUNT(*) FILTER (WHERE evidence->>'registrationNumber' IS NOT NULL) as with_reg,
  AVG(confidence) as avg_confidence
FROM cleaning_results_multi_entity;
```

## Configuration Management

### Feature Flags
```typescript
// config/cleaningFeatures.ts
export const CLEANING_FEATURES = {
  enableSmartExtraction: process.env.ENABLE_SMART_EXTRACTION === 'true',
  enableMultiEntity: process.env.ENABLE_MULTI_ENTITY === 'true',
  smartExtractionDomains: process.env.SMART_EXTRACTION_DOMAINS?.split(',') || [],
  maxEntitiesPerDomain: parseInt(process.env.MAX_ENTITIES_PER_DOMAIN || '5'),
  minEntityConfidence: parseFloat(process.env.MIN_ENTITY_CONFIDENCE || '0.7')
};
```

## Backwards Compatibility

### API Response Adaptation
```typescript
// Adapter to maintain compatibility with single-entity consumers
export function adaptMultiToSingleEntity(multiResult: MultiEntityCleaningResult): SingleEntityResult {
  // Pick highest confidence entity as primary
  const primary = multiResult.entityClaims
    .sort((a, b) => b.confidence - a.confidence)[0];
    
  return {
    companyName: primary?.legalName,
    confidence: primary?.confidence,
    metadata: {
      ...multiResult.extractionMetadata,
      totalEntitiesFound: multiResult.entityClaims.length,
      additionalEntities: multiResult.entityClaims.slice(1)
    }
  };
}
```

## Success Criteria

1. **Quality**: >80% of multi-entity domains correctly identified
2. **Performance**: <3s average processing time
3. **Coverage**: Evidence found for >70% of entities
4. **User Satisfaction**: Positive feedback on entity completeness
5. **GLEIF Matching**: >60% of extracted entities match GLEIF records

## Next Steps

1. Review and approve implementation plan
2. Set up development environment
3. Begin SmartExtractionService implementation
4. Create test datasets from existing dumps
5. Start incremental development following phases