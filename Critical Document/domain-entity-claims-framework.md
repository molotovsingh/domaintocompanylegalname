# Domain-to-Entity Claims Framework: Embracing the Range of Truth

## Core Philosophy

**The Truth is a Range, Not a Point**

When mapping a domain like qiagen.com to legal entities, there isn't one "correct" answer. Instead, there's a range of valid entities, each with legitimate claims to being associated with the domain. The "best" answer depends on the user's specific business needs and biases.

## Understanding Entity Claims

### What is a Claim?
A claim is a reasoned argument for why a particular legal entity should be associated with a domain. Each claim includes:
- The entity itself
- Evidence supporting the association
- The type of relationship
- Contextual information

### Example: QIAGEN Domain Claims

For `https://www.qiagen.com/`, legitimate claims include:

**Claim 1: QIAGEN GmbH**
- Evidence: Listed in privacy policy as data controller
- Relationship: Direct operator of the website
- Context: German subsidiary, handles European operations

**Claim 2: QIAGEN N.V.**
- Evidence: Ultimate parent company, owns all subsidiaries
- Relationship: Corporate parent, strategic control
- Context: Dutch holding company, publicly traded

**Claim 3: QIAGEN Inc.**
- Evidence: Major operating subsidiary
- Relationship: US operations arm
- Context: Handles North American business

**Claim 4: QIAGEN Sciences LLC**
- Evidence: Intellectual property holder
- Relationship: Owns patents/trademarks
- Context: Licensing entity

## The Role of User Bias

Different users have different priorities:

### Bias Type 1: "Show me the money holder"
- Prioritizes ultimate parent companies
- Wants to know who controls the capital
- QIAGEN N.V. would score highest

### Bias Type 2: "Show me who I'm dealing with"
- Prioritizes operational entities
- Wants to know who runs the website
- QIAGEN GmbH would score highest

### Bias Type 3: "Show me the local entity"
- Prioritizes geographic alignment
- Wants jurisdiction-specific entities
- QIAGEN Inc. for US users, QIAGEN GmbH for EU users

### Bias Type 4: "Show me the IP owner"
- Prioritizes intellectual property holders
- Wants to know who owns the technology
- QIAGEN Sciences LLC might score highest

## Data Collection Strategy

### 1. Cast a Wide Net
Don't filter prematurely. Collect:
- All entities mentioned on the website
- All entities from GLEIF searches
- Parent companies from GLEIF relationships
- Subsidiaries from GLEIF relationships
- Entities from legal documents

### 2. Build Complete Claims
For each entity, gather:
- **Direct Evidence**: Where it appears on the website
- **Structural Evidence**: Its role in corporate hierarchy
- **Geographic Evidence**: Location alignment with domain
- **Operational Evidence**: Business activities
- **Legal Evidence**: Registrations, licenses

### 3. Present Full Picture
Instead of picking winners, present all viable claims:
```json
{
  "domain": "qiagen.com",
  "claims": [
    {
      "entity": "QIAGEN N.V.",
      "lei": "724500IIPAGMV5N1H542",
      "claim_type": "ultimate_parent",
      "evidence": {
        "gleif_parent": true,
        "publicly_traded": "NYSE: QGEN",
        "headquarters": "Netherlands",
        "mentioned_in_annual_report": true
      },
      "strength": "Strong claim as ultimate controlling entity"
    },
    {
      "entity": "QIAGEN GmbH",
      "lei": "391200JETBDY4MTQPS73",
      "claim_type": "website_operator",
      "evidence": {
        "privacy_policy_mention": true,
        "domain_registration": "possible",
        "location": "Germany",
        "operational_subsidiary": true
      },
      "strength": "Strong claim as direct website operator"
    }
  ]
}
```

## LLM Arbitration Framework

### Stage 1: Claim Generation
- Collect all possible entities
- Build evidence for each
- No filtering or scoring yet

### Stage 2: Claim Presentation
Present all claims with:
- Entity details
- Evidence summary
- Relationship type
- No bias applied

### Stage 3: Biased Arbitration
LLM applies user-specified bias:
```
User Bias: "I want ultimate parent companies for M&A research"
Result: QIAGEN N.V. scores 95%, QIAGEN GmbH scores 60%

User Bias: "I need operational entities for contract negotiations"
Result: QIAGEN GmbH scores 90%, QIAGEN N.V. scores 50%
```

## Business Value of Multiple Claims

### 1. Flexibility
Different use cases need different entities:
- M&A research → Parent companies
- Compliance → Operating entities
- IP licensing → IP holding entities
- Tax analysis → Domicile entities

### 2. Transparency
Showing all claims allows users to:
- Understand corporate structure
- Make informed decisions
- Spot potential issues

### 3. Accuracy
Multiple claims prevent false precision:
- Acknowledges corporate complexity
- Reduces incorrect mappings
- Provides richer intelligence

## Implementation Principles

### Don't Rush to Judgment
- Collect comprehensively
- Present objectively
- Let bias guide selection

### Embrace Ambiguity
- Multiple valid answers exist
- Truth depends on perspective
- Confidence is contextual

### Provide Rich Context
Each claim needs:
- Clear evidence
- Relationship type
- Business context
- Limitations

## Example: Large Corporation Complexity

For `microsoft.com`, valid claims might include:
1. Microsoft Corporation (Parent)
2. Microsoft Ireland Operations Limited (EMEA Hub)
3. Microsoft Technology Licensing, LLC (IP Holder)
4. Microsoft Global Sales (Sales Entity)
5. Microsoft Azure (Cloud Division)

Each serves different business intelligence needs.

## Success Metrics

- **Completeness**: Are all reasonable claims presented?
- **Evidence Quality**: Is each claim well-supported?
- **Flexibility**: Can different biases be applied effectively?
- **Transparency**: Is the reasoning clear?

## Conclusion

Domain-to-entity mapping isn't about finding "the answer" – it's about presenting a range of valid claims and letting user bias determine which matters most for their specific use case. This approach acknowledges corporate complexity while providing actionable intelligence.