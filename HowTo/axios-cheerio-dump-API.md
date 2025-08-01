# Axios + Cheerio Dump API Documentation

## Overview
Lightning-fast static website extraction service using Axios for HTTP requests and Cheerio for HTML parsing. Optimized for extracting company names and metadata from websites with response times of 100-500ms.

## Base URL
`/api/beta/axios-cheerio`

## Endpoints

### Start Extraction
`POST /start`

Initiate a new extraction process for a domain.

**Request Body:**
```json
{
  "domain": "example.com",
  "config": {
    "timeout": 30000,        // Optional: Request timeout in ms (default: 30000)
    "followRedirects": true, // Optional: Follow HTTP redirects (default: true)
    "userAgent": "..."       // Optional: Custom user agent
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "dumpId": 123,
    "status": "started",
    "message": "Extraction started for example.com"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Domain is required",
  "code": "DOMAIN_REQUIRED"
}
```

### Get Extraction Status
`GET /status/:dumpId`

Check the current status of an extraction.

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "domain": "example.com",
    "status": "completed",
    "companyName": "Example Inc.",
    "confidence": 95,
    "extractionMethod": "meta-property",
    "processingTimeMs": 250,
    "createdAt": "2024-01-20T10:00:00Z",
    "completedAt": "2024-01-20T10:00:01Z"
  }
}
```

**Status Values:**
- `pending` - Extraction queued
- `processing` - Actively extracting
- `completed` - Successfully extracted
- `failed` - Extraction failed

### Get Full Results
`GET /results/:dumpId`

Retrieve complete extraction results including all metadata.

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "domain": "example.com",
    "status": "completed",
    "companyName": "Example Inc.",
    "extractionMethod": "meta-property",
    "confidence": 95,
    "httpStatus": 200,
    "responseTimeMs": 150,
    "htmlSizeBytes": 125000,
    "headers": {
      "content-type": "text/html; charset=utf-8",
      "server": "nginx"
    },
    "metaTags": {
      "og:site_name": "Example Inc.",
      "description": "Example company description"
    },
    "extractionStrategies": {
      "attempted": ["json-ld", "meta-property", "title-tag"],
      "candidates": [
        { "name": "Example Inc.", "source": "og:site_name", "confidence": 95 },
        { "name": "Example", "source": "title", "confidence": 70 }
      ]
    },
    "pageMetadata": {
      "title": "Example Inc. - Home",
      "hasStructuredData": true,
      "language": "en"
    },
    "processingTimeMs": 250,
    "createdAt": "2024-01-20T10:00:00Z",
    "completedAt": "2024-01-20T10:00:01Z"
  }
}
```

### Get Recent Dumps
`GET /recent?limit=20`

List recent extraction dumps.

**Query Parameters:**
- `limit` - Number of results to return (default: 20, max: 100)

**Success Response:**
```json
{
  "success": true,
  "data": {
    "dumps": [
      {
        "id": 123,
        "domain": "example.com",
        "status": "completed",
        "companyName": "Example Inc.",
        "confidence": 95,
        "extractionMethod": "meta-property",
        "processingTimeMs": 250,
        "createdAt": "2024-01-20T10:00:00Z"
      }
    ]
  }
}
```

### Download Raw HTML
`GET /download/:dumpId`

Download the raw HTML content captured during extraction.

**Success Response:**
- Content-Type: `text/html`
- Content-Disposition: `attachment; filename="example.com_123.html"`
- Body: Raw HTML content

**Error Response:**
```json
{
  "success": false,
  "error": "Dump not found or no HTML available",
  "code": "NOT_FOUND"
}
```

### Health Check
`GET /health`

Check service health status.

**Success Response:**
```json
{
  "service": "Axios+Cheerio Dump",
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-20T10:30:00Z",
  "uptime": 3600,
  "checks": {
    "database": "healthy"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `DOMAIN_REQUIRED` | Domain parameter is missing |
| `INVALID_ID` | Dump ID is invalid or malformed |
| `NOT_FOUND` | Requested dump not found |
| `EXTRACTION_FAILED` | Failed to extract data from domain |
| `TIMEOUT_ERROR` | Request timed out |
| `CONNECTION_ERROR` | Failed to connect to domain |

## Extraction Methods

The service attempts multiple extraction strategies in order:

1. **JSON-LD Structured Data** - Highest confidence
2. **Meta Properties** (og:site_name, etc.) - High confidence
3. **Title Tag Analysis** - Medium confidence
4. **Footer Copyright** - Lower confidence
5. **H1 Headers** - Lowest confidence

## Rate Limits

- No hard rate limits currently enforced
- Recommended: Max 10 concurrent extractions per client
- Timeout: 30 seconds per extraction

## Notes

- Only extracts from the homepage/root URL
- Follows up to 5 redirects by default
- Handles both HTTP and HTTPS
- Automatically detects and handles character encodings
- Strips tracking parameters from URLs