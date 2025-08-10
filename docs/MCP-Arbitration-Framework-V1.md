# MCP Arbitration Framework V1 - Complete Implementation Plan

## Executive Summary
A claims-to-arbitration framework that transforms domain-to-entity mapping using a multi-claim approach with Perplexity Sonar arbitration. Designed for acquisition research with sophisticated ranking prioritizing parent entities and jurisdiction bias.

## Core Philosophy
- **Claim 0**: LLM cleaned dump (what the website claims to be)
- **Claims 1-N**: GLEIF candidates (what GLEIF knows exists)
- **Truth**: A range of possibilities with confidence scores, not a single answer
- **1-to-Many Mapping**: Embrace multiple valid entities per domain

## Architecture Overview

### Three-Stage Pipeline
```
Stage 1: Claims Generation
├── Claim 0: Extract from cleaned website dump (DeepSeek Chat)
├── Claims 1-N: GLEIF API search results
└── Relationship enrichment from GLEIF

Stage 2: Arbitration (Perplexity Sonar)
├── Apply ranking algorithm
├── Consider user bias
└── Generate top 5 entities

Stage 3: Result Presentation
├── Executive summary
├── Confidence scores
└── Acquisition intelligence
```

## Detailed Components

### 1. Database Schema

```sql
-- Arbitration requests tracking
CREATE TABLE arbitration_requests (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  dump_id INTEGER,
  collection_type TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual claims storage
CREATE TABLE arbitration_claims (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES arbitration_requests(id),
  claim_number INTEGER, -- 0 for LLM, 1-N for GLEIF
  claim_type TEXT CHECK (claim_type IN ('llm_extracted', 'gleif_candidate')),
  entity_name TEXT NOT NULL,
  lei_code TEXT,
  confidence_score FLOAT,
  source TEXT, -- extraction source
  metadata JSONB, -- additional claim data
  created_at TIMESTAMP DEFAULT NOW()
);

-- Arbitration results
CREATE TABLE arbitration_results (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES arbitration_requests(id),
  ranked_entities JSONB[], -- top 5 entities
  arbitrator_model TEXT,
  arbitration_reasoning TEXT,
  processing_time_ms INTEGER,
  perplexity_citations JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User bias profiles
CREATE TABLE user_bias_profiles (
  id SERIAL PRIMARY KEY,
  profile_name TEXT NOT NULL,
  user_id TEXT,
  jurisdiction_primary TEXT,
  jurisdiction_secondary TEXT[],
  prefer_parent BOOLEAN DEFAULT true,
  parent_weight FLOAT DEFAULT 0.4,
  jurisdiction_weight FLOAT DEFAULT 0.3,
  industry_focus JSONB,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- GLEIF relationships cache
CREATE TABLE gleif_relationships_cache (
  id SERIAL PRIMARY KEY,
  lei_code TEXT UNIQUE NOT NULL,
  parent_lei TEXT,
  ultimate_parent_lei TEXT,
  relationship_type TEXT,
  relationship_status TEXT,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);
```

### 2. Service Architecture

#### ClaimsGenerationService
```typescript
// server/beta-v2/arbitration/claimsGenerationService.ts
interface Claim {
  claimNumber: number;
  claimType: 'llm_extracted' | 'gleif_candidate';
  entityName: string;
  leiCode?: string;
  confidence: number;
  source: string;
  metadata?: any;
}

class ClaimsGenerationService {
  // Generate Claim 0 from cleaned dump
  async generateBaseClaim(dump: CleanedDump): Promise<Claim> {
    // Extract primary entity using DeepSeek
    // Sources: title, meta tags, structured data, copyright
    // Return single best entity name
  }
  
  // Generate Claims 1-N from GLEIF
  async generateGleifClaims(entityName: string): Promise<Claim[]> {
    // Search GLEIF with variations
    // Include wildcards and fuzzy matching
    // Return all matching entities
  }
  
  // Enrich with relationships
  async enrichWithRelationships(claims: Claim[]): Promise<Claim[]> {
    // For each LEI, fetch parent/child relationships
    // Mark ultimate parents
    // Add hierarchy level to metadata
  }
}
```

#### PerplexityArbitrationService
```typescript
// server/beta-v2/arbitration/perplexityArbitrationService.ts
interface ArbitrationResult {
  rankedEntities: RankedEntity[];
  reasoning: string;
  citations: Citation[];
  processingTimeMs: number;
}

class PerplexityArbitrationService {
  private readonly PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  async arbitrate(
    claims: Claim[], 
    userBias: UserBias
  ): Promise<ArbitrationResult> {
    const prompt = this.buildArbitrationPrompt(claims, userBias);
    const response = await this.callPerplexity(prompt);
    return this.parseArbitrationResponse(response);
  }
  
  private buildArbitrationPrompt(claims: Claim[], bias: UserBias): string {
    return `
    You are an entity arbitrator for acquisition research.
    
    Domain: ${claims[0]?.metadata?.domain}
    
    Claim 0 (Website claims): ${claims[0]?.entityName}
    GLEIF Claims (${claims.length - 1} entities):
    ${claims.slice(1).map(c => 
      `- ${c.entityName} (LEI: ${c.leiCode}, ${c.metadata?.jurisdiction})`
    ).join('\n')}
    
    Ranking Rules (apply strictly):
    1. Ultimate parent > parent > subsidiary (use relationship data)
    2. ${bias.jurisdictionPrimary} entities get +30% boost
    3. ACTIVE status required for top ranking
    4. Recent registration updates indicate active maintenance
    
    For each entity, verify:
    - Parent/child relationships via GLEIF
    - Current market status (recent acquisitions, mergers)
    - Jurisdiction alignment: ${bias.jurisdictionPrimary}
    
    Return TOP 5 entities as JSON with:
    {
      "rankedEntities": [
        {
          "rank": 1,
          "entityName": "...",
          "leiCode": "...",
          "confidence": 0.95,
          "reasoning": "Ultimate parent, US jurisdiction, active",
          "acquisitionGrade": "A+"
        }
      ],
      "overallReasoning": "..."
    }
    `;
  }
}
```

#### GleifRelationshipsService
```typescript
// server/beta-v2/gleif/gleifRelationshipsService.ts
class GleifRelationshipsService {
  async getRelationships(leiCode: string): Promise<EntityRelationships> {
    // Check cache first
    const cached = await this.checkCache(leiCode);
    if (cached) return cached;
    
    // Fetch from GLEIF API
    const url = `https://api.gleif.org/api/v1/lei-records/${leiCode}/relationship-records`;
    const response = await fetch(url);
    
    // Parse relationships
    const relationships = this.parseRelationships(response);
    
    // Cache for 7 days
    await this.cacheRelationships(leiCode, relationships);
    
    return relationships;
  }
  
  async getHierarchyLevel(leiCode: string): Promise<HierarchyLevel> {
    const relationships = await this.getRelationships(leiCode);
    
    if (!relationships.parents?.length) {
      return 'ultimate_parent';
    }
    if (relationships.ultimateParent) {
      return 'subsidiary';
    }
    return 'intermediate_parent';
  }
}
```

### 3. API Endpoints

```typescript
// server/beta-v2/routes/arbitrationRoutes.ts

// Process arbitration for a domain
POST /api/beta/arbitration/process
Request: {
  domain: string;
  dumpId: number;
  collectionType: string;
  userBiasProfileId?: number;
}
Response: {
  requestId: number;
  status: 'processing';
}

// Get arbitration results
GET /api/beta/arbitration/results/:requestId
Response: {
  status: string;
  claims: Claim[];
  rankedEntities: RankedEntity[];
  reasoning: string;
  citations: Citation[];
  processingTimeMs: number;
}

// Configure user bias
POST /api/beta/arbitration/bias/configure
Request: UserBias
Response: { profileId: number; success: true }

// Get user bias profiles
GET /api/beta/arbitration/bias/profiles
Response: UserBiasProfile[]

// Batch arbitration
POST /api/beta/arbitration/batch
Request: {
  domains: string[];
  userBiasProfileId?: number;
}
Response: {
  batchId: string;
  status: 'queued';
  estimatedTimeMs: number;
}
```

### 4. Ranking Algorithm

```typescript
interface RankingTiers {
  tier1_parentStatus: {
    ultimateParent: 100,
    parent: 70,
    subsidiary: 30,
    standalone: 50
  },
  tier2_jurisdiction: {
    primaryMatch: 30,
    secondaryMatch: 15,
    noMatch: 0
  },
  tier3_entityStatus: {
    ACTIVE: 10,
    INACTIVE: -50,
    MERGED: -30
  },
  tier4_legalForm: {
    corporation: 5,  // Inc, Corp, Ltd
    llc: 3,
    other: 0
  },
  tier5_recency: {
    updatedWithin1Year: 5,
    updatedWithin3Years: 2,
    older: 0
  }
}
```

### 5. User Bias Configuration

```typescript
interface UserBias {
  jurisdiction: {
    primary: string;      // e.g., "US"
    secondary: string[];  // e.g., ["GB", "CA"]
    weight: number;       // 0.3 (30% boost)
  };
  entityPreference: {
    preferParent: boolean;
    parentWeight: number;  // 0.4 (40% boost)
  };
  industryFocus?: {
    target: string[];     // e.g., ["technology", "software"]
    exclude: string[];    // e.g., ["finance", "real_estate"]
  };
  sizePreference?: {
    minimumRevenue?: number;
    minimumEmployees?: number;
  };
}
```

### 6. Error Handling & Fallbacks

```typescript
class ArbitrationFallbackService {
  // When Perplexity fails
  async useLocalRanking(claims: Claim[]): Promise<RankedEntity[]> {
    // Apply algorithmic ranking without LLM
    // Use weighted scoring system
    return this.applyAlgorithmicRanking(claims);
  }
  
  // When GLEIF returns nothing
  async suggestAlternativeSearches(domain: string): Promise<string[]> {
    // Generate search variations
    // Remove common suffixes (.com, Inc)
    // Try acronyms and expansions
  }
  
  // When no clear entity found
  async flagForManualReview(domain: string): Promise<ManualReviewRequest> {
    // Create review request
    // Include all available data
    // Suggest possible searches
  }
}
```

### 7. Caching Strategy

```typescript
class ArbitrationCache {
  private gleifCache = new Map<string, CachedResult>();
  private arbitrationCache = new Map<string, CachedResult>();
  
  // Cache GLEIF results for 1 hour
  async cacheGleif(query: string, result: GleifResult): Promise<void> {
    this.gleifCache.set(query, {
      data: result,
      expiresAt: Date.now() + 3600000 // 1 hour
    });
  }
  
  // Cache arbitration results for 24 hours
  async cacheArbitration(domain: string, result: ArbitrationResult): Promise<void> {
    this.arbitrationCache.set(domain, {
      data: result,
      expiresAt: Date.now() + 86400000 // 24 hours
    });
  }
  
  // Invalidate on updates
  async invalidate(domain: string): Promise<void> {
    this.arbitrationCache.delete(domain);
    // Also clear related GLEIF cache entries
  }
}
```

### 8. Perplexity Integration

```typescript
interface PerplexityConfig {
  apiKey: string;
  model: 'llama-3.1-sonar-small-128k-online' | 
         'llama-3.1-sonar-large-128k-online' |
         'llama-3.1-sonar-huge-128k-online';
  temperature: number;  // 0.2 for consistency
  maxTokens: number;    // 4000 for detailed analysis
  searchDomainFilter?: string[];  // ['gleif.org', 'sec.gov']
  returnCitations: boolean;
  searchRecencyFilter?: 'month' | 'year';
}

class PerplexityAdapter {
  async callPerplexity(prompt: string, config: PerplexityConfig): Promise<PerplexityResponse> {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert in corporate entity resolution and acquisition research.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        search_domain_filter: config.searchDomainFilter,
        return_citations: config.returnCitations,
        search_recency_filter: config.searchRecencyFilter
      })
    });
    
    return await response.json();
  }
}
```

### 9. Frontend Components

#### ArbitrationResults Component
```tsx
// client/src/components/ArbitrationResults.tsx
interface ArbitrationResultsProps {
  requestId: number;
}

export function ArbitrationResults({ requestId }: ArbitrationResultsProps) {
  // Fetch results
  const { data: results } = useQuery({
    queryKey: ['/api/beta/arbitration/results', requestId],
    refetchInterval: 2000 // Poll while processing
  });
  
  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Primary Entity</CardTitle>
        </CardHeader>
        <CardContent>
          <h2>{results?.rankedEntities[0]?.entityName}</h2>
          <Badge>{results?.rankedEntities[0]?.acquisitionGrade}</Badge>
          <Progress value={results?.rankedEntities[0]?.confidence * 100} />
        </CardContent>
      </Card>
      
      {/* Top 5 Entities */}
      <Card>
        <CardHeader>
          <CardTitle>Ranked Entities</CardTitle>
        </CardHeader>
        <CardContent>
          {results?.rankedEntities.map((entity, idx) => (
            <EntityCard key={idx} entity={entity} rank={idx + 1} />
          ))}
        </CardContent>
      </Card>
      
      {/* Citations */}
      {results?.citations && (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {results.citations.map((citation, idx) => (
              <Citation key={idx} {...citation} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

#### UserBiasConfig Component
```tsx
// client/src/components/UserBiasConfig.tsx
export function UserBiasConfig() {
  const [bias, setBias] = useState<UserBias>(defaultBias);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Arbitration Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Jurisdiction Selection */}
        <div>
          <Label>Primary Jurisdiction</Label>
          <Select value={bias.jurisdiction.primary}>
            <SelectItem value="US">United States</SelectItem>
            <SelectItem value="GB">United Kingdom</SelectItem>
            <SelectItem value="DE">Germany</SelectItem>
          </Select>
        </div>
        
        {/* Parent Preference */}
        <div>
          <Label>Prefer Parent Entities</Label>
          <Switch checked={bias.entityPreference.preferParent} />
          <Slider 
            value={[bias.entityPreference.parentWeight * 100]}
            max={100}
            step={5}
          />
        </div>
        
        {/* Save Profile */}
        <Button onClick={saveProfile}>Save Profile</Button>
      </CardContent>
    </Card>
  );
}
```

### 10. Testing Strategy

#### Test Cases
```typescript
const TEST_CASES = {
  // Simple case - single entity
  'stripe.com': {
    expectedEntity: 'Stripe, Inc.',
    expectedLEI: '549300LFNEANZRQEBU57',
    claimsCount: 1
  },
  
  // Complex case - many subsidiaries
  'netflix.com': {
    expectedParent: 'NETFLIX, INC.',
    expectedLEI: '549300Y7VHGU0I7CE873',
    claimsCount: 200,
    expectSubsidiaries: true
  },
  
  // Ambiguous case - common name
  'delta.com': {
    possibleEntities: ['Delta Air Lines', 'Delta Dental', 'Delta Faucet'],
    requiresArbitration: true
  },
  
  // International case
  'samsung.com': {
    expectedParent: 'Samsung Electronics Co., Ltd.',
    jurisdiction: 'KR',
    expectUSSubsidiary: true
  },
  
  // Edge case - no GLEIF data
  'localshop.com': {
    expectedFallback: 'manual_review',
    gleifResults: 0
  }
};
```

### 11. Performance Metrics

```typescript
interface PerformanceTargets {
  claimsGeneration: {
    maxTimeMs: 1000,      // 1 second for claims
    maxClaims: 500        // Cap at 500 GLEIF results
  },
  arbitration: {
    maxTimeMs: 3000,      // 3 seconds for arbitration
    timeoutMs: 10000      // 10 second timeout
  },
  overall: {
    maxTimeMs: 5000,      // 5 seconds total
    cacheHitTarget: 0.7   // 70% cache hit rate
  }
}
```

## Implementation Timeline

### Phase 1: Foundation (Day 1)
- [ ] Create database tables
- [ ] Set up Perplexity API integration
- [ ] Build ClaimsGenerationService
- [ ] Implement basic Claim 0 extraction

### Phase 2: GLEIF Integration (Day 2)
- [ ] Implement GleifRelationshipsService
- [ ] Add relationship caching
- [ ] Build Claims 1-N generation
- [ ] Add hierarchy detection

### Phase 3: Arbitration Core (Day 3)
- [ ] Implement PerplexityArbitrationService
- [ ] Create ranking algorithm
- [ ] Build user bias configuration
- [ ] Add fallback strategies

### Phase 4: API & Storage (Day 4)
- [ ] Create API endpoints
- [ ] Implement batch processing
- [ ] Add caching layer
- [ ] Build error handling

### Phase 5: Frontend (Day 5)
- [ ] Build ArbitrationResults component
- [ ] Create UserBiasConfig component
- [ ] Add to Beta V2 dashboard
- [ ] Implement real-time updates

### Phase 6: Testing & Optimization (Day 6-7)
- [ ] Test with known entities
- [ ] Netflix stress test (200+ claims)
- [ ] Performance optimization
- [ ] Edge case handling

## Configuration Profiles

### Cost-Optimized
```json
{
  "claim0Model": "deepseek/deepseek-chat",
  "arbitrationModel": "llama-3.1-sonar-small-128k-online",
  "maxClaims": 100,
  "temperature": 0.2,
  "cacheEnabled": true,
  "estimatedCostPerDomain": "$0.02"
}
```

### Quality-Optimized
```json
{
  "claim0Model": "openai/gpt-4o",
  "arbitrationModel": "llama-3.1-sonar-huge-128k-online",
  "maxClaims": 500,
  "temperature": 0.1,
  "includeCitations": true,
  "doubleVerification": true,
  "estimatedCostPerDomain": "$0.15"
}
```

### Speed-Optimized
```json
{
  "claim0Model": "cached_extraction",
  "arbitrationModel": "llama-3.1-sonar-small-128k-online",
  "maxClaims": 50,
  "parallelProcessing": true,
  "skipRelationships": false,
  "targetTimeMs": 2000
}
```

## Success Criteria

1. **Accuracy**: 95% correct parent entity identification
2. **Performance**: <5 seconds for 200+ claims arbitration
3. **Coverage**: Handle 99% of domains without manual intervention
4. **User Satisfaction**: Clear, actionable acquisition intelligence
5. **Cost Efficiency**: <$0.05 average cost per domain

## Risk Mitigation

1. **Perplexity API Downtime**: Fallback to algorithmic ranking
2. **GLEIF API Limits**: Implement aggressive caching
3. **High Claim Volume**: Cap at 500 claims, prioritize by relevance
4. **Ambiguous Entities**: Flag for manual review with suggestions
5. **Cost Overruns**: Monitor usage, switch models dynamically

## Future Enhancements (V2)

1. **Consensus Arbitration**: Multiple LLMs vote on rankings
2. **Machine Learning**: Train custom ranking model on user feedback
3. **Real-time Updates**: WebSocket for live arbitration progress
4. **Industry Intelligence**: Integrate sector-specific data sources
5. **M&A Prediction**: Identify acquisition targets based on patterns

## Monitoring & Analytics

```typescript
interface ArbitrationMetrics {
  // Quality metrics
  userFeedbackScore: number;        // 1-5 rating
  parentAccuracy: number;           // % correct parent identification
  falsePositiveRate: number;        // % incorrect entities
  
  // Performance metrics
  avgProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  cacheHitRate: number;
  
  // Usage metrics
  dailyArbitrations: number;
  uniqueDomains: number;
  avgClaimsPerDomain: number;
  
  // Cost metrics
  dailyCost: number;
  costPerDomain: number;
  modelUsageBreakdown: Record<string, number>;
}
```

## Conclusion

This MCP Arbitration Framework V1 provides a robust, scalable solution for domain-to-entity mapping with a focus on acquisition research. The system prioritizes accuracy through parent entity identification, user preference alignment, and intelligent arbitration using Perplexity's real-time search capabilities.

Key innovations:
- Claims-based approach acknowledging multiple truths
- Perplexity Sonar for real-time verification
- Sophisticated ranking with parent preference
- User bias configuration for personalized results
- Comprehensive fallback strategies

The framework is designed for immediate implementation while maintaining flexibility for future enhancements.