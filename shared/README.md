
# Shared - TypeScript Schemas & Business Logic

**Created:** January 11, 2025, 2:41 AM UTC  
**Last Updated:** January 11, 2025, 2:41 AM UTC

## Purpose
This folder contains shared TypeScript schemas, data structures, business logic, and utilities used across both client and server components of the Domain Intelligence Platform. It ensures type safety and consistency across the entire application stack.

## Core Schema Architecture

### **Production Database Schema (`schema.ts`)**
Complete PostgreSQL schema definition using Drizzle ORM with enterprise-grade domain intelligence capabilities:

#### Primary Tables
- **`batches`** - Processing batch management and metadata
  - Batch tracking with file information and processing status
  - Creation timestamps and completion analytics
  - Relationship foundation for domain grouping

- **`domains`** - Core domain processing and extraction results
  - Domain URL, company name extraction, and confidence scoring
  - Processing status tracking (pending → processing → success/failed)
  - Retry logic, failure categorization, and performance metrics
  - GLEIF integration status and entity mapping indicators

- **`gleif_entities`** - Master GLEIF entity knowledge base
  - Legal entity identifiers (LEI) with complete business information
  - Entity names, types, categories, and geographic data
  - Corporate suffixes, headquarters locations, and entity status
  - Creation and update timestamps for data freshness tracking

- **`gleif_candidates`** - Multi-candidate GLEIF discovery system
  - 1:many relationship between domains and potential GLEIF matches
  - Confidence scoring and matching method documentation
  - Algorithmic ranking for entity selection optimization
  - Search query tracking and result validation

- **`domain_entity_mappings`** - Authoritative domain-to-entity relationships
  - Final validated mappings between domains and GLEIF entities
  - Confidence levels and validation status tracking
  - Mapping method documentation and approval workflow
  - Historical relationship tracking and change detection

#### Enhanced Intelligence Tables
- **`processing_analytics`** - Comprehensive processing performance metrics
- **`entity_relationships`** - Corporate hierarchy and subsidiary discovery
- **`geographic_intelligence`** - Country detection and jurisdiction mapping
- **`extraction_history`** - Historical extraction method performance

### **Beta Testing Schema (`betaSchema.ts`)**
Completely isolated database schema for experimental feature testing:

#### Beta Tables
- **`beta_domains`** - Isolated domain testing with experimental methods
- **`beta_extractions`** - Method comparison and validation testing
- **`beta_analytics`** - Performance benchmarking and method evaluation
- **`beta_smoke_tests`** - Automated quality assurance testing

#### Beta Isolation Benefits
- **Zero Production Risk**: Complete database separation
- **Method Validation**: Safe testing of new extraction approaches
- **Performance Benchmarking**: Comparative analysis of extraction methods
- **Quality Assurance**: Automated testing without affecting live data

## Business Logic Components

### **Jurisdiction Intelligence (`jurisdictions.ts`)**
Comprehensive global jurisdiction support with 123 country coverage:

#### Jurisdiction Features
- **TLD Mapping**: Automatic country detection from domain extensions
- **Legal Entity Requirements**: Country-specific corporate suffix validation
- **Entity Categories**: Technology, Financial, Healthcare, Manufacturing classifications
- **Regulatory Frameworks**: GLEIF integration requirements by jurisdiction

#### Geographic Intelligence
```typescript
interface JurisdictionInfo {
  code: string;           // ISO country code
  name: string;           // Full country name
  tlds: string[];         // Associated top-level domains
  entityTypes: string[];  // Legal entity types supported
  gleifRequired: boolean; // GLEIF registration requirement
  regulations: string[];  // Regulatory framework information
}
```

### **Domain Parsing Rules (`parsing-rules.ts`)**
Advanced domain-to-company name extraction patterns:

#### Parsing Intelligence
- **Corporate Suffix Detection**: Global suffix patterns (Inc, Ltd, GmbH, SA, etc.)
- **Language-Specific Patterns**: Multi-language entity name extraction
- **TLD Intelligence**: Geographic and organizational TLD interpretation
- **Marketing Filter**: Removal of promotional and generic content

#### Extraction Patterns
```typescript
interface ExtractionRule {
  pattern: RegExp;        // Domain extraction pattern
  confidence: number;     // Confidence scoring (0-100)
  method: string;         // Extraction method identifier
  jurisdiction: string;   // Applicable jurisdiction
  entityType: string;     // Expected entity type
}
```

### **Domain Hashing System (`domain-hash.ts`)**
Cryptographic domain identification for duplicate detection:

#### Hash Features
- **SHA-256 Based**: Cryptographically secure domain fingerprinting
- **Normalization**: Consistent URL formatting before hashing
- **Collision Prevention**: Unique identification across processing batches
- **Performance Optimization**: Fast duplicate detection and lookup

#### Hash Implementation
```typescript
export function generateDomainHash(domain: string): string {
  const normalized = normalizeDomain(domain);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

### **Enhanced Export Schema (`enhanced-export-schema.ts`)**
Business intelligence export format with comprehensive entity data:

#### Export Structure
- **Domain Intelligence**: URL, company name, extraction method, confidence
- **GLEIF Enhancement**: Legal entity identifiers, entity types, headquarters
- **Geographic Data**: Country detection, jurisdiction analysis, regulatory status
- **Business Classification**: Industry categories, entity size, market presence
- **Relationship Data**: Corporate hierarchies, subsidiary relationships, ownership

#### Export Formats
```typescript
interface EnhancedExportRecord {
  domain: string;
  companyName: string;
  gleifEntity?: GLEIFEntity;
  geographic: GeographicIntelligence;
  business: BusinessClassification;
  relationships: EntityRelationship[];
  metadata: ExtractionMetadata;
}
```

## Type Safety Architecture

### **Drizzle ORM Integration**
- **Schema Evolution**: Versioned migrations with backward compatibility
- **Type Generation**: Automatic TypeScript type generation from schema
- **Query Safety**: Compile-time SQL query validation
- **Relationship Mapping**: Type-safe foreign key relationships

### **Cross-Component Consistency**
- **Client Integration**: Shared types for API responses and UI components
- **Server Logic**: Type-safe database operations and business logic
- **API Contracts**: Consistent request/response type definitions
- **Testing Framework**: Type-safe test data and validation

## Data Validation Strategy

### **Input Validation**
- **Domain Format**: URL validation and normalization
- **Company Names**: Length limits and character set validation
- **GLEIF Data**: LEI format validation and entity status verification
- **Geographic Data**: Country code validation and TLD verification

### **Business Rule Validation**
- **Entity Suffixes**: Jurisdiction-specific corporate suffix requirements
- **Confidence Scoring**: Algorithmic confidence calculation validation
- **Relationship Logic**: Corporate hierarchy validation and cycle prevention
- **Data Freshness**: Timestamp validation and staleness detection

## Performance Optimization

### **Query Optimization**
- **Indexed Searches**: Strategic database indexing for fast lookups
- **Relationship Queries**: Optimized JOIN operations for complex relationships
- **Batch Operations**: Efficient bulk insert and update operations
- **Connection Pooling**: Database connection optimization

### **Memory Management**
- **Type Efficiency**: Minimal memory footprint for large datasets
- **Lazy Loading**: On-demand loading of related entity data
- **Caching Strategy**: Intelligent caching of frequently accessed data
- **Garbage Collection**: Automatic cleanup of temporary processing data

## Development Guidelines

### **Schema Evolution**
1. **Migration First**: Always create migrations before schema changes
2. **Backward Compatibility**: Maintain API compatibility during transitions
3. **Type Safety**: Leverage TypeScript for compile-time validation
4. **Documentation**: Update schema documentation with every change

### **Adding New Schemas**
1. **Define Interface**: Start with TypeScript interface definition
2. **Drizzle Schema**: Implement using Drizzle ORM table definition
3. **Migration**: Create corresponding database migration
4. **Validation**: Add business logic validation rules
5. **Testing**: Create comprehensive test coverage

### **Cross-Component Integration**
- **Import Strategy**: Use relative imports from shared directory
- **Type Exports**: Export all types for client and server use
- **Validation Functions**: Provide validation utilities alongside types
- **Documentation**: Maintain inline JSDoc for complex types

## Business Intelligence Features

### **Entity Classification**
- **Fortune 500 Indicators**: Automatic high-priority entity classification
- **Industry Categories**: Technology, Financial, Healthcare, Manufacturing
- **Market Presence**: Global, regional, local market classification
- **Entity Size**: Revenue-based entity size estimation

### **Corporate Relationships**
- **Parent-Subsidiary**: Automatic corporate hierarchy discovery
- **Ownership Structure**: Ownership percentage and control relationships
- **Merger History**: Entity acquisition and merger tracking
- **Brand Relationships**: Brand-to-entity mapping and portfolio analysis

### **Geographic Intelligence**
- **Country Detection**: Multi-method country identification
- **Regulatory Mapping**: Jurisdiction-specific regulatory requirements
- **Market Analysis**: Geographic market presence and expansion
- **Compliance Tracking**: Regulatory compliance status monitoring

## Integration Patterns

### **Client-Server Communication**
```typescript
// Shared API response type
interface BatchResultsResponse {
  domains: DomainResult[];
  metadata: BatchMetadata;
  gleifEnhancements: GLEIFEnhancement[];
  analytics: ProcessingAnalytics;
}
```

### **Database Integration**
```typescript
// Shared query result type
interface DomainWithGLEIF {
  domain: Domain;
  gleifEntity?: GLEIFEntity;
  candidates: GLEIFCandidate[];
  mapping?: DomainEntityMapping;
}
```

### **Validation Integration**
```typescript
// Shared validation utilities
export function validateDomain(domain: string): ValidationResult;
export function validateGLEIFEntity(entity: GLEIFEntity): ValidationResult;
export function validateCompanyName(name: string): ValidationResult;
```

This shared architecture provides enterprise-grade type safety with comprehensive business intelligence capabilities, designed for scalable domain intelligence processing with global jurisdiction support and advanced corporate relationship discovery.
