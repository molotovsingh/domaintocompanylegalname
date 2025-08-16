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
  muteRankingRules?: boolean; // For testing - bypasses all ranking logic
}

interface RankedEntity {
  rank: number;
  claimNumber?: number;
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
   * Main arbitration method using Perplexity
   */
  async arbitrate(claims: any[], userBias: UserBias): Promise<ArbitrationResult> {
    const startTime = Date.now();
    console.log(`[Perplexity Arbitration] Starting arbitration for ${claims.length} claims with Perplexity API`);

    try {
      // Build the arbitration prompt
      const prompt = await this.buildArbitrationPrompt(claims, userBias);
      
      // Call Perplexity API with the pro model for better reasoning
      console.log('[Perplexity Arbitration] Calling Perplexity API with sonar-pro model');
      const response = await perplexityAdapter.callPerplexity(
        prompt,
        'sonar-pro',
        0.2
      );

      if (!response || !response.choices?.[0]?.message?.content) {
        console.warn('[Perplexity Arbitration] No response from Perplexity, falling back to algorithmic ranking');
        return this.fallbackArbitration(claims, userBias, Date.now() - startTime);
      }

      const content = response.choices[0].message.content;
      console.log('[Perplexity Arbitration] Received response from Perplexity');

      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      let jsonStr = content;
      
      // Try to parse the JSON response
      try {
        
        // Try to find JSON in code blocks first
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        } else {
          // Try to find JSON object directly
          const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonStr = jsonObjectMatch[0];
          }
        }

        // Log for debugging
        console.log('[Perplexity Arbitration] Extracted JSON length:', jsonStr.length);

        const result = JSON.parse(jsonStr);
        
        // Add citations from Perplexity response
        const citations = response.citations || [];
        
        return {
          rankedEntities: result.rankedEntities || [],
          overallReasoning: result.overallReasoning || 'Perplexity analysis completed',
          citations,
          processingTimeMs: Date.now() - startTime
        };
      } catch (parseError) {
        console.error('[Perplexity Arbitration] Failed to parse JSON response:', parseError);
        console.log('[Perplexity Arbitration] Raw response length:', content.length);
        
        // Only log first 500 chars to avoid flooding logs
        console.log('[Perplexity Arbitration] Raw response:', content.substring(0, 500));
        
        // Try to fix common JSON issues
        try {
          // Remove any trailing commas or incomplete JSON
          let fixedJson = jsonStr;
          
          // If the JSON seems truncated, try to close it properly
          if (jsonStr.includes('"rankedEntities"') && !jsonStr.includes('"overallReasoning"')) {
            // Close the rankedEntities array and add a dummy overallReasoning
            const lastBrace = jsonStr.lastIndexOf('}');
            if (lastBrace > 0) {
              fixedJson = jsonStr.substring(0, lastBrace + 1) + '], "overallReasoning": "Analysis completed" }';
            }
          }
          
          // Try parsing the fixed JSON
          const result = JSON.parse(fixedJson);
          console.log('[Perplexity Arbitration] Successfully parsed after fixing JSON');
          
          return {
            rankedEntities: result.rankedEntities || [],
            overallReasoning: result.overallReasoning || 'Perplexity analysis completed',
            citations: response.citations || [],
            processingTimeMs: Date.now() - startTime
          };
        } catch (fixError) {
          console.error('[Perplexity Arbitration] JSON fix attempt failed:', fixError);
        }
        
        // Fall back to algorithmic ranking if parsing fails
        console.log('[Arbitration] Using fallback algorithmic ranking');
        return this.fallbackArbitration(claims, userBias, Date.now() - startTime);
      }
    } catch (error) {
      console.error('[Perplexity Arbitration] Error during arbitration:', error);
      // Fall back to algorithmic ranking on error
      return this.fallbackArbitration(claims, userBias, Date.now() - startTime);
    }
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
        claim.metadata.hasParent = relationships?.parents && relationships.parents.length > 0;
        claim.metadata.ultimateParentLei = relationships?.ultimateParent?.lei;
      }
    }

    // Check if ranking rules are muted for testing
    if (userBias.muteRankingRules) {
      console.log('[Perplexity Arbitration] Ranking rules MUTED for testing');
      const prompt = `
You are an entity arbitrator. For TESTING PURPOSES, ranking rules are DISABLED.

Domain being analyzed: ${domain}

## Claims to Evaluate

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
- Headquarters: ${c.metadata?.headquarters?.city || 'Unknown'}, ${c.metadata?.headquarters?.country || 'Unknown'}
`).join('\n')}

## TESTING MODE - NO RANKING RULES

Since ranking rules are muted, evaluate all entities EQUALLY without applying any preferences for:
- Parent/subsidiary relationships
- Jurisdiction preferences
- Entity status
- Legal form
- Data recency

Simply list all entities with equal consideration, focusing only on:
1. Whether the entity has a valid LEI code
2. Basic entity information accuracy
3. Relationship to the domain

Return a JSON object with:
{
  "rankedEntities": [array of all entities with equal treatment],
  "overallReasoning": "Testing mode - all entities evaluated equally without ranking bias",
  "citations": [any relevant sources you find]
}
`;
      return prompt;
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
      "claimNumber": 3,
      "entityName": "Full Legal Name from GLEIF",
      "leiCode": "20-character LEI code",
      "confidence": 0.95,
      "reasoning": "Ultimate parent entity, US jurisdiction, active status, recently updated",
      "acquisitionGrade": "A+"
    },
    {
      "rank": 2,
      "claimNumber": 1,
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

    // Check if ranking rules are muted
    if (userBias.muteRankingRules) {
      console.log('[Arbitration] Ranking rules MUTED - returning entities with equal scores');
      
      // Return all GLEIF claims with equal scores
      const gleifClaims = claims.filter(c => c.claimNumber > 0);
      const rankedEntities: RankedEntity[] = gleifClaims.map((claim, index) => ({
        rank: index + 1,
        claimNumber: claim.claimNumber,
        entityName: claim.entityName,
        leiCode: claim.leiCode,
        confidence: 0.5, // Equal confidence for all
        reasoning: `Testing mode - Entity evaluated without ranking bias. LEI: ${claim.leiCode || 'N/A'}, Status: ${claim.metadata?.entityStatus || 'Unknown'}`,
        acquisitionGrade: 'N/A (Testing)',
        metadata: claim.metadata
      }));

      return {
        rankedEntities: rankedEntities.slice(0, 5), // Still limit to top 5 for display
        overallReasoning: 'TESTING MODE: All entities evaluated equally without ranking rules. No preferences applied for parent/subsidiary relationships, jurisdictions, entity status, or other factors.',
        citations: [],
        processingTimeMs: elapsedMs
      };
    }

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
      claimNumber: item.claim.claimNumber,
      entityName: item.claim.entityName,
      leiCode: item.claim.leiCode,
      confidence: Math.min(item.score, 1.0),
      reasoning: this.generateFallbackReasoning(item.claim, userBias),
      acquisitionGrade: this.calculateGrade(item.score),
      metadata: item.claim.metadata
    }));

    // Detailed overall reasoning explaining the ranking logic
    const overallReasoning = `
ARBITRATION DECISION SUMMARY:
${rankedEntities.length} entities ranked based on acquisition suitability using the following weighted criteria:

1. PARENT HIERARCHY (${(userBias.parentWeight * 100).toFixed(0)}% weight):
   - Ultimate parents ranked highest for acquisition control
   - Subsidiaries demoted as they require parent approval
   
2. JURISDICTION BIAS (${(userBias.jurisdictionWeight * 100).toFixed(0)}% weight):
   - Primary: ${userBias.jurisdictionPrimary} (+30% boost)
   - Secondary: ${userBias.jurisdictionSecondary.join(', ')} (+15% boost)
   - Other jurisdictions receive no boost
   
3. ENTITY STATUS (${(userBias.entityStatusWeight * 100).toFixed(0)}% weight):
   - Only ACTIVE entities considered viable for acquisition
   
4. LEGAL FORM (${(userBias.legalFormWeight * 100).toFixed(0)}% weight):
   - Corporate structures (Inc, Corp, Ltd) preferred
   
5. DATA RECENCY (${(userBias.recencyWeight * 100).toFixed(0)}% weight):
   - Recent updates indicate active regulatory compliance

Top ranked entity: ${rankedEntities[0]?.entityName || 'None'} 
Acquisition Grade: ${rankedEntities[0]?.acquisitionGrade || 'N/A'}
Key Factor: ${rankedEntities[0]?.metadata?.hierarchyLevel === 'ultimate_parent' ? 'Ultimate parent with full control' : 
              rankedEntities[0]?.metadata?.hierarchyLevel === 'parent' ? 'Parent entity with subsidiaries' : 
              'Entity prioritized based on jurisdiction and status'}
    `.trim();

    return {
      rankedEntities,
      overallReasoning,
      citations: [],
      processingTimeMs: elapsedMs
    };
  }

  private generateFallbackReasoning(claim: any, userBias: UserBias): string {
    const reasons = [];
    const scoreBreakdown = [];
    
    // Hierarchy Analysis
    if (claim.metadata?.hierarchyLevel === 'ultimate_parent') {
      reasons.push('ULTIMATE PARENT - This is the top-level decision-making entity');
      scoreBreakdown.push(`+${(userBias.parentWeight * 100).toFixed(0)}% for ultimate parent status`);
    } else if (claim.metadata?.hierarchyLevel === 'parent') {
      reasons.push('PARENT ENTITY - Has subsidiaries but may itself be owned');
      scoreBreakdown.push(`+${(userBias.parentWeight * 0.7 * 100).toFixed(0)}% for parent status`);
    } else if (claim.metadata?.hasParent) {
      reasons.push('SUBSIDIARY - Owned by another entity, not ideal for acquisition');
      scoreBreakdown.push('No bonus for subsidiary status');
    } else {
      reasons.push('INDEPENDENT ENTITY - No parent/subsidiary relationships found');
    }
    
    // Jurisdiction Analysis
    if (claim.metadata?.jurisdiction === userBias.jurisdictionPrimary) {
      reasons.push(`PRIMARY JURISDICTION (${userBias.jurisdictionPrimary}) - Matches preferred acquisition market`);
      scoreBreakdown.push(`+${(userBias.jurisdictionWeight * 100).toFixed(0)}% for primary jurisdiction`);
    } else if (userBias.jurisdictionSecondary?.includes(claim.metadata?.jurisdiction)) {
      reasons.push(`SECONDARY JURISDICTION (${claim.metadata?.jurisdiction}) - Acceptable but not primary target`);
      scoreBreakdown.push(`+${(userBias.jurisdictionWeight * 0.5 * 100).toFixed(0)}% for secondary jurisdiction`);
    } else if (claim.metadata?.jurisdiction) {
      reasons.push(`OTHER JURISDICTION (${claim.metadata?.jurisdiction}) - Outside preferred markets`);
      scoreBreakdown.push('No jurisdiction bonus');
    }
    
    // Entity Status
    if (claim.metadata?.entityStatus === 'ACTIVE') {
      reasons.push('ACTIVE STATUS - Entity is currently operational');
      scoreBreakdown.push(`+${(userBias.entityStatusWeight * 100).toFixed(0)}% for active status`);
    } else if (claim.metadata?.entityStatus) {
      reasons.push(`${claim.metadata.entityStatus} STATUS - May indicate merger, dissolution, or inactivity`);
      scoreBreakdown.push('No bonus for inactive status');
    }
    
    // Legal Form Analysis
    const legalForm = claim.metadata?.legalForm || '';
    const corporateForms = ['XTIQ', 'XDLC', '8888', 'CORP', 'INC'];
    if (corporateForms.some(form => legalForm.includes(form))) {
      reasons.push(`CORPORATION (${legalForm}) - Standard corporate structure suitable for acquisition`);
      scoreBreakdown.push(`+${(userBias.legalFormWeight * 100).toFixed(0)}% for corporate form`);
    } else if (legalForm) {
      reasons.push(`LEGAL FORM: ${legalForm}`);
    }
    
    // Data Recency
    if (claim.metadata?.lastUpdateDate) {
      const monthsAgo = (Date.now() - new Date(claim.metadata.lastUpdateDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsAgo < 12) {
        reasons.push('RECENTLY UPDATED - Data verified within last year');
        scoreBreakdown.push(`+${(userBias.recencyWeight * 100).toFixed(0)}% for recent data`);
      } else if (monthsAgo < 36) {
        reasons.push('MODERATELY RECENT - Data from last 3 years');
        scoreBreakdown.push(`+${(userBias.recencyWeight * 0.5 * 100).toFixed(0)}% for moderate recency`);
      } else {
        reasons.push(`OUTDATED - Last updated ${Math.floor(monthsAgo / 12)} years ago`);
        scoreBreakdown.push('No recency bonus');
      }
    }
    
    // Headquarters Location
    if (claim.metadata?.headquarters?.city) {
      reasons.push(`HEADQUARTERS: ${claim.metadata.headquarters.city}, ${claim.metadata.headquarters.country || ''}`);
    }
    
    // Combine reasoning with score breakdown
    const fullReasoning = reasons.join(' | ');
    const scoreExplanation = scoreBreakdown.length > 0 ? ` [Score factors: ${scoreBreakdown.join(', ')}]` : '';
    
    return fullReasoning + scoreExplanation;
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