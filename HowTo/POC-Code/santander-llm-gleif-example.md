# Santander LLM-GLEIF Selection Example

## Complete Data Flow with LLM Integration

```
1. DUMP → 2. CLEAN → 3. EXTRACT → 4. GLEIF API → 5. LLM SELECTION → 6. VALIDATION → 7. RESULTS
```

## Detailed Flow Example: `santander.com`

### 1️⃣ DUMP (Crawlee collects)
```
Raw HTML: 189KB
Screenshots: captured
Metadata: collected
```

### 2️⃣ CLEAN
```
Remove scripts/styles → Extract text → Normalize content
Output: Clean text with addresses, phones, currencies preserved
```

### 3️⃣ EXTRACT (Pattern-based)
```
Find: "Santander" + legal suffixes
Extract geo markers:
- Phones: ["+34 91 257 3000", "+44 800 9123 123", "+1 877 768 2265"]
- Addresses: ["Madrid, Spain", "London, UK", "Boston, USA"]
- Currencies: ["EUR", "GBP", "USD"]
```

### 4️⃣ GLEIF API
```
Search: "Santander"
Returns 4 entities:
- Banco Santander S.A. (Spain)
- Santander UK plc (UK)
- Santander Bank, N.A. (USA)
- Banco Santander Brasil S.A. (Brazil)
```

### 5️⃣ LLM SELECTION (NEW!)
```
Input to LLM:
- 4 GLEIF candidates
- Geographic markers from website
- Domain context

LLM analyzes:
"Primary phone is Spanish (+34), headquarters in Madrid,
EUR is main currency, Spanish language dominant"

LLM output:
"Select: Banco Santander S.A. (Spain) - Parent company"
```

### 6️⃣ VALIDATION
```
Confidence: 98% (LLM-verified match)
Category: GLEIF Verified - High Priority
```

### 7️⃣ RESULTS
```
Company: Banco Santander S.A.
LEI: 5493006QMFDDMYWIAM13
Jurisdiction: Spain
Method: LLM-enhanced GLEIF selection
```

## Decision Logic

```javascript
if (gleifCandidates.length === 1) {
  // Single match - use directly
  return gleifCandidates[0];
} else if (gleifCandidates.length > 1) {
  // Multiple matches - use LLM
  return llmSelectBestMatch(gleifCandidates, geoMarkers);
} else {
  // No GLEIF match - fall back to extraction
  return extractedEntity;
}
```

## Key Insight
This approach uses LLM intelligence exactly where it adds most value - resolving ambiguity when multiple valid entities exist. The LLM acts as an intelligent arbitrator using geographic and contextual evidence from the website to select the correct legal entity from multiple GLEIF candidates.