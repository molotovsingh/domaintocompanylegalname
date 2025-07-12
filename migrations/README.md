# Migrations - Database Schema Evolution

**Created:** July 12, 2025 at 2:52 AM UTC  
**Last Updated:** July 12, 2025 at 2:52 AM UTC

## Purpose
This folder contains all database migrations that define and evolve the PostgreSQL schema for the Domain Intelligence Platform. Migrations ensure database consistency across development, testing, and production environments.

## Migration System

### **Drizzle ORM Integration**
- **Configuration**: `drizzle.config.ts` in project root
- **Schema Source**: `shared/schema.ts` for production tables
- **Beta Schema**: `shared/betaSchema.ts` for beta testing isolation
- **Migration Generation**: `npx drizzle-kit generate`
- **Migration Application**: `npx drizzle-kit migrate`

### **Migration Naming Convention**
```
NNNN_descriptive_migration_name.sql
```
- **NNNN**: 4-digit sequential number (0000, 0001, 0002, etc.)
- **descriptive_name**: Clear description of what the migration does
- **SQL Extension**: All migrations are raw SQL for maximum control

## Current Migration History

### **0000_secret_purple_man.sql** - Initial Schema
- **Purpose**: Foundation database schema creation
- **Tables Created**: Core domain processing tables
- **Features**: Basic batch processing and domain extraction storage
- **Date**: Project initialization

### **0001_add_entity_category_columns.sql** - Entity Intelligence Enhancement
- **Purpose**: Add business intelligence classification capabilities
- **Columns Added**: 
  - `entityCategory` - Primary business category prediction
  - `categoryConfidence` - Confidence score for category classification
  - `alternativeCategories` - JSON array of alternative category possibilities
- **Impact**: Enables automated business intelligence and industry classification
- **Business Value**: Allows filtering and analysis by industry sector

### **0002_create_beta_tables.sql** - Beta Testing Infrastructure
- **Purpose**: Establish isolated beta testing environment
- **Tables Created**: 
  - `beta_smoke_tests` - Comprehensive method comparison results
  - `beta_extraction_methods` - Available extraction method registry
- **Isolation Strategy**: Complete separation from production data
- **Testing Capabilities**: Multi-method extraction comparison and validation

### **0003_enhance_beta_smoke_tests.sql** - Beta Testing Enhancement
- **Purpose**: Expand beta testing capabilities with detailed analysis
- **Enhancements**:
  - Extended result storage for comprehensive analysis
  - Performance metrics tracking
  - Error categorization and technical details
  - Method-specific extraction metadata
- **Analytics Ready**: Structured for AI-powered analysis and optimization

### **0004_rebuild_beta_tables.sql** - Beta Architecture Simplification
- **Purpose**: Align beta tables with simplified standalone architecture
- **Changes**:
  - Streamlined beta_smoke_tests schema
  - Optimized for standalone script integration
  - Enhanced method comparison capabilities
  - Improved data consistency and performance

## Schema Architecture Patterns

### **Production Tables** (`shared/schema.ts`)
```typescript
// Core processing tables
batches           // File upload and batch management
domains           // Domain extraction results with GLEIF enhancement
gleif_entities    // GLEIF legal entity intelligence cache
gleif_knowledge   // Cross-domain entity relationship knowledge
code_changes      // Development change tracking
```

### **Beta Testing Tables** (`shared/betaSchema.ts`)
```typescript
// Isolated testing environment
beta_smoke_tests        // Multi-method extraction comparison
beta_extraction_methods // Available method registry
```

### **Key Design Principles**
1. **Complete Isolation**: Beta tables use separate database connection
2. **Rich Metadata**: Comprehensive tracking for analysis and optimization
3. **JSON Flexibility**: Complex data structures stored as JSON for adaptability
4. **Performance Optimization**: Indexed columns for fast querying
5. **Audit Trail**: Timestamp tracking for all data changes

## Migration Development Workflow

### **Creating New Migrations**
1. **Update Schema**: Modify `shared/schema.ts` or `shared/betaSchema.ts`
2. **Generate Migration**: `npx drizzle-kit generate`
3. **Review SQL**: Examine generated migration for correctness
4. **Test Migration**: Apply to development environment
5. **Document Changes**: Update this README with migration details

### **Schema Modification Guidelines**
- **Never Modify**: Existing migrations once applied
- **Always Add**: New migrations for schema changes
- **Column Additions**: Use nullable columns or provide defaults
- **Data Migration**: Include data transformation in migration SQL
- **Rollback Strategy**: Consider reversibility for complex changes

## Database Connection Strategy

### **Production Database**
- **Connection**: `DATABASE_URL` environment variable
- **Pool Management**: Drizzle ORM connection pooling
- **Performance**: Optimized for concurrent domain processing
- **Backup Strategy**: Replit automated backups

### **Beta Database**
- **Connection**: `BETA_DATABASE_URL` environment variable (if different)
- **Isolation**: Complete separation from production data
- **Purpose**: Risk-free testing of new extraction methods
- **Data Retention**: Preserved between sessions for analysis

## Performance Considerations

### **Indexing Strategy**
- **Primary Keys**: Automatic clustering for fast lookups
- **Foreign Keys**: Indexed for join performance
- **Query Patterns**: Indexes aligned with common query patterns
- **Batch Processing**: Optimized for bulk operations

### **Data Types**
- **JSON Columns**: Flexible storage for complex metadata
- **VARCHAR Limits**: Reasonable limits to prevent abuse
- **Timestamps**: UTC timestamps for global consistency
- **Boolean Flags**: Efficient filtering and categorization

### **Query Optimization**
- **Batch Filtering**: Efficient batch-based queries
- **Status Indexing**: Fast filtering by processing status
- **Confidence Sorting**: Optimized for confidence-based ordering
- **Date Ranges**: Efficient time-based filtering

## Data Integrity and Validation

### **Constraints**
- **Primary Keys**: Unique identification for all records
- **Foreign Keys**: Referential integrity between related tables
- **Check Constraints**: Data validation at database level
- **Not Null**: Required fields enforced at schema level

### **Data Quality**
- **Domain Validation**: Proper domain format enforcement
- **Confidence Ranges**: Score validation (0-100)
- **Status Enums**: Controlled vocabulary for status fields
- **JSON Schema**: Structured validation for complex JSON data

## Backup and Recovery

### **Backup Strategy**
- **Automated Backups**: Replit platform automated backups
- **Migration Safety**: All migrations preserve existing data
- **Point-in-Time Recovery**: Available through Replit infrastructure
- **Schema Versioning**: Migration history provides version control

### **Disaster Recovery**
- **Schema Reconstruction**: Migrations can rebuild database from scratch
- **Data Export**: JSON export capabilities for critical data
- **Cross-Environment**: Consistent schema across all environments
- **Validation Scripts**: Automated schema validation and verification

## Development Best Practices

### **Migration Safety**
- **Backup First**: Always backup before applying migrations
- **Test Thoroughly**: Test migrations in development environment
- **Incremental Changes**: Small, focused migrations preferred
- **Documentation**: Clear migration purpose and impact documentation

### **Schema Evolution**
- **Backwards Compatibility**: Maintain API compatibility where possible
- **Graceful Degradation**: Handle missing columns in application code
- **Version Control**: All migrations tracked in git
- **Peer Review**: Migration changes reviewed before application

### **Performance Monitoring**
- **Query Analysis**: Monitor query performance after migrations
- **Index Usage**: Verify indexes are being utilized effectively
- **Connection Pooling**: Monitor connection usage patterns
- **Resource Utilization**: Track database resource consumption

This migration system provides enterprise-grade database evolution with complete isolation for beta testing, comprehensive metadata tracking, and performance optimization for large-scale domain intelligence processing.