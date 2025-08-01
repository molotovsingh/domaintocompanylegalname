import { OpenRouterService } from './openRouterService';

// Each entity claim represents a valid association between domain and entity
interface EntityClaim {
  entityName: string;
  claimType: 'website_operator' | 'parent_company' | 'subsidiary' | 'ip_holder' | 'regional_entity' | 'mentioned_entity';
  evidence: {
    source: string; // Where found: privacy_policy, copyright, terms, about_page, etc.
    text: string; // Actual text excerpt
    context: string; // Surrounding context
  };
  relationship: string; // Description of relationship to domain
  confidence: number; // Raw confidence before bias
  leiCode?: string; // If found via GLEIF
  jurisdiction?: string;
  reasoning: string;
}

interface EntityClaimsResult {
  domain: string;
  claims: EntityClaim[];
  metadata: {
    extractionMethod: string;
    processingTime: number;
    dataCompleteness: number; // 0-1 score of how much data we have
  };
}

interface EntityClaimsInput {
  rawText: string;
  domain: string;
  existingData?: any; // Stage 2 extracted data
  gleifData?: any[]; // GLEIF search results if available
}

class EntityClaimsService {
  private readonly primaryModel = 'mistralai/mistral-nemo';
  private readonly fallbackModel = 'meta-llama/llama-3.1-8b-instruct:free';
  private openRouterService: OpenRouterService;

  constructor() {
    this.openRouterService = new OpenRouterService();
  }

  /**
   * Generate multiple entity claims from website data
   * This replaces single entity extraction with comprehensive claims generation
   */
  async generateEntityClaims(input: EntityClaimsInput): Promise<EntityClaimsResult | null> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildClaimsPrompt(input);
      
      // Try primary model first
      let response = await this.callModel(prompt, this.primaryModel);
      
      // Fallback to free model if primary fails
      if (!response) {
        console.log('[EntityClaims] Primary model failed, trying fallback');
        response = await this.callModel(prompt, this.fallbackModel);
      }
      
      if (!response) {
        console.error('[EntityClaims] All models failed');
        return null;
      }
      
      // Enrich with GLEIF data if available
      if (input.gleifData && input.gleifData.length > 0) {
        response.claims = this.enrichWithGLEIFClaims(response.claims, input.gleifData);
      }
      
      response.metadata.processingTime = Date.now() - startTime;
      return response;
    } catch (error) {
      console.error('[EntityClaims] Error:', error);
      return null;
    }
  }

  private buildClaimsPrompt(input: EntityClaimsInput): string {
    const existingDataStr = input.existingData 
      ? `\nExisting extracted data:\n${JSON.stringify(input.existingData, null, 2)}`
      : '';

    return `You are a legal entity claims specialist. Your job is to identify ALL possible legal entities associated with this domain and build evidence-based claims for each.

CRITICAL APPROACH:
1. DO NOT pick a "winner" - present ALL valid entity associations
2. Extract EXACTLY what appears on the website - no inference or correction
3. Build a claim for each entity found with supporting evidence
4. Include parent companies, subsidiaries, operators, IP holders - any mentioned entity
5. Preserve exact legal names with their suffixes as written

Domain: ${input.domain}${existingDataStr}

Raw text excerpt:
${input.rawText.substring(0, 8000)}

SEARCH FOR:
- Copyright notices: "© 2024 [Entity]"
- Privacy policy entities: "operated by [Entity]", "data controller: [Entity]"
- Terms of service entities
- About page mentions
- Footer legal information
- Contact page entities
- Any legal entity names with suffixes (Inc., LLC, Ltd., GmbH, N.V., S.A., etc.)

IMPORTANT: 
- If you see "© QIAGEN", create a claim for "QIAGEN" exactly as written
- If privacy policy says "QIAGEN GmbH", create a separate claim for "QIAGEN GmbH"
- Do NOT combine or deduplicate - each mention is a separate claim

Return a comprehensive JSON with ALL entity claims:
{
  "domain": "${input.domain}",
  "claims": [
    {
      "entityName": "exact name as found",
      "claimType": "website_operator|parent_company|subsidiary|ip_holder|regional_entity|mentioned_entity",
      "evidence": {
        "source": "where found (privacy_policy|copyright|terms|footer|about)",
        "text": "exact text excerpt showing the entity",
        "context": "surrounding text for context"
      },
      "relationship": "description of how this entity relates to the domain",
      "confidence": 0.8,
      "jurisdiction": "if determinable from context",
      "reasoning": "why this claim exists"
    }
  ],
  "metadata": {
    "extractionMethod": "literal_extraction",
    "processingTime": 0,
    "dataCompleteness": 0.75
  }
}`;
  }

  private async callModel(prompt: string, model: string): Promise<EntityClaimsResult | null> {
    try {
      const response = await this.openRouterService.makeRequest({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000, // Increased for multiple claims
        temperature: 0.1
      });
      
      if (!response || !response.content) {
        return null;
      }
      
      // Parse JSON response
      try {
        const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.content.trim();
        
        const parsed = JSON.parse(jsonStr);
        
        // Validate structure
        if (!parsed.claims || !Array.isArray(parsed.claims)) {
          console.error('[EntityClaims] Invalid response structure');
          return null;
        }
        
        return parsed;
      } catch (parseError) {
        console.error('[EntityClaims] Failed to parse response:', response.content);
        return null;
      }
    } catch (error) {
      console.error('[EntityClaims] Model call error:', error);
      return null;
    }
  }

  /**
   * Enrich claims with GLEIF parent-child relationships
   */
  private enrichWithGLEIFClaims(
    existingClaims: EntityClaim[], 
    gleifData: any[]
  ): EntityClaim[] {
    const enrichedClaims = [...existingClaims];
    
    for (const gleifEntity of gleifData) {
      // Add parent company claims
      if (gleifEntity.relationships?.ultimateParent) {
        enrichedClaims.push({
          entityName: gleifEntity.relationships.ultimateParent.legalName,
          claimType: 'parent_company',
          evidence: {
            source: 'gleif_database',
            text: `Ultimate parent of ${gleifEntity.legalName}`,
            context: 'GLEIF registered parent-child relationship'
          },
          relationship: `Ultimate parent company of ${gleifEntity.legalName}`,
          confidence: 0.9,
          leiCode: gleifEntity.relationships.ultimateParent.leiCode,
          jurisdiction: gleifEntity.relationships.ultimateParent.jurisdiction,
          reasoning: 'GLEIF verified parent-child relationship'
        });
      }
      
      // Add the GLEIF entity itself if not already in claims
      const gleifEntityExists = existingClaims.some(
        claim => claim.entityName.toLowerCase() === gleifEntity.legalName.toLowerCase()
      );
      
      if (!gleifEntityExists) {
        enrichedClaims.push({
          entityName: gleifEntity.legalName,
          claimType: 'mentioned_entity',
          evidence: {
            source: 'gleif_search',
            text: `GLEIF registered entity matching domain search`,
            context: `LEI: ${gleifEntity.leiCode}`
          },
          relationship: 'GLEIF registered entity potentially associated with domain',
          confidence: 0.7,
          leiCode: gleifEntity.leiCode,
          jurisdiction: gleifEntity.jurisdiction,
          reasoning: 'Found via GLEIF search based on domain/entity matching'
        });
      }
    }
    
    return enrichedClaims;
  }
}

export { EntityClaimsService, EntityClaim, EntityClaimsResult, EntityClaimsInput };