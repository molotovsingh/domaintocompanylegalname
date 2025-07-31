# Beta V2 Service Conventions

## Overview
These are **voluntary guidelines** for Beta V2 federated services. Services may adopt these patterns to improve consistency and developer experience while maintaining complete independence.

## API Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { ... } // Optional additional context
}
```

### Common Error Codes
- `DOMAIN_REQUIRED` - Domain parameter is missing
- `INVALID_ID` - ID parameter is invalid or malformed
- `NOT_FOUND` - Resource not found
- `PROCESSING_ERROR` - Error during processing
- `VALIDATION_ERROR` - Input validation failed
- `TIMEOUT_ERROR` - Operation timed out

## Status Values

Standard status progression for async operations:
- `pending` - Operation queued but not started
- `processing` - Operation actively running
- `completed` - Operation finished successfully
- `failed` - Operation failed with error
- `cancelled` - Operation cancelled by user/system

## Logging Patterns

### Format
```
[Beta v2] [ServiceName] [Component] message
```

### Examples
```
[Beta v2] [Axios+Cheerio] [Routes] Starting extraction for example.com
[Beta v2] [Crawlee] [Storage] Database connection established
[Beta v2] [Playwright] [Service] Browser initialized
```

### Log Levels
- `ERROR` - Critical issues requiring attention
- `WARN` - Important warnings but not failures
- `INFO` - General informational messages
- `DEBUG` - Detailed debugging information

## Health Check Endpoint

### Path: `/health`

### Response Format
```json
{
  "service": "Service Name",
  "status": "healthy", // healthy | degraded | unhealthy
  "version": "1.0.0",
  "timestamp": "2024-01-20T10:30:00Z",
  "uptime": 3600, // seconds
  "checks": { // Optional detailed checks
    "database": "healthy",
    "external_api": "healthy"
  }
}
```

## Metrics Endpoint

### Path: `/metrics`

### Response Format
```json
{
  "service": "Service Name",
  "timestamp": "2024-01-20T10:30:00Z",
  "requests": {
    "total": 1000,
    "successful": 950,
    "failed": 50,
    "pending": 5
  },
  "performance": {
    "averageProcessingTimeMs": 2500,
    "p95ProcessingTimeMs": 5000,
    "lastProcessedAt": "2024-01-20T10:29:00Z"
  },
  "resources": { // Optional
    "memoryUsageMB": 256,
    "activeConnections": 10
  }
}
```

## Configuration File Structure

### Location: `[service-name]/config.ts`

### Example Structure
```typescript
export const SERVICE_CONFIG = {
  // Service identification
  serviceName: 'Axios+Cheerio',
  version: '1.0.0',
  
  // Processing settings
  timeout: parseInt(process.env.AXIOS_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  
  // Feature flags
  features: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableDebugLogging: process.env.DEBUG === 'true'
  },
  
  // External services
  external: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    apiUrl: process.env.API_URL || 'https://api.example.com'
  }
};
```

## API Documentation Structure

### Location: `[service-name]/API.md`

### Template
```markdown
# [Service Name] API Documentation

## Overview
Brief description of what this service does.

## Base URL
`/api/beta/[service-name]`

## Endpoints

### Start Extraction
`POST /start`

Start a new extraction process.

**Request Body:**
```json
{
  "domain": "example.com",
  "config": { ... } // Optional configuration
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "status": "processing"
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

### Get Status
`GET /status/:id`

...additional endpoints...
```

## Database Naming Conventions

### Table Names
- Use service prefix: `[service]_[entity]`
- Examples: `axios_cheerio_dumps`, `crawlee_dumps`

### Column Names
- Use snake_case
- Timestamps: `created_at`, `updated_at`, `completed_at`
- Status fields: `status`, `error_message`
- Metrics: `processing_time_ms`, `response_time_ms`

## Environment Variables

### Naming Pattern
- Service prefix: `[SERVICE]_[VARIABLE]`
- Examples:
  - `AXIOS_CHEERIO_TIMEOUT`
  - `CRAWLEE_MAX_PAGES`
  - `PLAYWRIGHT_HEADLESS`

### Common Variables
- `[SERVICE]_ENABLED` - Enable/disable service
- `[SERVICE]_DEBUG` - Enable debug logging
- `[SERVICE]_TIMEOUT` - Operation timeout
- `[SERVICE]_MAX_RETRIES` - Retry attempts

## Testing Patterns

### Unit Tests
- Location: `[service-name]/__tests__/`
- One test file per module
- Mock external dependencies

### Integration Tests
- Test against real database
- Use test-specific tables/data
- Clean up after tests

## Notes

- These are **guidelines**, not requirements
- Services can deviate based on specific needs
- Focus on what improves developer experience
- Maintain backwards compatibility when adopting