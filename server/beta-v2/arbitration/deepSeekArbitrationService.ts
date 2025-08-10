import { OpenRouterService } from '../../services/openRouterService.js';
import { GleifRelationshipsService } from '../gleif/gleifRelationshipsService.js';
import { db } from './database-wrapper.js';

export interface RankedEntity {
  rank: number;
  entityName: string;
  leiCode: string;
  confidence: number;
  reasoning: string;
  acquisitionGrade: string;
  metadata?: any;
}

export interface ArbitrationResult {
  rankedEntities: RankedEntity[];
  overallReasoning: string;
  detailedThinking?: string;  // DeepSeek R1's transparent thinking process
  citations: string[];
  processingTimeMs: number;
}

export interface UserBias {
  jurisdictionPrimary: string;
  jurisdictionSecondary: string[];
  preferParent: boolean;
  parentWeight: number;
  jurisdictionWeight: number;
  entityStatusWeight: number;
  legalFormWeight: number;
  recencyWeight: number;
}

export class DeepSeekArbitrationService {
  private openRouterService: OpenRouterService;
  private relationshipsService: GleifRelationshipsService;

  constructor() {
    this.openRouterService = new OpenRouterService();
    this.relationshipsService = new GleifRelationshipsService();
  }

  /**
   * Main arbitration method using DeepSeek R1 reasoning
   */
  async arbitrate(claims: any[], userBias: UserBias): Promise<ArbitrationResult> {
    const startTime = Date.now();
    console.log(`[DeepSeek Arbitration] Starting arbitration for ${claims.length} claims`);

    try {
      // Enrich claims with relationship data
      await this.enrichClaimsWithRelationships(claims);

      // Build the reasoning prompt
      const prompt = await this.buildReasoningPrompt(claims, userBias);

      // Call DeepSeek R1 through OpenRouter
      const response = await this.callDeepSeekReasoning(prompt);

      if (!response || !response.success) {
        console.log('[DeepSeek Arbitration] DeepSeek unavailable, using fallback ranking');
        return this.algorithmicArbitration(claims, userBias, Date.now() - startTime);
      }

      // Parse the response
      const result = this.parseDeepSeekResponse(response);
      
      if (!result.rankedEntities || result.rankedEntities.length === 0) {
        console.log('[DeepSeek Arbitration] Could not parse response, using fallback');
        return this.algorithmicArbitration(claims, userBias, Date.now() - startTime);
      }

      console.log(`[DeepSeek Arbitration] Completed in ${Date.now() - startTime}ms`);
      return {
        ...result,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error) {
      console.error('[DeepSeek Arbitration] Error:', error);
      return this.algorithmicArbitration(claims, userBias, Date.now() - startTime);
    }
  }

  /**
   * Call DeepSeek R1 reasoning model through OpenRouter
   */
  private async callDeepSeekReasoning(prompt: string): Promise<any> {
    console.log('[DeepSeek Arbitration] Calling DeepSeek R1 reasoning model');
    
    // Call OpenRouter directly with DeepSeek R1 free model
    try {
      const apiKey = process.env.openrouter;
      if (!apiKey) {
        console.error('[DeepSeek Arbitration] OpenRouter API key not found');
        return null;
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Title': 'Domain Intelligence Platform'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1:free',
          messages: [
            {
              role: 'system',
              content: `You are a corporate acquisition arbitrator with expertise in entity resolution and GLEIF data analysis. 
                       Your role is to rank entities based on their suitability for acquisition, providing detailed reasoning for each decision.
                       Think step-by-step through the corporate hierarchy, jurisdiction preferences, and acquisition factors.
                       Always provide transparent reasoning that would hold up in a board room presentation.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0,
          max_tokens: 8000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DeepSeek Arbitration] API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      console.log('[DeepSeek Arbitration] Response received: Success');
      
      // Extract the content from the response
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error('[DeepSeek Arbitration] No content in response');
        return null;
      }

      return {
        success: true,
        entityName: content,
        modelUsed: 'deepseek/deepseek-r1:free'
      };
    } catch (error) {
      console.error('[DeepSeek Arbitration] API call failed:', error);
      return null;
    }
  }

  /**
   * Build the reasoning prompt for DeepSeek
   */
  private async buildReasoningPrompt(claims: any[], userBias: UserBias): Promise<string> {
    const domain = claims[0]?.metadata?.domain || 'unknown';
    const claim0 = claims.find(c => c.claimNumber === 0);
    const gleifClaims = claims.filter(c => c.claimNumber > 0);

    // Ensure userBias has all required properties with defaults
    const safeUserBias = {
      jurisdictionPrimary: userBias?.jurisdictionPrimary || 'US',
      jurisdictionSecondary: userBias?.jurisdictionSecondary || ['GB', 'CA'],
      preferParent: userBias?.preferParent !== false,
      parentWeight: userBias?.parentWeight || 0.4,
      jurisdictionWeight: userBias?.jurisdictionWeight || 0.3,
      entityStatusWeight: userBias?.entityStatusWeight || 0.1,
      legalFormWeight: userBias?.legalFormWeight || 0.05,
      recencyWeight: userBias?.recencyWeight || 0.05
    };

    const prompt = `
## ARBITRATION TASK: Rank entities for acquisition suitability

You are analyzing entities for the domain: ${domain}

### CLAIMS TO EVALUATE:

**Claim 0 (Website extracted entity):**
- Entity: ${claim0?.entityName || 'Unknown'}
- Confidence: ${claim0?.confidence || 0}
- Source: Website extraction

**GLEIF Verified Claims (${gleifClaims.length} entities):**
${gleifClaims.map(c => `
Claim ${c.claimNumber}:
- Legal Name: ${c.entityName}
- LEI Code: ${c.leiCode}
- Jurisdiction: ${c.gleifData?.jurisdiction || c.metadata?.jurisdiction || 'Unknown'}
- Entity Status: ${c.gleifData?.entityStatus || c.metadata?.entityStatus || 'Unknown'}  
- Legal Form: ${c.gleifData?.legalForm || c.metadata?.legalForm || 'Unknown'}
- Hierarchy Level: ${c.metadata?.hierarchyLevel || 'Unknown'}
- Has Parent: ${c.metadata?.hasParent || false}
- Ultimate Parent LEI: ${c.metadata?.ultimateParentLei || 'None'}
- Headquarters: ${c.gleifData?.headquarters?.city || 'Unknown'}, ${c.gleifData?.headquarters?.country || 'Unknown'}
- Last Updated: ${c.gleifData?.lastUpdateDate || c.metadata?.lastUpdateDate || 'Unknown'}
- Registration Status: ${c.gleifData?.registrationStatus || 'Unknown'}
`).join('\n')}

### RANKING CRITERIA (Apply in this order):

1. **Parent Hierarchy (${(safeUserBias.parentWeight * 100).toFixed(0)}% weight)**
   - Ultimate parent entities must rank highest (they control everything)
   - Parent entities rank second
   - Subsidiaries rank lower (they need parent approval for acquisition)

2. **Jurisdiction Preference (${(safeUserBias.jurisdictionWeight * 100).toFixed(0)}% weight)**
   - Primary: ${safeUserBias.jurisdictionPrimary} (strongly preferred)
   - Secondary: ${safeUserBias.jurisdictionSecondary.join(', ')} (acceptable)
   - Other jurisdictions are less preferred

3. **Entity Status (${(safeUserBias.entityStatusWeight * 100).toFixed(0)}% weight)**
   - Only ACTIVE entities are viable for acquisition
   - INACTIVE or MERGED entities should be excluded or ranked very low

4. **Legal Form (${(safeUserBias.legalFormWeight * 100).toFixed(0)}% weight)**
   - Corporate forms (Inc, Corp, Ltd, XTIQ, XDLC, 8888) are preferred
   - LLCs and other forms are acceptable but less ideal

5. **Data Recency (${(safeUserBias.recencyWeight * 100).toFixed(0)}% weight)**
   - Recently updated entities (within 1 year) are more reliable
   - Older data may be outdated

### REQUIRED OUTPUT FORMAT:

Think through this step-by-step, then provide your ranking in this exact JSON format:

\`\`\`json
{
  "thinking": "Your detailed step-by-step reasoning process here. Explain how you evaluated each entity against the criteria. Be specific about why certain entities rank higher than others.",
  "rankedEntities": [
    {
      "rank": 1,
      "entityName": "Full Legal Name",
      "leiCode": "20-character LEI",
      "confidence": 0.95,
      "reasoning": "Detailed explanation of why this entity ranks #1. Include analysis of hierarchy, jurisdiction, status, etc.",
      "acquisitionGrade": "A+"
    },
    {
      "rank": 2,
      "entityName": "Second Entity Name",
      "leiCode": "LEI code",
      "confidence": 0.85,
      "reasoning": "Explanation for rank #2",
      "acquisitionGrade": "A"
    }
  ],
  "overallReasoning": "Summary of the ranking logic and key factors that determined the order"
}
\`\`\`

### ACQUISITION GRADES:
- **A+**: Ultimate parent entity, ideal jurisdiction, active status
- **A**: Parent entity or key operating company in good jurisdiction
- **B+**: Important subsidiary with strategic value
- **B**: Regional subsidiary or specialized unit
- **C**: Lower-tier subsidiary or non-strategic entity

Remember: For acquisitions, you want to identify the entity with the highest decision-making authority. Subsidiaries are typically not acquired directly - you acquire the parent.

Now, analyze the claims and provide your ranking with detailed reasoning:
`;

    return prompt;
  }

  /**
   * Parse DeepSeek response
   */
  private parseDeepSeekResponse(response: any): ArbitrationResult {
    try {
      // Extract the actual response content
      const content = response.entityName || response.response || response.text || '';
      
      // Look for JSON in the response
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      let parsed: any;
      
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // Try parsing the entire content as JSON
        parsed = JSON.parse(content);
      }

      return {
        rankedEntities: parsed.rankedEntities || [],
        overallReasoning: parsed.overallReasoning || '',
        detailedThinking: parsed.thinking || '',
        citations: [],
        processingTimeMs: 0
      };
    } catch (error) {
      console.error('[DeepSeek Arbitration] Failed to parse response:', error);
      return {
        rankedEntities: [],
        overallReasoning: response.response || response.text || 'Failed to parse reasoning',
        detailedThinking: '',
        citations: [],
        processingTimeMs: 0
      };
    }
  }

  /**
   * Enrich claims with relationship data
   */
  private async enrichClaimsWithRelationships(claims: any[]): Promise<void> {
    const gleifClaims = claims.filter(c => c.claimNumber > 0);
    
    for (const claim of gleifClaims) {
      if (claim.leiCode) {
        try {
          const relationships = await this.relationshipsService.getRelationships(claim.leiCode);
          claim.metadata = claim.metadata || {};
          claim.metadata.hierarchyLevel = await this.relationshipsService.getHierarchyLevel(claim.leiCode);
          claim.metadata.hasParent = relationships?.parents?.length > 0;
          claim.metadata.ultimateParentLei = relationships?.ultimateParent?.lei;
        } catch (error) {
          console.log(`[DeepSeek Arbitration] Could not fetch relationships for ${claim.leiCode}`);
        }
      }
    }
  }

  /**
   * Fallback algorithmic ranking with transparent reasoning
   */
  private async algorithmicArbitration(
    claims: any[], 
    userBias: UserBias, 
    elapsedMs: number
  ): Promise<ArbitrationResult> {
    console.log('[DeepSeek Arbitration] Using fallback algorithmic ranking');

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
          if (claim.gleifData?.jurisdiction === userBias.jurisdictionPrimary) {
            score += userBias.jurisdictionWeight;
          } else if (userBias.jurisdictionSecondary.includes(claim.gleifData?.jurisdiction)) {
            score += userBias.jurisdictionWeight * 0.5;
          }

          // Active status bonus
          if (claim.gleifData?.entityStatus === 'ACTIVE') {
            score += userBias.entityStatusWeight;
          }

          // Legal form bonus
          const legalForm = claim.gleifData?.legalForm || '';
          if (['XTIQ', 'XDLC', '8888'].includes(legalForm)) {
            score += userBias.legalFormWeight;
          }

          // Recency bonus
          if (claim.gleifData?.lastUpdateDate) {
            const monthsAgo = (Date.now() - new Date(claim.gleifData.lastUpdateDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
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

    const overallReasoning = `
ALGORITHMIC ARBITRATION (DeepSeek unavailable):
Ranked ${rankedEntities.length} entities using weighted scoring:
- Parent Hierarchy: ${(userBias.parentWeight * 100).toFixed(0)}%
- Jurisdiction: ${(userBias.jurisdictionWeight * 100).toFixed(0)}%
- Entity Status: ${(userBias.entityStatusWeight * 100).toFixed(0)}%
- Legal Form: ${(userBias.legalFormWeight * 100).toFixed(0)}%
- Data Recency: ${(userBias.recencyWeight * 100).toFixed(0)}%

Top entity: ${rankedEntities[0]?.entityName || 'None'} (${rankedEntities[0]?.acquisitionGrade || 'N/A'})
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
    
    // Hierarchy
    if (claim.metadata?.hierarchyLevel === 'ultimate_parent') {
      reasons.push('ULTIMATE PARENT - Top decision-maker');
    } else if (claim.metadata?.hierarchyLevel === 'parent') {
      reasons.push('PARENT ENTITY - Has subsidiaries');
    } else if (claim.metadata?.hasParent) {
      reasons.push('SUBSIDIARY - Requires parent approval');
    }
    
    // Jurisdiction
    if (claim.gleifData?.jurisdiction === userBias.jurisdictionPrimary) {
      reasons.push(`PRIMARY JURISDICTION (${userBias.jurisdictionPrimary})`);
    } else if (userBias.jurisdictionSecondary?.includes(claim.gleifData?.jurisdiction)) {
      reasons.push(`SECONDARY JURISDICTION (${claim.gleifData?.jurisdiction})`);
    }
    
    // Status
    if (claim.gleifData?.entityStatus === 'ACTIVE') {
      reasons.push('ACTIVE STATUS');
    }
    
    // Headquarters
    if (claim.gleifData?.headquarters?.city) {
      reasons.push(`HQ: ${claim.gleifData.headquarters.city}, ${claim.gleifData.headquarters.country || ''}`);
    }
    
    return reasons.join(' | ');
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
    
    return result.rows[0];
  }
}