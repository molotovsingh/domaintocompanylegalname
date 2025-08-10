import { db } from './database-wrapper';
import { perplexityAdapter } from './perplexityAdapter';
import { GleifRelationshipsService } from '../gleif/gleifRelationshipsService';

interface UserBias {
  jurisdictionPrimary: string;
  jurisdictionSecondary: string[];
  preferParent: boolean;
  parentWeight: number;
  jurisdictionWeight: number;
  entityStatusWeight: number;
  legalFormWeight: number;
  recencyWeight: number;
  industryFocus?: {
    target: string[];
    exclude: string[];
  };
}

interface RankedEntity {
  rank: number;
  entityName: string;
  leiCode?: string;
  confidence: number;
  reasoning: string;
  acquisitionGrade: string;
  metadata?: any;
}

interface ArbitrationResult {
  rankedEntities: RankedEntity[];
  overallReasoning: string;
  citations: string[];
  processingTimeMs: number;
}

export class PerplexityArbitrationService {
  private relationshipsService: GleifRelationshipsService;

  constructor() {
    this.relationshipsService = new GleifRelationshipsService();
  }

  /**
   * Main arbitration method using Perplexity Sonar
   */
  async arbitrate(claims: any[], userBias: UserBias): Promise<ArbitrationResult> {
    const startTime = Date.now();
    console.log(`[Arbitration] Starting arbitration for ${claims.length} claims`);

    // Build the arbitration prompt
    const prompt = await this.buildArbitrationPrompt(claims, userBias);

    // Call Perplexity API
    const response = await perplexityAdapter.callPerplexity(
      prompt,
      'sonar',
      0.2
    );

    // If Perplexity fails, use fallback algorithmic ranking
    if (!response) {
      console.log('[Arbitration] Perplexity unavailable, using fallback ranking');
      return this.fallbackArbitration(claims, userBias, Date.now() - startTime);
    }

    // Parse the response
    const parsedResponse = perplexityAdapter.parseArbitrationResponse(response);
    
    // Format the result
    const result: ArbitrationResult = {
      rankedEntities: parsedResponse?.rankedEntities || [],
      overallReasoning: parsedResponse?.overallReasoning || parsedResponse?.rawResponse || '',
      citations: response.citations || [],
      processingTimeMs: Date.now() - startTime
    };

    // If parsing failed, use fallback
    if (!result.rankedEntities || result.rankedEntities.length === 0) {
      console.log('[Arbitration] Could not parse Perplexity response, using fallback');
      return this.fallbackArbitration(claims, userBias, Date.now() - startTime);
    }

    console.log(`[Arbitration] Completed in ${result.processingTimeMs}ms with ${result.rankedEntities.length} ranked entities`);
    return result;
  }

  /**
   * Build the arbitration prompt for Perplexity
   */
  private async buildArbitrationPrompt(claims: any[], userBias: UserBias): Promise<string> {
    const domain = claims[0]?.metadata?.domain || 'unknown';
    const claim0 = claims.find(c => c.claimNumber === 0);
    const gleifClaims = claims.filter(c => c.claimNumber > 0);

    // Enrich GLEIF claims with relationship data
    for (const claim of gleifClaims) {
      if (claim.leiCode) {
        const relationships = await this.relationshipsService.getRelationships(claim.leiCode);
        claim.metadata = claim.metadata || {};
        claim.metadata.hierarchyLevel = await this.relationshipsService.getHierarchyLevel(claim.leiCode);
        claim.metadata.hasParent = relationships?.parents?.length > 0;
        claim.metadata.ultimateParentLei = relationships?.ultimateParent?.lei;
      }
    }

    const prompt = `
You are an entity arbitrator for acquisition research. Your task is to rank corporate entities based on their relevance for acquisition targeting.

Domain being analyzed: ${domain}

## Claims to Arbitrate

Claim 0 (Website claims to be): 
- Entity: ${claim0?.entityName || 'Unknown'}
- Source: ${claim0?.source || 'website extraction'}
- Confidence: ${claim0?.confidence || 0}

GLEIF Claims (${gleifClaims.length} verified entities):
${gleifClaims.map(c => `
Claim ${c.claimNumber}:
- Legal Name: ${c.entityName}
- LEI Code: ${c.leiCode}
- Jurisdiction: ${c.metadata?.jurisdiction || 'Unknown'}
- Entity Status: ${c.metadata?.entityStatus || 'Unknown'}
- Legal Form: ${c.metadata?.legalForm || 'Unknown'}
- Hierarchy: ${c.metadata?.hierarchyLevel || 'Unknown'}
- Has Parent: ${c.metadata?.hasParent || false}
- Headquarters: ${c.metadata?.headquarters?.city || 'Unknown'}, ${c.metadata?.headquarters?.country || 'Unknown'}
- Last Updated: ${c.metadata?.lastUpdateDate || 'Unknown'}
`).join('\n')}

## Ranking Rules (Apply Strictly in This Order)

1. **Parent Entity Priority** (Weight: ${userBias.parentWeight * 100}%)
   - Ultimate parent entities rank highest
   - Direct parent entities rank second
   - Subsidiaries rank lower
   - Use GLEIF hierarchy data to determine relationships

2. **Jurisdiction Alignment** (Weight: ${userBias.jurisdictionWeight * 100}%)
   - Primary jurisdiction (${userBias.jurisdictionPrimary}): +30% boost
   - Secondary jurisdictions (${userBias.jurisdictionSecondary.join(', ')}): +15% boost
   - Other jurisdictions: no boost

3. **Entity Status** (Weight: ${userBias.entityStatusWeight * 100}%)
   - ACTIVE entities only for top 5
   - INACTIVE or MERGED entities should be excluded

4. **Legal Form Relevance** (Weight: ${userBias.legalFormWeight * 100}%)
   - Corporations (Inc, Corp, Ltd): preferred
   - LLCs: acceptable
   - Other forms: lower priority

5. **Registration Recency** (Weight: ${userBias.recencyWeight * 100}%)
   - Updated within 1 year: +5% boost
   - Updated within 3 years: +2% boost
   - Older updates: no boost

## Required Output Format

Return EXACTLY this JSON structure with your top 5 ranked entities:

\`\`\`json
{
  "rankedEntities": [
    {
      "rank": 1,
      "entityName": "Full Legal Name from GLEIF",
      "leiCode": "20-character LEI code",
      "confidence": 0.95,
      "reasoning": "Ultimate parent entity, US jurisdiction, active status, recently updated",
      "acquisitionGrade": "A+"
    },
    {
      "rank": 2,
      "entityName": "Second Entity Name",
      "leiCode": "LEI code",
      "confidence": 0.85,
      "reasoning": "Direct subsidiary of parent, operational entity",
      "acquisitionGrade": "A"
    }
  ],
  "overallReasoning": "The primary acquisition target is [Entity 1] because it is the ultimate parent with decision-making authority. The operational subsidiaries are less relevant for acquisition purposes."
}
\`\`\`

## Acquisition Grades:
- A+: Ultimate parent, perfect jurisdiction match, active
- A: Parent entity or key operating company
- B+: Important subsidiary with strategic value
- B: Regional subsidiary or specialized unit
- C: Lower-tier subsidiary or non-strategic entity

Focus on identifying the ultimate decision-making entity for acquisition purposes. If no ultimate parent exists in the claims, identify the highest-level entity available.
`;

    return prompt;
  }

  /**
   * Fallback algorithmic ranking when Perplexity is unavailable
   */
  private async fallbackArbitration(
    claims: any[], 
    userBias: UserBias, 
    elapsedMs: number
  ): Promise<ArbitrationResult> {
    console.log('[Arbitration] Using fallback algorithmic ranking');

    const scoredClaims = await Promise.all(
      claims
        .filter(c => c.claimNumber > 0) // Only GLEIF claims
        .map(async (claim) => {
          let score = claim.confidence || 0.5;

          // Parent bonus
          if (claim.metadata?.hierarchyLevel === 'ultimate_parent') {
            score += userBias.parentWeight;
          } else if (claim.metadata?.hierarchyLevel === 'parent') {
            score += userBias.parentWeight * 0.7;
          }

          // Jurisdiction bonus
          if (claim.metadata?.jurisdiction === userBias.jurisdictionPrimary) {
            score += userBias.jurisdictionWeight;
          } else if (userBias.jurisdictionSecondary.includes(claim.metadata?.jurisdiction)) {
            score += userBias.jurisdictionWeight * 0.5;
          }

          // Active status bonus
          if (claim.metadata?.entityStatus === 'ACTIVE') {
            score += userBias.entityStatusWeight;
          }

          // Legal form bonus
          const legalForm = claim.metadata?.legalForm || '';
          if (['XTIQ', 'XDLC', '8888'].includes(legalForm)) { // Common corporation codes
            score += userBias.legalFormWeight;
          }

          // Recency bonus
          if (claim.metadata?.lastUpdateDate) {
            const monthsAgo = (Date.now() - new Date(claim.metadata.lastUpdateDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsAgo < 12) {
              score += userBias.recencyWeight;
            } else if (monthsAgo < 36) {
              score += userBias.recencyWeight * 0.5;
            }
          }

          return { claim, score };
        })
    );

    // Sort by score
    scoredClaims.sort((a, b) => b.score - a.score);

    // Take top 5
    const rankedEntities: RankedEntity[] = scoredClaims.slice(0, 5).map((item, index) => ({
      rank: index + 1,
      entityName: item.claim.entityName,
      leiCode: item.claim.leiCode,
      confidence: Math.min(item.score, 1.0),
      reasoning: this.generateFallbackReasoning(item.claim, userBias),
      acquisitionGrade: this.calculateGrade(item.score),
      metadata: item.claim.metadata
    }));

    return {
      rankedEntities,
      overallReasoning: 'Entities ranked using algorithmic scoring based on parent hierarchy, jurisdiction, and entity status.',
      citations: [],
      processingTimeMs: elapsedMs
    };
  }

  private generateFallbackReasoning(claim: any, userBias: UserBias): string {
    const reasons = [];
    
    if (claim.metadata?.hierarchyLevel === 'ultimate_parent') {
      reasons.push('Ultimate parent entity');
    } else if (claim.metadata?.hierarchyLevel === 'parent') {
      reasons.push('Parent entity');
    }
    
    if (claim.metadata?.jurisdiction === userBias.jurisdictionPrimary) {
      reasons.push(`${userBias.jurisdictionPrimary} jurisdiction`);
    }
    
    if (claim.metadata?.entityStatus === 'ACTIVE') {
      reasons.push('Active status');
    }
    
    return reasons.join(', ') || 'Standard entity';
  }

  private calculateGrade(score: number): string {
    if (score >= 0.9) return 'A+';
    if (score >= 0.8) return 'A';
    if (score >= 0.7) return 'B+';
    if (score >= 0.6) return 'B';
    return 'C';
  }

  /**
   * Get default user bias profile
   */
  async getDefaultUserBias(): Promise<UserBias> {
    const result = await db.query(
      'SELECT * FROM user_bias_profiles WHERE is_default = true LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      // Return hardcoded default if no profile exists
      return {
        jurisdictionPrimary: 'US',
        jurisdictionSecondary: ['GB', 'CA'],
        preferParent: true,
        parentWeight: 0.4,
        jurisdictionWeight: 0.3,
        entityStatusWeight: 0.1,
        legalFormWeight: 0.05,
        recencyWeight: 0.05
      };
    }
    
    const profile = result.rows[0];
    return {
      jurisdictionPrimary: profile.jurisdiction_primary,
      jurisdictionSecondary: profile.jurisdiction_secondary || [],
      preferParent: profile.prefer_parent,
      parentWeight: profile.parent_weight,
      jurisdictionWeight: profile.jurisdiction_weight,
      entityStatusWeight: profile.entity_status_weight,
      legalFormWeight: profile.legal_form_weight,
      recencyWeight: profile.recency_weight,
      industryFocus: profile.industry_focus
    };
  }
}

export const perplexityArbitrationService = new PerplexityArbitrationService();