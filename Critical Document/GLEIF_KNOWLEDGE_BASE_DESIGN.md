# GLEIF Knowledge Base Design
## In-House Entity Intelligence Database

### Core Concept
Transform from one-time GLEIF lookups to cumulative entity intelligence database that improves with every processing run.

### Data Accumulation Strategy

#### 1. Comprehensive Entity Storage
- **Primary Selection**: Top-scored entity (current behavior)
- **Secondary Entities**: All candidates with scores >25 points
- **Corporate Family Discovery**: Related entities found during searches
- **Historical Tracking**: Entity changes over time

#### 2. Enhanced Schema Design

```sql
-- Master Entity Intelligence Table
gleif_entities (
  lei_code PRIMARY KEY,
  legal_name,
  entity_status,
  jurisdiction,
  legal_form,
  headquarters_data,
  legal_address_data,
  other_names,
  registration_date,
  last_gleif_update,
  first_discovered_date,
  discovery_frequency,
  confidence_scores_history,
  full_gleif_data_json
)

-- Domain-Entity Relationships
domain_entity_mappings (
  domain,
  lei_code,
  mapping_confidence,
  discovery_method,
  first_mapped_date,
  last_confirmed_date,
  mapping_frequency
)

-- Corporate Family Relationships
entity_relationships (
  parent_lei,
  child_lei,
  relationship_type, -- subsidiary, branch, affiliate
  ownership_percentage,
  discovered_date,
  relationship_confidence
)
```

#### 3. Intelligence Accumulation Benefits

**Immediate Value:**
- Faster processing (local cache before GLEIF API)
- Pattern recognition for similar company structures
- Reduced API calls and costs

**Long-term Intelligence:**
- Corporate family tree mapping
- Industry clustering and patterns
- Jurisdiction risk profiles
- Entity lifecycle tracking

**Cross-System Benefits:**
- Authoritative entity database for firmographics system
- Corporate structure intelligence for news attribution
- Financial data validation against legal entity status
- Contact intelligence with proper entity hierarchies

#### 4. Implementation Phases

**Phase 1: Enhanced Retention**
- Store all GLEIF candidates (not just primary selection)
- Track entity discovery frequency and confidence trends
- Build comprehensive entity profiles

**Phase 2: Relationship Intelligence**
- Map corporate hierarchies discovered during searches
- Track entity name changes and status updates
- Build industry and jurisdiction intelligence

**Phase 3: Predictive Intelligence**
- Machine learning on entity patterns
- Predictive scoring for new domains
- Automated entity relationship discovery

### ROI Analysis

**Data Acquisition Costs:**
- Current: 1 API call → 1 entity stored
- Proposed: 1 API call → 5-10 entities stored (5-10x data leverage)

**Intelligence Multiplication:**
- Each search enriches the database for future processing
- Compound intelligence growth over time
- Proprietary competitive advantage in entity intelligence

### Next Steps
1. Implement enhanced GLEIF candidate retention
2. Build corporate relationship mapping
3. Create entity intelligence APIs for downstream systems
4. Develop predictive entity matching algorithms