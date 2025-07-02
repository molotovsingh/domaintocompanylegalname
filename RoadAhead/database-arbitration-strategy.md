
# Database Arbitration Strategy: Semi-Final to Authoritative Architecture

## Executive Summary

This document outlines the strategic approach for evolving our current domain-to-entity mapping system from algorithmic discovery to authoritative truth through a multi-stage arbitration process.

## Current State Analysis

### Database Architecture
- **Primary Processing**: `domains` table with Level 1 + Level 2 data
- **Entity Discovery**: `gleif_candidates` table (1:many relationships)
- **Knowledge Base**: `gleif_entities` table (master entities)
- **Relationship Tracking**: `domain_entity_mappings` table

### The Multiple LEI Challenge
- Current system discovers 5-10 GLEIF candidates per domain
- Algorithmic selection chooses "primary" candidate
- Question: Is this selection "final" or "best algorithmic guess"?

## Recommended Architecture: Hybrid Arbitration System

### Conceptual Flow
```
[Current DB: Semi-Final] → [LLM Arbitration Layer] → [Final Authoritative DB]
```

### Three-Tier Confidence Routing

#### Tier 1: Auto-Approval (>85% Confidence)
- **Action**: Automatic approval of algorithmic selection
- **Volume**: ~80% of cases
- **Benefit**: Immediate value from high-confidence matches

#### Tier 2: LLM Review (50-85% Confidence)  
- **Action**: AI-enhanced arbitration with context
- **Volume**: ~15% of cases
- **Context Provided**:
  - Domain context and industry
  - All candidate entities with scores
  - Geographic/jurisdictional intelligence
  - Corporate family relationships
  - Historical mapping patterns

#### Tier 3: Human Agent Review (<50% Confidence)
- **Action**: Expert human arbitration
- **Volume**: ~5% of cases
- **Escalation Triggers**:
  - Multiple Fortune 500 candidates
  - Complex corporate hierarchies
  - Geographic jurisdiction conflicts
  - Industry-specific edge cases
  - Regulatory compliance requirements

## Implementation Strategy

### Phase 1: Current Database Enhancement
Add arbitration tracking to existing schema:

```sql
-- Arbitration status tracking
ALTER TABLE domains ADD COLUMN arbitration_status TEXT; -- 'pending', 'llm_reviewed', 'agent_reviewed', 'final'
ALTER TABLE domains ADD COLUMN arbitration_confidence INTEGER;
ALTER TABLE domains ADD COLUMN arbitration_method TEXT; -- 'algorithm', 'llm', 'human_agent'
ALTER TABLE domains ADD COLUMN arbitration_notes TEXT;
ALTER TABLE domains ADD COLUMN arbitration_date TIMESTAMP;
```

### Phase 2: Authoritative Truth Table
Create clean, single-source-of-truth for production systems:

```sql
CREATE TABLE authoritative_domain_entities (
  domain_hash TEXT PRIMARY KEY,
  final_lei_code TEXT,
  final_legal_name TEXT,
  arbitration_confidence INTEGER,
  arbitration_method TEXT,
  arbitration_reasoning TEXT,
  arbitration_date TIMESTAMP,
  source_domain_id INTEGER REFERENCES domains(id),
  reviewed_by TEXT, -- 'algorithm', 'llm_model_name', 'agent_id'
  review_notes TEXT
);
```

### Phase 3: Arbitration Engine Framework

```typescript
interface ArbitrationDecision {
  domainId: number;
  selectedLeiCode: string;
  confidence: number;
  method: 'algorithm' | 'llm' | 'human_agent';
  reasoning: string;
  allCandidates: GLEIFCandidate[];
  contextFactors: {
    industryMatch: boolean;
    geographicAlignment: boolean;
    corporateHierarchy: string[];
    regulatoryFlags: string[];
  };
}

class ArbitrationEngine {
  async processDecision(domain: Domain): Promise<ArbitrationDecision> {
    const confidence = this.calculateConfidence(domain);
    
    if (confidence > 85) {
      return this.autoApprove(domain);
    } else if (confidence > 50) {
      return this.llmReview(domain);
    } else {
      return this.humanEscalation(domain);
    }
  }
}
```

## Benefits of This Approach

### Immediate Value
- **80%+ cases**: Instant algorithmic decisions provide immediate business value
- **Existing investment preserved**: Current sophisticated discovery system remains valuable
- **Continuous operation**: No disruption to current processing

### Quality Assurance
- **15% LLM review**: AI catches edge cases and improves decision quality
- **5% human expertise**: Complex cases get expert attention
- **Full audit trail**: Every decision traceable to evidence and reasoning

### Scalability & Learning
- **Confidence distribution analysis**: Data-driven optimization of thresholds
- **LLM improvement**: Agent feedback improves AI arbitration over time
- **Algorithm enhancement**: Arbitration insights improve base algorithm

### Production Readiness
- **Clean data interface**: Production systems query authoritative table only
- **Regulatory compliance**: Human oversight for sensitive cases
- **Risk mitigation**: Multi-layer validation reduces false positives

## Next Steps

1. **Confidence Distribution Analysis**: Analyze current data to determine actual confidence distribution
2. **LLM Integration Planning**: Design context preparation and prompt engineering
3. **Agent Workflow Design**: Create human review interface and escalation procedures
4. **Pilot Implementation**: Start with Tier 1 auto-approval to validate approach
5. **Iterative Expansion**: Gradually add LLM and human review capabilities

## Success Metrics

- **Accuracy Improvement**: Reduction in false positive entity mappings
- **Processing Efficiency**: Maintained throughput with enhanced quality
- **Confidence Calibration**: Correlation between confidence scores and actual accuracy
- **Review Queue Management**: Optimal distribution across arbitration tiers
- **Business Impact**: Improved acquisition research quality and speed

## Risk Mitigation

- **Backward Compatibility**: Current API endpoints remain functional
- **Graceful Degradation**: System operates normally if arbitration layers unavailable
- **Data Integrity**: All original discovery data preserved for re-arbitration
- **Performance Monitoring**: Real-time tracking of arbitration performance

This hybrid approach transforms your current database from a "good algorithmic guess" into an "authoritative business intelligence asset" while preserving all existing value and enabling continuous improvement.
