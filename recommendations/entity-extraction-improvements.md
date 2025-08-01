# Entity Extraction Improvements: Deep Analysis & Strategy

## Executive Summary

Our QIAGEN case study revealed critical flaws in our current entity extraction approach:
- Website copyright: `© QIAGEN 2013–25` (no suffix)
- Privacy Policy: `QIAGEN GmbH` (actual operator)
- Stage 3 LLM extraction: `QIAGEN N.V.` (incorrect inference)

This document outlines three major improvements to achieve accurate domain-to-legal-entity mapping.

## 1. Legal Documents as Source of Truth

### Current Problem
- Stage 3 LLM makes intelligent inferences beyond literal text
- Copyright notices often lack legal suffixes
- Actual legal entity is buried in privacy policies/terms

### Solution: Prioritize Legal Documents
Legal entities are most reliably found in:
- **Privacy Policy** (`/privacy`, `/datenschutz`)
- **Terms & Conditions** (`/terms`, `/legal`)
- **Imprint/Impressum** (`/imprint`, `/impressum`) - Required in EU
- **About/Contact** pages

### Implementation: "Crawlee Smart" Service

```typescript
// Intelligent crawler that:
1. Fetches home page
2. Discovers legal document links
3. Extracts legal entities from each document
4. Returns structured data for entity extraction

Key Features:
- Pattern-based legal link discovery
- Multi-language support (privacy/datenschutz/confidentialité)
- Entity extraction using legal suffix patterns
- Frequency analysis to identify primary entity
```

## 2. GLEIF Parent-Child Relationships

### Current Gap
We're NOT using GLEIF's relationship data, missing:
- Ultimate parent relationships
- Direct parent relationships
- Subsidiary information

### Why This Matters
In the QIAGEN case:
- QIAGEN N.V. (Netherlands) - Ultimate parent
- QIAGEN GmbH (Germany) - Subsidiary operating the website
- Without relationships, we can't connect these entities

### Implementation Strategy

```typescript
// Enhanced GLEIF search flow:
1. Search for entity (e.g., "QIAGEN")
2. Get all matching entities
3. Fetch relationship data for each
4. Build corporate family tree
5. Match domain country to appropriate subsidiary

// API endpoints needed:
GET /api/v1/lei-records/{lei}/ultimate-parent-relationship
GET /api/v1/lei-records/{lei}/direct-parent-relationship
GET /api/v1/lei-records/{lei}/child-relationships
```

## 3. Improved Entity Extraction Logic

### Current Issues
- LLM adds suffixes based on training knowledge
- Prioritizes "correctness" over literal extraction
- No distinction between what's written vs. what's inferred

### Solution: Two-Stage Extraction

**Stage 1: Literal Extraction**
- Extract exactly what appears on the website
- No inference, no correction, just literal text
- Focus on copyright notices, legal documents

**Stage 2: GLEIF Enhancement**
- Use literal extraction as search term
- Let GLEIF provide the correct legal entity
- Use parent-child relationships to find the right subsidiary

## 4. Integration Architecture

```
Domain Input
    ↓
Crawlee Smart (Legal Docs)
    ↓
Literal Entity Extraction
    ↓
GLEIF Search (with relationships)
    ↓
Match subsidiary to domain country
    ↓
Verified Legal Entity
```

## 5. Benefits of This Approach

### Accuracy
- Legal documents are authoritative sources
- No incorrect LLM inferences
- GLEIF provides verified entity data

### Completeness
- Discovers parent companies
- Maps subsidiaries by country
- Understands corporate structures

### Efficiency
- Focused crawling (just legal pages)
- Faster than full-site dumps
- Higher signal-to-noise ratio

## 6. Example: QIAGEN Flow

1. **Crawlee Smart**: Fetches qiagen.com legal pages
2. **Finds**: "QIAGEN GmbH" in privacy policy
3. **GLEIF Search**: Finds both QIAGEN N.V. and QIAGEN GmbH
4. **Relationships**: Shows N.V. is parent of GmbH
5. **Domain Match**: .com operated from Germany → QIAGEN GmbH
6. **Result**: Correctly identifies QIAGEN GmbH as operator

## 7. Implementation Priority

1. **Phase 1**: Implement Crawlee Smart for legal document discovery
2. **Phase 2**: Add GLEIF relationship queries
3. **Phase 3**: Update entity extraction to be literal-first
4. **Phase 4**: Build subsidiary matching logic

## 8. Expected Outcomes

- **Higher Accuracy**: Legal entities from authoritative sources
- **Better Understanding**: Parent-child relationships clear
- **Reduced Errors**: No more incorrect LLM inferences
- **Actionable Intelligence**: Know exactly which entity operates each domain

## Next Steps

1. Test Crawlee Smart on diverse domains
2. Implement GLEIF relationship API calls
3. Update Stage 3 prompt for literal extraction
4. Build comprehensive testing suite