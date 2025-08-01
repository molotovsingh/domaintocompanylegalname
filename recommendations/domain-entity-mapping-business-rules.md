# Domain-to-Entity Mapping: Business Complexity & Confidence Rules

## Executive Summary

Domain-to-entity mapping is not a simple 1:1 relationship. A single multinational corporation may have hundreds of legal entities across different jurisdictions, each potentially operating different domains. This document establishes business rules for prioritizing and scoring entity matches based on their corporate hierarchy and operational significance.

## The Business Complexity

### 1. Corporate Structure Reality

Consider a typical Fortune 500 company structure:
```
Apple Inc. (US Parent - Headquarters)
├── Apple Operations Europe (Ireland - Tax domicile)
├── Apple Sales International (Ireland)
├── Apple Distribution International (Ireland)
├── Apple Retail UK Limited (UK)
├── Apple GmbH (Germany)
├── Apple Japan, Inc. (Japan)
└── 100+ other subsidiaries
```

**Key Question**: When someone visits apple.de, which entity should we map?
- Apple Inc.? (Global parent)
- Apple GmbH? (German subsidiary)
- Apple Operations Europe? (Regional headquarters)

### 2. Domain Operating Patterns

Companies operate domains in various ways:
- **Centralized**: Parent company operates all domains globally
- **Localized**: Local subsidiaries operate country-specific domains
- **Mixed**: Combination based on regulatory requirements

## Entity Confidence Scoring Framework

### Tier 1: Highest Confidence (90-100%)

**1. Headquarters Entity**
- The ultimate parent company at global headquarters
- Usually found in: Annual reports, SEC filings
- Example: "Apple Inc." for apple.com
- **Business Logic**: Primary corporate entity, all subsidiaries roll up here

**2. Primary Operating Entity**
- The main entity conducting business in a jurisdiction
- Found in: Privacy policies, terms of service
- Example: "QIAGEN GmbH" operating qiagen.com from Germany
- **Business Logic**: Actual operator of the website/services

### Tier 2: High Confidence (70-89%)

**3. Regional Headquarters**
- Continental or regional managing entities
- Example: "Microsoft Ireland Operations Limited" for EMEA
- **Business Logic**: Manages multiple country operations

**4. Tax Domicile Entity**
- Primary entity for tax purposes in a region
- Often in Ireland, Netherlands, Singapore
- **Business Logic**: Financial hub but may not operate websites

### Tier 3: Medium Confidence (50-69%)

**5. Local Sales Subsidiaries**
- Country-specific sales entities
- Example: "Amazon Japan G.K." for amazon.co.jp
- **Business Logic**: Handle local transactions

**6. Distribution Entities**
- Logistics and fulfillment subsidiaries
- **Business Logic**: Support operations but rarely customer-facing

### Tier 4: Lower Confidence (30-49%)

**7. Holding Companies**
- Intermediate holding entities
- Usually have "Holdings" in name
- **Business Logic**: Legal structures, not operational

**8. Service Subsidiaries**
- Shared service centers, IT subsidiaries
- **Business Logic**: Internal support functions

### Tier 5: Lowest Confidence (0-29%)

**9. Dormant Entities**
- Inactive or shell companies
- **Business Logic**: Legal entities with no operations

**10. Special Purpose Vehicles**
- Created for specific transactions
- **Business Logic**: Temporary or limited scope

## Domain Matching Rules

### Rule 1: Geographic Alignment
```
IF domain TLD matches entity jurisdiction
THEN confidence_boost = +20%

Example: amazon.de → Amazon EU S.à r.l. (Luxembourg) gets boost
        because Luxembourg entity manages German operations
```

### Rule 2: Legal Document Presence
```
IF entity appears in domain's privacy policy OR terms
THEN confidence_boost = +30%

Example: qiagen.com privacy policy mentions "QIAGEN GmbH"
```

### Rule 3: Copyright Attribution
```
IF entity appears in copyright notice
THEN confidence_boost = +15%

Note: Many sites show parent company in copyright
```

### Rule 4: Operational Indicators
```
IF entity has operational keywords (Sales, Operations, Services)
THEN confidence_boost = +10%
ELSE IF entity has holding keywords (Holdings, Investments)
THEN confidence_penalty = -20%
```

### Rule 5: GLEIF Registration Status
```
IF entity GLEIF status = "ACTIVE"
THEN confidence_boost = +10%
ELSE IF status = "INACTIVE" or "RETIRED"
THEN confidence_penalty = -50%
```

## Practical Examples

### Example 1: Microsoft.com
- **Found Entities**:
  - Microsoft Corporation (US) - Headquarters
  - Microsoft Ireland Operations Ltd - EMEA Hub
  - Microsoft Technology Licensing, LLC - IP Holding

- **Scoring**:
  - Microsoft Corporation: 95% (Headquarters + Copyright)
  - Microsoft Ireland: 60% (Regional HQ, no geographic match)
  - Microsoft Technology Licensing: 30% (Non-operational)

**Result**: Microsoft Corporation (highest confidence)

### Example 2: HSBC.co.uk
- **Found Entities**:
  - HSBC Holdings plc (UK) - Parent
  - HSBC UK Bank plc (UK) - Operating bank
  - HSBC Bank plc (UK) - Another subsidiary

- **Scoring**:
  - HSBC UK Bank plc: 90% (Operating entity + Geographic match)
  - HSBC Holdings plc: 70% (Parent but "Holdings" keyword)
  - HSBC Bank plc: 75% (Operating entity)

**Result**: HSBC UK Bank plc (highest confidence)

## Implementation Guidelines

### 1. Multi-Signal Approach
Never rely on a single indicator. Combine:
- Legal document extraction
- GLEIF data
- Geographic alignment
- Entity type analysis

### 2. Transparency Requirements
Always provide:
- Which entity was selected
- Why it was selected (scoring breakdown)
- Alternative entities considered

### 3. Industry-Specific Rules

**Financial Services**
- Prioritize regulated operating entities
- Deprioritize holding companies

**Technology**
- Parent companies often operate globally
- Consider IP licensing entities

**Retail**
- Local subsidiaries usually operate local domains
- Look for "Sales" or "Retail" in entity names

## Decision Matrix

| Scenario | Primary Signal | Confidence Modifier | Example |
|----------|---------------|-------------------|---------|
| Legal docs mention entity | Legal extraction | +30% | QIAGEN GmbH in privacy policy |
| Headquarters entity | GLEIF parent data | +25% | Apple Inc. as ultimate parent |
| Geographic match | TLD alignment | +20% | amazon.fr → Amazon France |
| Operating keywords | Entity name analysis | +10% | "Sales", "Operations", "Services" |
| Holding company | Entity name analysis | -20% | "Holdings", "Investments" |
| Inactive status | GLEIF status | -50% | Dormant or retired entities |

## Recommended Workflow

1. **Extract**: Find all mentioned entities (legal docs, copyright)
2. **Expand**: Use GLEIF to find related entities (parent/children)
3. **Score**: Apply confidence rules to each entity
4. **Select**: Choose highest scoring entity
5. **Validate**: Ensure selection makes business sense

## Success Metrics

- **Accuracy**: Correctly identifies operating entity 85%+ of time
- **Explainability**: Clear reasoning for every selection
- **Consistency**: Similar companies get similar treatment
- **Adaptability**: Rules can be tuned per industry/region

## Conclusion

Domain-to-entity mapping requires understanding both corporate structures and operational realities. By implementing these business rules and confidence scoring, we can make intelligent decisions about which legal entity actually operates a given domain, providing valuable intelligence for business analysis and decision-making.