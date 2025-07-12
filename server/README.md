
# Server - Backend Express.js Application

**Created:** July 12, 2025 at 2:52 AM UTC  
**Last Updated:** July 12, 2025 at 2:52 AM UTC

## Purpose
This folder contains the complete backend Express.js server that powers the Domain Intelligence Platform. It provides RESTful APIs, database management, and orchestrates all domain processing workflows.

## Server Architecture

### **Core Server Files**
- **`index.ts`** - Main Express.js application entry point
  - Port 5000 production server with comprehensive middleware
  - API route mounting and error handling
  - Database connection management
  - Beta server initialization and health monitoring

- **`betaIndex.ts`** - Isolated beta testing server (Port 3001)
  - Complete database isolation from production
  - Experimental feature testing environment
  - Standalone extraction method validation
  - Independent API endpoints for beta features

### **Database Layer**
- **`db.ts`** - Drizzle ORM configuration for PostgreSQL
- **`pgStorage.ts`** - Production data access layer with business logic
- **`betaDb.ts`** - Beta database configuration with isolated schema
- **`storage.ts`** - Legacy storage interface (deprecated)

### **API Routes**
- **`routes.ts`** - Primary production API endpoints
  - Batch management and domain processing
  - Results retrieval with filtering and pagination
  - Statistics and analytics endpoints
  - File upload and processing triggers

- **`routes-smoke-test.ts`** - Dedicated smoke testing endpoints
- **`routes-knowledge-graph.ts`** - GLEIF knowledge graph visualization
- **`routes-wide.ts`** - Wide format data export endpoints
- **`routes-normalized.ts`** - Normalized data structure endpoints
- **`routes-changes.ts`** - Code change tracking and history

### **Vite Integration**
- **`vite.ts`** - Vite development server integration for React frontend

## Service Architecture

### **Core Services (`/services/`)**
The `/services/` directory contains all business logic services with clear separation of concerns:

#### Processing Pipeline
```
fileProcessor → processor → domainExtractor → gleifService → enhancedExportService
```

#### Quality Assurance
```
smokeTestService → gleifValidationService → batchLogger
```

#### Recovery & Monitoring
```
batch-recovery → changeLogger → gleifUpdateService
```

## Database Strategy

### **Production Database**
- **Schema**: `shared/schema.ts` with Drizzle ORM
- **Migrations**: `/migrations/` directory with versioned SQL
- **Storage**: PostgreSQL with optimized queries for domain intelligence

### **Beta Database Isolation**
- **Complete Separation**: Independent schema and connection
- **Schema**: `shared/betaSchema.ts` for experimental features
- **Purpose**: Risk-free testing of new extraction methods

## API Architecture

### **RESTful Design**
- **GET /api/batches** - Retrieve processing batches
- **POST /api/upload** - File upload and batch creation
- **GET /api/results/:batchId** - Domain results with filtering
- **GET /api/stats** - Platform statistics and metrics

### **Beta Testing Endpoints**
- **GET /api/beta/health** - Beta server health check
- **POST /api/beta/test-extraction** - Isolated extraction testing
- **GET /api/beta/methods** - Available extraction methods

## Server Configuration

### **Port Management**
- **Production Server**: Port 5000 (automatically forwarded to 80/443)
- **Beta Server**: Port 3001 (isolated testing environment)
- **Development**: Hot reload with Vite integration

### **Environment Variables**
- **DATABASE_URL**: PostgreSQL connection string
- **GLEIF_API_KEY**: GLEIF API authentication (managed via Secrets)
- **NODE_ENV**: Environment detection (development/production)

### **CORS & Security**
- **CORS**: Configured for frontend integration
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Comprehensive request sanitization
- **Error Handling**: Structured error responses with logging

## Development Workflow

### **Starting the Server**
```bash
npm run dev  # Starts both production and beta servers
```

### **Server Health Monitoring**
- **Production**: Automatic health checks on startup
- **Beta**: Independent health verification
- **Database**: Connection validation and retry logic

### **Development Features**
- **Hot Reload**: Automatic server restart on file changes
- **TypeScript**: Full type safety with TSX compilation
- **Logging**: Structured logging with timestamps and context

## Beta Testing Integration

### **Isolated Architecture**
- **Separate Database**: Complete isolation from production data
- **Independent Server**: Port 3001 with own Express instance
- **Method Testing**: Standalone extraction method validation

### **Testing Capabilities**
- **Axios + Cheerio**: Fast HTML parsing extraction
- **Puppeteer**: JavaScript-rendered content extraction
- **Playwright**: Advanced browser automation
- **Perplexity**: AI-powered company name identification
- **GLEIF**: Legal entity identifier validation

## Performance Characteristics

### **Concurrent Processing**
- **Batch Limits**: 3 concurrent domains for optimal performance
- **Timeout Management**: Configurable timeouts per extraction method
- **Circuit Breakers**: Automatic failure protection

### **Database Optimization**
- **Connection Pooling**: Efficient PostgreSQL connection management
- **Query Optimization**: Indexed searches and optimized joins
- **Batch Operations**: Bulk insert/update operations

### **Memory Management**
- **Cleanup**: Automatic resource cleanup after processing
- **Monitoring**: Memory usage tracking and optimization
- **Scaling**: Horizontal scaling preparation

## Error Handling Strategy

### **Structured Error Responses**
- **HTTP Status Codes**: Proper REST API status codes
- **Error Context**: Detailed error information for debugging
- **User-Friendly Messages**: Clear error messages for frontend

### **Logging Strategy**
- **Request Logging**: Complete API request/response logging
- **Error Tracking**: Comprehensive error capture and analysis
- **Performance Monitoring**: Response time and resource usage tracking

### **Recovery Mechanisms**
- **Automatic Retry**: Intelligent retry logic for transient failures
- **Circuit Breakers**: Prevent cascade failures
- **Graceful Degradation**: Partial functionality during issues

## Security Considerations

### **Input Validation**
- **File Upload**: Size limits and type validation
- **API Parameters**: Comprehensive input sanitization
- **SQL Injection**: Parameterized queries via Drizzle ORM

### **Authentication Strategy**
- **API Keys**: Secure GLEIF API key management
- **Rate Limiting**: Request throttling and abuse prevention
- **CORS Policy**: Restricted cross-origin access

## Deployment Readiness

### **Production Configuration**
- **Environment Detection**: Automatic production/development switching
- **Port Binding**: 0.0.0.0 binding for Replit deployment
- **Health Checks**: Comprehensive startup validation

### **Monitoring Integration**
- **Analytics**: Built-in processing analytics and reporting
- **Health Endpoints**: Server status and diagnostic endpoints
- **Performance Metrics**: Response time and throughput monitoring

This server architecture provides enterprise-grade reliability with comprehensive domain intelligence capabilities, designed for scalable deployment on Replit's infrastructure.
