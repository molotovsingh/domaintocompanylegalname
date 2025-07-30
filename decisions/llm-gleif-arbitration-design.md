# LLM-Based GLEIF Entity Selection Design

## Overview
When GLEIF API returns multiple potential entities for a domain, use LLM to intelligently select the correct entity based on geographic markers and contextual analysis from the website.

## Problem Statement
GLEIF searches often return multiple entities with similar names but from different jurisdictions:
- "Apple Inc." (USA)
- "Apple Limited" (UK) 
- "Apple Pty Ltd" (Australia)
- "Apple GmbH" (Germany)

Current weighted scoring algorithm uses basic heuristics, but LLM can make more intelligent decisions.

## LLM Selection Flow

```
Domain → GLEIF API → Multiple Candidates → LLM Analysis → Correct Entity
                              ↓
                    Website Geographic Markers
                    (addresses, phone, currency, language)
```

## Implementation Design

### 1. Data Collection for LLM Decision
```javascript
const gleifSelectionData = {
  domain: "apple.com",
  gleifCandidates: [
    {
      leiCode: "54930056FHWP7GIWYY08",
      legalName: "Apple Inc.",
      jurisdiction: "US",
      headquartersAddress: "Cupertino, CA, USA"
    },
    {
      leiCode: "DUMMY123456789",
      legalName: "Apple Limited", 
      jurisdiction: "GB",
      headquartersAddress: "London, UK"
    }
  ],
  websiteMarkers: {
    addresses: ["One Apple Park Way, Cupertino, CA 95014"],
    phoneNumbers: ["+1-800-APL-CARE"],
    currencies: ["USD", "$"],
    languages: ["en-US"],
    legalJurisdictions: ["California", "United States"],
    footerText: "© 2024 Apple Inc. All rights reserved."
  }
}
```

### 2. LLM Prompt Template
```
You are analyzing which GLEIF entity matches a website domain.

Domain: {domain}

GLEIF Candidates:
{formatted_candidates}

Website Geographic/Legal Markers:
- Addresses found: {addresses}
- Phone numbers: {phone_numbers}
- Currencies: {currencies}
- Languages: {languages}
- Legal jurisdictions mentioned: {jurisdictions}
- Footer/copyright text: {footer_text}

Based on these geographic and legal markers from the website, which GLEIF candidate is the correct match? Consider:
1. Address proximity to headquarters
2. Phone number country codes
3. Currency usage
4. Legal jurisdiction mentions
5. Language variants

Return the LEI code of the most likely match with explanation.
```

### 3. Integration Points

#### Update GLEIF Selection Logic
```typescript
// Current: Basic weighted scoring
const selectPrimaryCandidate = (candidates) => {
  return candidates.reduce((best, current) => 
    current.score > best.score ? current : best
  );
};

// Enhanced: LLM-based selection
const selectPrimaryCandidate = async (candidates, domainData) => {
  if (candidates.length === 1) {
    return candidates[0];
  }
  
  // Use LLM for multiple candidates
  const llmSelection = await openRouterService.selectGleifEntity({
    domain: domainData.domain,
    candidates: candidates,
    websiteMarkers: domainData.geoMarkers
  });
  
  return candidates.find(c => c.leiCode === llmSelection.selectedLei);
};
```

### 4. Example Scenarios

#### Scenario 1: Deutsche Bank
- Domain: `db.com`
- GLEIF returns: "Deutsche Bank AG" (Germany), "Deutsche Bank Americas" (USA)
- Website markers: Frankfurt address, EUR currency, German phone
- LLM selects: German entity

#### Scenario 2: HSBC
- Domain: `hsbc.com`
- GLEIF returns: Multiple HSBC entities from UK, Hong Kong, USA
- Website markers: Global presence, multiple currencies
- LLM analysis: Identifies UK parent company from "HSBC Holdings plc" in footer

#### Scenario 3: Regional Bank
- Domain: `localbank.com`
- GLEIF returns: Similar named banks from different US states
- Website markers: Specific state mentions, local phone area codes
- LLM selects: Correct regional entity

## Benefits Over Current Approach

1. **Contextual Understanding**: LLM understands nuanced geographic references
2. **Multi-Signal Analysis**: Combines multiple markers intelligently
3. **Explanation**: Provides reasoning for selection
4. **Handles Edge Cases**: Better at ambiguous situations
5. **Continuous Improvement**: Can be fine-tuned with examples

## Implementation Phases

### Phase 1: Proof of Concept
- Implement for domains with 2-3 GLEIF candidates
- Manual validation of LLM selections
- Collect accuracy metrics

### Phase 2: Production Integration
- Automatic trigger when multiple candidates exist
- Fallback to weighted scoring if LLM fails
- Cost monitoring per selection

### Phase 3: Enhancement
- Fine-tune prompts based on accuracy data
- Add industry-specific selection logic
- Cache LLM decisions for similar patterns

## Cost Considerations

- Only use LLM when multiple GLEIF candidates exist (~20% of cases)
- Estimated cost: $0.002-0.005 per selection
- ROI: Higher accuracy in entity matching for acquisition research

## Success Metrics

1. **Accuracy**: >95% correct entity selection
2. **Cost**: <$0.01 per domain with multiple candidates
3. **Speed**: <3 seconds additional processing time
4. **Coverage**: Handle 90% of multi-candidate scenarios