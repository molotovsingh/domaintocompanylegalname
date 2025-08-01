# Cleaning Stage Reexamination with Accumulated Learnings
Date: August 1, 2025

## Executive Summary
After months of operation and learning, we now understand that the cleaning stage is critical for the 1-to-many domain-entity mapping challenge. This document synthesizes all learnings to propose an evolved cleaning architecture that embraces our claims-based philosophy while improving accuracy and efficiency.

## Key Learnings That Shape Our Approach

### 1. Domain-to-Entity is 1-to-Many (Not 1-to-1)
- **Learning**: A single domain often represents multiple valid entities (operator vs. holding company)
- **Impact on Cleaning**: Must preserve ALL entity mentions, not just the "main" one
- **Example**: qiagen.com → QIAGEN GmbH (operator) AND QIAGEN N.V. (holding company)

### 2. Context is King for LLM Processing
- **Learning**: LLMs perform better with structured, contextual data rather than raw text
- **Impact on Cleaning**: Preserve HTML structure clues (headers, footers, about sections)
- **Example**: Legal text in footers often contains the most accurate entity names

### 3. Industry-Specific Patterns Matter
- **Learning**: Different industries present entity information differently
- **Impact on Cleaning**: Need domain-aware extraction rules
- **Example**: Financial services emphasize regulatory entities; tech companies list subsidiaries

### 4. Claims-Based Approach Works Better
- **Learning**: Present multiple entity claims with evidence for final arbitration
- **Impact on Cleaning**: Extract and preserve evidence for each potential entity
- **Example**: Address, jurisdiction markers, regulatory numbers support each claim

## Current State Analysis

### What Works Well
1. **Two-Stage Pipeline**: Strip → Enhance provides good separation of concerns
2. **Model Flexibility**: Multiple LLM adapters allow experimentation
3. **Free Tier Usage**: Llama 3.1 8B handles basic enhancement well

### What Needs Improvement
1. **Crude HTML Stripping**: Loses valuable structural context
2. **Single Entity Bias**: Current prompts seek one "correct" answer
3. **No Evidence Collection**: Missing supporting data for claims
4. **Generic Processing**: No industry-specific intelligence

## Proposed Evolution: Claims-Aware Cleaning Pipeline

### Architecture Overview
```
Raw HTML → Smart Extraction → Evidence Collection → Multi-Entity Enhancement → Claims Generation
```

### Stage 1: Smart Extraction (Replace Basic Stripping)

#### Implementation with Cheerio
```typescript
interface SmartExtractionResult {
  // Multiple entity zones
  entityZones: {
    footer: string[];
    header: string[];
    about: string[];
    contact: string[];
    legal: string[];
  };
  
  // Supporting evidence
  evidence: {
    addresses: AddressEvidence[];
    phones: PhoneEvidence[];
    emails: string[];
    vatNumbers: string[];
    registrationNumbers: string[];
    legalJurisdictions: string[];
  };
  
  // Contextual markers
  context: {
    pageLanguage: string;
    currencies: string[];
    dateFormats: string[];
    domainTLD: string;
    industryKeywords: string[];
  };
  
  // Jurisdiction intelligence
  jurisdiction: {
    primaryJurisdiction: string; // Detected from TLD, addresses, language
    possibleJurisdictions: string[]; // All detected jurisdictions
    applicableSuffixes: JurisdictionSuffixes; // Legal suffixes for detected jurisdictions
    mandatoryRules: string[]; // Jurisdiction-specific rules
  };
}

interface JurisdictionSuffixes {
  corporations: string[]; // Inc., Corp., SA, AG, etc.
  limitedLiability: string[]; // LLC, GmbH, SARL, etc.
  partnerships: string[]; // LP, LLP, etc.
  professional: string[]; // P.C., PLLC, etc.
  byJurisdiction: Record<string, string[]>; // Grouped by country
}
```

#### Key Selectors for Entity Extraction
```javascript
const entitySelectors = {
  // Primary zones
  footer: 'footer, .footer, #footer, [class*="copyright"], [class*="legal"]',
  about: '[class*="about"], .company-info, #about-us, [itemtype*="Organization"]',
  contact: '[class*="contact"], .address, [itemtype*="PostalAddress"]',
  
  // Industry-specific
  financial: '.regulatory-disclosure, .license-info, .registration-details',
  healthcare: '.facility-info, .provider-details, .certification',
  tech: '.subsidiary-list, .global-offices, .entity-structure'
};
```

### Stage 2: Jurisdiction Intelligence Layer (New)

#### Jurisdiction Detection Strategy
```typescript
interface JurisdictionDetection {
  // Primary detection methods
  detectFromDomain(domain: string): JurisdictionInfo;
  detectFromAddresses(addresses: AddressEvidence[]): JurisdictionInfo[];
  detectFromPhones(phones: PhoneEvidence[]): JurisdictionInfo[];
  detectFromLegalText(text: string): JurisdictionInfo[];
  
  // Consolidation
  consolidateJurisdictions(detections: JurisdictionInfo[]): {
    primary: string;
    secondary: string[];
    confidence: Record<string, number>;
  };
}
```

#### Key Jurisdiction Rules to Apply
1. **Mandatory Suffix Rules**
   - US: Corporations must have Inc., Corp., LLC, etc.
   - Germany: GmbH, AG are mandatory
   - France: SA, SARL, SAS required
   - UK: Ltd, PLC required
   - Singapore: Pte Ltd for private companies

2. **Exemption Rules**
   - Nonprofits often exempt from suffix requirements
   - Universities, hospitals don't need corporate suffixes
   - Government entities have different rules
   - Trusts may not be separate legal entities

3. **Multi-Jurisdiction Complexity**
   - Parent in one jurisdiction, subsidiary in another
   - Different suffixes for same company group
   - Cross-border entity structures

### Stage 3: Evidence Collection (Enhanced with Jurisdiction Context)

#### Evidence Types to Collect
1. **Geographic Evidence**
   - Full addresses with country/state parsing
   - Phone numbers with country code analysis
   - Time zones from office hours
   - Currency usage patterns

2. **Legal Evidence**
   - Copyright statements with entity names
   - Terms of service entity references
   - Privacy policy data controller names
   - Regulatory registration numbers
   - Jurisdiction-specific identifiers (VAT, EIN, etc.)

3. **Structural Evidence**
   - Parent-subsidiary relationships mentioned
   - "Part of" or "Division of" statements
   - Multi-entity copyright notices
   - Regional office listings
   - Cross-jurisdiction entity mentions

### Stage 4: Multi-Entity LLM Enhancement (Jurisdiction-Aware)

#### Evolved Prompting Strategy with Jurisdiction Context
```
System: You are analyzing a website to identify ALL legal entities associated with this domain.

CRITICAL CONTEXT - Jurisdiction Rules:
{jurisdiction_rules}

Key principles:
1. One domain often represents multiple valid entities (operator, holding company, regional subsidiaries)
2. Entity suffixes are MANDATORY in most jurisdictions (Inc., Corp., Ltd., GmbH, SA, etc.)
3. Different jurisdictions have different suffix requirements
4. Some entities (nonprofits, universities) may be exempt from suffix requirements

Your task:
1. Identify ALL distinct legal entities mentioned
2. Verify each entity has appropriate suffix for its jurisdiction
3. Collect evidence supporting each entity's relationship to the domain
4. Determine the entity type (operator, holding, subsidiary, division)
5. Extract exact legal names with jurisdiction-appropriate suffixes
6. Note if an entity appears to be missing a required suffix
7. Consider cross-jurisdiction structures (e.g., US parent, German subsidiary)

Return multiple entity claims with jurisdiction validation.
```

#### Jurisdiction-Enhanced Prompt Variables
```typescript
const jurisdictionRules = {
  detectedJurisdictions: ['us', 'de'], // From detection stage
  applicableSuffixes: {
    us: ['Inc.', 'Corp.', 'LLC', 'L.L.C.', 'Ltd.', 'Co.'],
    de: ['GmbH', 'AG', 'KG', 'GmbH & Co. KG', 'SE']
  },
  mandatoryRules: [
    'US corporations must have Inc., Corp., or Corporation',
    'German limited liability companies must have GmbH',
    'Nonprofits may omit corporate suffixes'
  ],
  exemptions: [
    'Universities (e.g., Harvard University)',
    'Hospitals (e.g., Mayo Clinic)',
    'Government entities',
    'Certain trusts and foundations'
  ]
};
```

#### Expected Output Structure with Jurisdiction Validation
```json
{
  "entityClaims": [
    {
      "legalName": "QIAGEN GmbH",
      "entityType": "operating_company",
      "confidence": 0.9,
      "evidence": {
        "source": "footer_copyright",
        "text": "© 2024 QIAGEN GmbH. All rights reserved.",
        "address": "QIAGEN Strasse 1, 40724 Hilden, Germany",
        "vatNumber": "DE121491932"
      },
      "geography": {
        "country": "Germany",
        "headquarters": "Hilden"
      },
      "jurisdictionValidation": {
        "detectedJurisdiction": "de",
        "suffixValid": true,
        "suffixType": "limited_liability",
        "mandatorySuffix": true,
        "validationNotes": "GmbH is correct suffix for German limited liability company"
      }
    },
    {
      "legalName": "QIAGEN N.V.",
      "entityType": "holding_company",
      "confidence": 0.85,
      "evidence": {
        "source": "legal_disclosure",
        "text": "QIAGEN N.V., a public limited liability company",
        "registrationNumber": "12036979",
        "jurisdiction": "Netherlands"
      },
      "geography": {
        "country": "Netherlands",
        "incorporation": "Venlo"
      },
      "jurisdictionValidation": {
        "detectedJurisdiction": "nl",
        "suffixValid": true,
        "suffixType": "public_limited",
        "mandatorySuffix": true,
        "validationNotes": "N.V. is correct suffix for Dutch public company"
      }
    }
  ],
  "jurisdictionAnalysis": {
    "primaryJurisdiction": "de",
    "detectedJurisdictions": ["de", "nl"],
    "crossJurisdictionStructure": true,
    "structureType": "multinational_parent_subsidiary"
  },
  "industryClassification": "biotechnology",
  "primaryLanguage": "en",
  "extractionMetadata": {
    "multiEntityDomain": true,
    "complexStructure": true,
    "evidenceQuality": "high",
    "jurisdictionComplexity": "high"
  }
}
```

### Stage 4: Claims Generation (New)

Transform the multi-entity data into structured claims ready for GLEIF verification and final arbitration.

## Implementation Phases

### Phase 1: Smart Extraction (Week 1)
1. Implement Cheerio-based extraction service
2. Define entity zone selectors
3. Build evidence collection logic
4. Create industry detection rules

### Phase 2: Evidence Framework (Week 2)
1. Design evidence data structures
2. Implement address/phone parsing
3. Add regulatory number extraction
4. Build confidence scoring for evidence

### Phase 3: Multi-Entity LLM (Week 3)
1. Update LLM prompts for multiple entities
2. Modify output schemas
3. Test with complex corporate structures
4. Validate against known multi-entity domains

### Phase 4: Integration & Testing (Week 4)
1. Connect to existing pipeline
2. A/B test against current approach
3. Measure accuracy improvements
4. Fine-tune based on results

## Success Metrics

### Quality Metrics
- **Multi-Entity Detection Rate**: % of domains where multiple valid entities found
- **Evidence Completeness**: Average evidence items per entity claim
- **GLEIF Match Rate**: % of entities that match GLEIF records
- **False Positive Rate**: Invalid entities claimed

### Performance Metrics
- **Processing Time**: Target <2s per domain
- **Token Efficiency**: 40% reduction in LLM tokens
- **Memory Usage**: Efficient handling of large HTML

## Configuration and Control

### New Configuration Options
```typescript
interface CleaningConfiguration {
  // Extraction settings
  extractionMethod: 'basic' | 'smart' | 'hybrid';
  entityZones: string[]; // Which zones to extract from
  industryRules: boolean; // Enable industry-specific rules
  
  // Evidence settings
  collectEvidence: boolean;
  evidenceTypes: ('geographic' | 'legal' | 'structural')[];
  minEvidenceConfidence: number;
  
  // Multi-entity settings
  maxEntitiesPerDomain: number; // Default: 5
  minEntityConfidence: number; // Default: 0.7
  requireEvidence: boolean; // Reject claims without evidence
  
  // LLM settings
  llmModel: string;
  temperature: number;
  maxRetries: number;
}
```

## Migration Strategy

### Backward Compatibility
1. Keep existing single-entity pipeline as fallback
2. Add feature flag for multi-entity mode
3. Gradual rollout by domain or batch
4. Maintain existing API contracts

### Data Migration
1. Reprocess high-value domains with new pipeline
2. Preserve historical single-entity results
3. Add multi-entity results as new claims
4. Build comparison dashboard

## Risk Mitigation

### Potential Risks and Mitigations
1. **Over-extraction**: Limit entities per domain, require evidence
2. **Performance Impact**: Cache Cheerio parsing, optimize selectors
3. **LLM Hallucination**: Require evidence grounding for all claims
4. **Complex Prompts**: Test extensively, provide examples in prompt

## Next Steps

1. **Immediate**: Review and approve this approach with stakeholders
2. **Week 1**: Begin smart extraction implementation
3. **Week 2**: Start evidence framework development
4. **Week 3**: Update LLM prompting strategy
5. **Week 4**: Integration and testing
6. **Week 5**: Gradual production rollout

## Conclusion

The evolution from single-entity extraction to multi-entity claims with evidence represents a fundamental improvement in our domain intelligence platform. By embracing the 1-to-many nature of domain-entity relationships and collecting comprehensive evidence, we can provide users with richer, more accurate intelligence for their decision-making.

This approach aligns perfectly with our platform philosophy: truth is a range of entities with confidence scores, not a single answer. The cleaning stage evolution ensures we capture and preserve all the nuance needed for intelligent arbitration.