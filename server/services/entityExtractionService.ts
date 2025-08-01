import { OpenRouterService } from './openRouterService';

interface EntityExtractionResult {
  entityName: string;
  confidence: number;
  reasoning: string;
  alternativeNames?: string[];
}

interface EntityExtractionInput {
  rawText: string;
  domain: string;
  existingData?: any; // Stage 2 extracted data
}

class EntityExtractionService {
  private readonly primaryModel = 'mistralai/mistral-nemo'; // Good balance of cost/performance
  private readonly fallbackModel = 'meta-llama/llama-3.1-8b-instruct:free'; // Free fallback
  private openRouterService: OpenRouterService;

  constructor() {
    this.openRouterService = new OpenRouterService();
  }

  /**
   * Extract legal entity name from processed data
   * This is Stage 3 of the processing pipeline
   */
  async extractLegalEntity(input: EntityExtractionInput): Promise<EntityExtractionResult | null> {
    try {
      const prompt = this.buildEntityPrompt(input);
      
      // Try primary model first
      let response = await this.callModel(prompt, this.primaryModel);
      
      // Fallback to free model if primary fails
      if (!response) {
        console.log('[EntityExtraction] Primary model failed, trying fallback');
        response = await this.callModel(prompt, this.fallbackModel);
      }
      
      if (!response) {
        console.error('[EntityExtraction] All models failed');
        return null;
      }
      
      return response;
    } catch (error) {
      console.error('[EntityExtraction] Error:', error);
      return null;
    }
  }

  private buildEntityPrompt(input: EntityExtractionInput): string {
    const existingDataStr = input.existingData 
      ? `\nExisting extracted data:\n${JSON.stringify(input.existingData, null, 2)}`
      : '';

    return `You are a legal entity extraction specialist. Extract the official legal entity name from the provided website data.

CRITICAL RULES:
1. Return the COMPLETE legal name with proper suffix (Inc., LLC, Ltd., Corp., GmbH, S.A., etc.)
2. Remove ALL marketing taglines, slogans, and descriptive phrases
3. Prefer names from legal notices, copyright statements, terms of service, or footer sections
4. If multiple entities exist, return the primary operating entity for the domain
5. Handle international entities with their proper legal suffixes
6. DO NOT add suffixes unless they are explicitly present in the source

Domain: ${input.domain}${existingDataStr}

Raw text excerpt:
${input.rawText.substring(0, 5000)}

IMPORTANT: Look for patterns like:
- "© 2024 [Company Name]"
- "Copyright [Company Name]"
- "[Company Name], a Delaware corporation"
- "operated by [Company Name]"
- Legal entity names in Terms of Service or Privacy Policy

Return ONLY valid JSON in this exact format:
{
  "entityName": "exact legal entity name with suffix",
  "confidence": 0.95,
  "reasoning": "brief explanation of where found and why chosen",
  "alternativeNames": ["other potential entity names found"]
}`;
  }

  private async callModel(prompt: string, model: string): Promise<EntityExtractionResult | null> {
    try {
      const response = await this.openRouterService.makeRequest({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.1 // Low temperature for consistency
      });
      
      if (!response || !response.content) {
        return null;
      }
      
      // Parse JSON response
      try {
        // Extract JSON from potential markdown blocks
        const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.content.trim();
        
        const parsed = JSON.parse(jsonStr);
        
        // Validate required fields
        if (!parsed.entityName || typeof parsed.confidence !== 'number') {
          console.error('[EntityExtraction] Invalid response structure');
          return null;
        }
        
        return {
          entityName: parsed.entityName,
          confidence: Math.max(0, Math.min(1, parsed.confidence)),
          reasoning: parsed.reasoning || 'No reasoning provided',
          alternativeNames: Array.isArray(parsed.alternativeNames) ? parsed.alternativeNames : []
        };
      } catch (parseError) {
        console.error('[EntityExtraction] Failed to parse response:', response.content);
        return null;
      }
    } catch (error) {
      console.error(`[EntityExtraction] Model ${model} failed:`, error);
      return null;
    }
  }

  /**
   * Quick confidence check for an entity name
   */
  validateEntityName(entityName: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check for common issues
    if (entityName.length < 2) {
      issues.push('Name too short');
    }
    
    if (entityName.length > 200) {
      issues.push('Name too long');
    }
    
    // Check for marketing phrases that shouldn't be in legal names
    const marketingPhrases = [
      'the best', 'world\'s', 'leading', 'premium', 'think different',
      'just do it', 'impossible is nothing', 'because you\'re worth it'
    ];
    
    const lowerName = entityName.toLowerCase();
    for (const phrase of marketingPhrases) {
      if (lowerName.includes(phrase)) {
        issues.push(`Contains marketing phrase: "${phrase}"`);
      }
    }
    
    // Check for valid suffix
    const validSuffixes = [
      'inc', 'incorporated', 'corp', 'corporation', 'llc', 'ltd', 'limited',
      'plc', 'gmbh', 'ag', 'sa', 's.a.', 'srl', 'bv', 'nv', 'pty', 'pvt',
      'co', 'company', 'lp', 'llp', 'partnership'
    ];
    
    const hasSuffix = validSuffixes.some(suffix => 
      lowerName.endsWith(` ${suffix}`) || 
      lowerName.endsWith(` ${suffix}.`) ||
      lowerName.endsWith(`, ${suffix}`) ||
      lowerName.endsWith(`, ${suffix}.`)
    );
    
    if (!hasSuffix && !lowerName.includes(' ')) {
      issues.push('Missing legal suffix (Inc., LLC, Ltd., etc.)');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const entityExtractionService = new EntityExtractionService();