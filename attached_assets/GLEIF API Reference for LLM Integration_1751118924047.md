<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# GLEIF API Reference for LLM Integration

## **API Specification**

- **Type**: Public REST API, JSON:API compliant
- **Authentication**: None required
- **Cost**: Free
- **Base URL**: `https://api.gleif.org/api/v1`
- **Primary Endpoint**: `/lei-records`
- **Response Format**: JSON with `data`, `attributes`, `relationships` structure


## **Core Search Parameters**

### **Entity Search Filters**

```
filter[entity.legalName] = "Company Name"
filter[entity.legalName] = "*Partial*"  // Wildcard search
filter[entity.status] = "ACTIVE|INACTIVE"
filter[entity.legalAddress.country] = "US"
filter[bic] = "BIC11CODE"
filter[isin] = "ISINCODE"
```


### **Pagination \& Limits**

```
page[size] = 1-200 (default: 10)
page[number] = 1+ (default: 1)
```


## **Request Headers**

```
Accept: application/vnd.api+json
User-Agent: [Optional but recommended]
```


## **Response Data Schema**

### **Primary Entity Fields**

```json
{
  "data": [{
    "id": "LEI_CODE_20_CHARS",
    "attributes": {
      "lei": "LEI_CODE",
      "entity": {
        "legalName": {"name": "string", "language": "ISO_LANG"},
        "otherNames": [{"name": "string", "type": "string"}],
        "legalAddress": {
          "firstAddressLine": "string",
          "city": "string", 
          "country": "ISO_COUNTRY",
          "postalCode": "string"
        },
        "headquartersAddress": {...},
        "status": "ACTIVE|INACTIVE",
        "legalForm": {"id": "string"},
        "jurisdiction": "ISO_COUNTRY",
        "category": "BRANCH|FUND|GENERAL|etc",
        "creationDate": "YYYY-MM-DD"
      },
      "registration": {
        "registrationStatus": "ISSUED|LAPSED|MERGED|RETIRED",
        "initialRegistrationDate": "YYYY-MM-DD",
        "lastUpdateDate": "YYYY-MM-DD",
        "managingLOU": "LOU_CODE"
      }
    }
  }]
}
```


## **Search Strategy Logic**

### **Progressive Search Pattern**

1. **Exact Match**: `filter[entity.legalName]=Apple Inc`
2. **Partial Match**: `filter[entity.legalName]=*Apple*`
3. **Alternative ID**: `filter[bic]=AAPL` (if available)
4. **Fuzzy Logic**: Remove suffixes (Inc, Ltd, Corp) and retry

### **Input Preprocessing**

- Normalize: Remove common legal suffixes
- Sanitize: Handle special characters
- Validate: Check input length and format


## **Error Handling Patterns**

### **HTTP Status Codes**

- `200`: Success with data
- `400`: Invalid filter parameters
- `404`: No results found
- `429`: Rate limited (rare)
- `500`: Server error


### **Response Validation**

```python
if response.status_code == 200:
    data = response.json()
    if data.get('data'):
        # Process results
    else:
        # No matches found
```


## **LLM Integration Patterns**

### **Entity Enrichment Function**

```python
def gleif_enrich(entity_name: str) -> dict:
    """
    Standard GLEIF enrichment for LLM workflows
    Returns: {lei, legal_name, status, country, addresses}
    """
    url = "https://api.gleif.org/api/v1/lei-records"
    params = {'filter[entity.legalName]': entity_name, 'page[size]': 5}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json().get('data', [])
            return format_for_llm(data)
    except:
        return {'error': 'API_UNAVAILABLE'}
```


### **Batch Processing Pattern**

```python
def batch_gleif_lookup(entities: list) -> list:
    """Process multiple entities with rate limiting"""
    results = []
    for entity in entities:
        result = gleif_enrich(entity)
        results.append(result)
        time.sleep(0.1)  # Courtesy delay
    return results
```


## **Data Quality Indicators**

### **Reliability Scores**

- **ACTIVE + ISSUED**: High confidence (90%+)
- **ACTIVE + LAPSED**: Medium confidence (70%)
- **INACTIVE**: Low confidence (30%)


### **Match Quality Assessment**

- **Exact legal name match**: 95% confidence
- **Partial name match**: 70-85% confidence
- **Fuzzy match**: 50-70% confidence


## **LLM Prompt Integration**

### **Entity Verification Prompt**

```
Given company name: "{input_name}"
GLEIF API returned: {api_response}
Confidence: {match_confidence}%
Verified Legal Name: {legal_name}
LEI: {lei_code}
Status: {status}
```


### **Corporate Structure Prompt**

```
Entity: {legal_name}
LEI: {lei_code}
Jurisdiction: {jurisdiction}
Legal Form: {legal_form}
Addresses: {formatted_addresses}
```


## **Performance Characteristics**

- **Response Time**: 100-500ms typical
- **Availability**: 99.9%+
- **Rate Limits**: None explicitly documented
- **Concurrent Requests**: Recommended < 10/second


## **Integration Constraints**

### **What GLEIF Provides**

- Legal entity identification
- Official names and addresses
- Corporate structure relationships
- Registration status and dates


### **What GLEIF Does NOT Provide**

- Domain names or websites
- Email addresses or phone numbers
- Financial performance data
- Industry classifications
- Employee counts


## **LLM Use Case Patterns**

### **Entity Disambiguation**

When user mentions "Apple" → GLEIF confirms "Apple Inc." (LEI: HWUPKR0MPOU8FGXBT394)

### **Compliance Verification**

Check if entity has valid LEI for regulatory requirements

### **Corporate Relationship Mapping**

Identify parent-subsidiary relationships through Level 2 data

### **Data Quality Enhancement**

Standardize entity names using official GLEIF legal names

## **Implementation Checklist**

- [ ] Handle empty results gracefully
- [ ] Implement timeout handling (10s recommended)
- [ ] Cache frequent lookups
- [ ] Log API calls for debugging
- [ ] Validate LEI format (20 alphanumeric characters)
- [ ] Handle special characters in entity names
- [ ] Implement fallback search strategies

This reference enables LLMs to effectively integrate GLEIF API calls for entity enrichment, verification, and corporate structure analysis within conversational workflows.

