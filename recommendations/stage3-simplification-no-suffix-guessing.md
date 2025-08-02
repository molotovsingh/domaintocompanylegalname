# Stage 3 Simplification: No Suffix Guessing
Date: August 2, 2025

## Issue Identified

The current Stage 3 entity extraction is reducing GLEIF matching success by being too specific. Example:
- Domain: evotec.com
- Stage 3 extracts: "Evotec AG" (guessing the suffix)
- GLEIF search: Finds 0 results
- Reality: GLEIF has 7 Evotec entities, including "Evotec SE" (the actual parent)

## Root Cause

Stage 3 is violating the core principle from the claims framework:
> **"Cast a Wide Net - Don't filter prematurely"**

By adding suffixes like "AG", Stage 3 is:
1. Making assumptions that may be wrong
2. Narrowing the search prematurely
3. Missing valid entities with different suffixes
4. Contradicting the 1-to-many mapping philosophy

## Current Problem Code

In `crawleeSmartService.ts`, there's pattern matching that extracts entities WITH suffixes:
```typescript
// Extracts "Company AG" instead of just "Company"
/\b[\w\s&-]+\s+AG\b/gi
```

In the LLM prompts, models are asked to:
```
"legalEntity": "Full legal entity name with suffix (Inc., LLC, Ltd., etc.)"
```

## Proposed Solution

### Stage 3 Should Only Extract Base Names

**Current Approach (Wrong)**:
```
Input: Website content for evotec.com
Stage 3 Output: "Evotec AG"
GLEIF Search: "Evotec AG" → 0 results
```

**Proposed Approach (Correct)**:
```
Input: Website content for evotec.com
Stage 3 Output: "Evotec"
GLEIF Search: "Evotec" → 7 results
Present all as claims: SE, International GmbH, France SAS, etc.
```

### Updated LLM Prompt for Stage 3

```
Extract the BASE company name WITHOUT guessing legal suffixes.

CRITICAL: Do NOT add suffixes like Inc., Corp., Ltd., GmbH, AG, etc.
If the website says "Apple Inc.", extract just "Apple"
If the website says "Siemens AG", extract just "Siemens"

Why? We will search GLEIF with the base name to find ALL possible entities.
Adding a suffix prematurely may cause us to miss the correct entities.

Return:
{
  "baseName": "Company name without suffix",
  "mentionedSuffixes": ["Any suffixes found on the website"],
  "confidence": 0.0-1.0
}
```

### GLEIF Search Strategy Update

With base name only, GLEIF search becomes more effective:

```typescript
// Stage 1: Base name search
searchTerm = "Evotec"  // No suffix!
// Returns: Evotec SE, Evotec International GmbH, etc.

// Stage 2: Apply jurisdiction filtering
// If Germany detected, prioritize DE entities

// Stage 3: Present all as claims
// Let user bias determine which is most relevant
```

## Benefits

1. **Higher Match Rate**: Base name searches find more entities
2. **True to Philosophy**: Aligns with "cast a wide net" principle
3. **Multiple Claims**: Presents all valid options to the user
4. **No Wrong Guesses**: Avoids incorrect suffix assumptions
5. **Jurisdiction Intelligence**: Can still apply jurisdiction filtering after getting all results

## Implementation Changes

### 1. Update Entity Extraction Service
Remove suffix-adding logic from Stage 3. Extract only base names.

### 2. Update GLEIF Search
Already searches with whatever Stage 3 provides - no changes needed.

### 3. Update Processing Pipeline
Ensure Stage 3 confidence is based on base name extraction quality, not suffix guessing.

### 4. Update Results Presentation
Show all GLEIF results as separate claims with their actual legal suffixes.

## Example: Evotec Case Study

**Before (Current System)**:
- Extracted: "Evotec AG"
- GLEIF Results: 0
- User Gets: No data

**After (Proposed System)**:
- Extracted: "Evotec"
- GLEIF Results: 7 entities
- User Gets:
  - Claim 1: Evotec SE (Germany) - Parent company
  - Claim 2: Evotec International GmbH (Germany) - Subsidiary
  - Claim 3: Evotec (France) S.A.S - French operations
  - ... and 4 more claims

## Conclusion

Stage 3's job is to extract the company name, not to guess its legal structure. By removing suffix guessing, we:
- Increase GLEIF match rates dramatically
- Stay true to the claims-based philosophy
- Present users with the full range of valid entities
- Let GLEIF (the authoritative source) provide the correct suffixes

This is a simple change with significant impact on accuracy and completeness.