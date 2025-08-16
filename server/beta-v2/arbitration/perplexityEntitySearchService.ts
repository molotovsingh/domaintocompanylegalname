/**
 * Perplexity Entity Search Service
 * 
 * Purpose: When GLEIF returns no matches, use Perplexity's web search
 * capabilities to find entity information about the domain.
 * This creates additional claims to prevent single-claim arbitrations.
 */

import { Claim } from './types';

interface PerplexityEntitySearchResult {
  entityName: string;
  confidence: number;
  evidence: string[];
  source: string;
  legalForm?: string;
  jurisdiction?: string;
  headquarters?: {
    city?: string;
    country?: string;
  };
}

export class PerplexityEntitySearchService {
  private apiKey: string;
  private apiUrl = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Perplexity Entity Search] No API key configured');
    }
  }

  /**
   * Search for entity information using Perplexity when GLEIF has no matches
   */
  async searchForEntity(domain: string, baseEntityName?: string): Promise<Claim[]> {
    if (!this.apiKey) {
      console.log('[Perplexity Entity Search] Skipped - no API key');
      return [];
    }

    console.log(`[Perplexity Entity Search] Searching for entity information for domain: ${domain}`);
    
    try {
      const searchQuery = this.buildSearchQuery(domain, baseEntityName);
      const result = await this.performSearch(searchQuery);
      
      if (!result) {
        return [];
      }

      // Convert search result to Claim format
      const claim: Claim = {
        claimNumber: 1, // This will be Claim 1 when GLEIF has no matches
        claimType: 'perplexity_search' as any,
        entityName: result.entityName,
        leiCode: undefined, // Perplexity won't have LEI codes
        confidence: result.confidence,
        source: 'perplexity_web_search',
        metadata: {
          searchEvidence: result.evidence,
          sourceUrl: result.source,
          legalForm: result.legalForm,
          jurisdiction: result.jurisdiction,
          headquarters: result.headquarters,
          searchMethod: 'web_search',
          query: searchQuery
        }
      };

      console.log(`[Perplexity Entity Search] Found entity: ${result.entityName} (confidence: ${result.confidence})`);
      return [claim];

    } catch (error) {
      console.error('[Perplexity Entity Search] Error:', error);
      return [];
    }
  }

  private buildSearchQuery(domain: string, baseEntityName?: string): string {
    if (baseEntityName) {
      return `What is the official legal entity name of ${baseEntityName} that operates the website ${domain}? Include the company's legal form (Inc., LLC, Ltd., etc.), jurisdiction, and headquarters location.`;
    }
    return `What is the official legal entity name that owns or operates the website ${domain}? Include the company's legal form (Inc., LLC, Ltd., etc.), jurisdiction, and headquarters location.`;
  }

  private async performSearch(query: string): Promise<PerplexityEntitySearchResult | null> {
    const systemPrompt = `You are an entity extraction expert. Extract the official legal entity name from web search results.
Focus on finding:
1. The exact legal entity name with proper suffix (Inc., LLC, Ltd., etc.)
2. The jurisdiction/country of incorporation
3. The headquarters location
4. Evidence supporting your findings

Return your response in this exact JSON format:
{
  "entityName": "Company Name Inc.",
  "confidence": 0.8,
  "evidence": ["Found on official website", "Registered in Delaware"],
  "source": "URL or source description",
  "legalForm": "Corporation",
  "jurisdiction": "US-DE",
  "headquarters": {
    "city": "San Francisco",
    "country": "US"
  }
}`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: query
            }
          ],
          temperature: 0.2,
          top_p: 0.9,
          search_domain_filter: [],
          return_images: false,
          return_related_questions: false,
          search_recency_filter: 'month',
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        return null;
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[Perplexity Entity Search] No JSON found in response');
        return null;
      }

      const result = JSON.parse(jsonMatch[0]);
      
      // Add citations as evidence if available
      if (data.citations && data.citations.length > 0) {
        result.evidence = result.evidence || [];
        result.evidence.push(...data.citations.slice(0, 3)); // Add top 3 citations
      }

      return result;

    } catch (error) {
      console.error('[Perplexity Entity Search] API call failed:', error);
      return null;
    }
  }

  /**
   * Check if Perplexity search should be used
   * Use when GLEIF returns no matches or very low confidence matches
   */
  shouldUsePerplexitySearch(gleifClaims: Claim[]): boolean {
    if (gleifClaims.length === 0) {
      return true; // No GLEIF matches at all
    }

    // Check if all GLEIF claims have very low confidence
    const maxConfidence = Math.max(...gleifClaims.map(c => c.confidence || 0));
    if (maxConfidence < 0.3) {
      return true; // All GLEIF matches are poor quality
    }

    return false;
  }
}