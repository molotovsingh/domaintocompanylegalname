import { db } from './database-wrapper';
import { GLEIFSearchService } from '../gleif-search/gleifSearchService';
import { OpenRouterAdapter } from '../cleaning/modelAdapters/openRouterAdapter';

interface Claim {
  claimNumber: number;
  claimType: 'llm_extracted' | 'gleif_candidate';
  entityName: string;
  leiCode?: string;
  confidence: number;
  source: string;
  metadata?: any;
}

interface CleanedDump {
  id: number;
  domain: string;
  cleanedData?: any;
  collectionType: string;
}

export class ClaimsGenerationService {
  private gleifService: GLEIFSearchService;
  private modelAdapter: OpenRouterAdapter | null = null;

  constructor() {
    this.gleifService = new GLEIFSearchService();
    this.initializeAdapter();
  }

  private initializeAdapter(): void {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      this.modelAdapter = new OpenRouterAdapter(
        apiKey,
        'deepseek-chat',
        'deepseek/deepseek-chat',
        true, // isFree
        0.14 // costPer1kTokens
      );
    } else {
      console.warn('[ClaimsGenerationService] No OpenRouter API key found');
    }
  }

  /**
   * Generate Claim 0 from the cleaned website dump
   * This represents what the website claims to be
   */
  async generateBaseClaim(dump: CleanedDump): Promise<Claim> {
    console.log('[Arbitration] Generating Claim 0 from cleaned dump');
    
    // First, try to get entity from existing cleaned data
    let entityName = null;
    let source = 'unknown';
    let confidence = 0.5;

    // Check if we have cleaned data with extracted entity
    if (dump.cleanedData) {
      // Try different extraction sources in order of preference
      if (dump.cleanedData.primaryEntityName) {
        entityName = dump.cleanedData.primaryEntityName;
        source = 'llm_primary_entity';
        confidence = 0.9;
      } else if (dump.cleanedData.baseEntityName) {
        entityName = dump.cleanedData.baseEntityName;
        source = 'llm_base_entity';
        confidence = 0.8;
      } else if (dump.cleanedData.companyName) {
        entityName = dump.cleanedData.companyName;
        source = 'page_extraction';
        confidence = 0.7;
      }
    }

    // If no entity found in cleaned data, extract from raw dump
    if (!entityName) {
      entityName = await this.extractEntityFromDump(dump);
      source = 'fallback_extraction';
      confidence = 0.5;
    }

    // Create Claim 0
    const claim: Claim = {
      claimNumber: 0,
      claimType: 'llm_extracted',
      entityName: entityName || dump.domain.replace(/\.(com|org|net|io|co|ai)$/, ''),
      leiCode: undefined, // Claim 0 doesn't have LEI yet
      confidence,
      source,
      metadata: {
        domain: dump.domain,
        collectionType: dump.collectionType,
        dumpId: dump.id,
        extractionMethod: source
      }
    };

    console.log(`[Arbitration] Claim 0 generated: ${claim.entityName} (confidence: ${claim.confidence})`);
    return claim;
  }

  /**
   * Generate Claims 1-N from GLEIF search results
   */
  async generateGleifClaims(entityName: string, domain?: string): Promise<Claim[]> {
    console.log(`[Arbitration] Generating GLEIF claims for: ${entityName}`);
    
    const claims: Claim[] = [];
    
    // Search GLEIF with the entity name
    const gleifSearchResult = await this.gleifService.searchGLEIF(entityName, domain);
    const gleifResults = gleifSearchResult.entities;
    
    if (!gleifResults || gleifResults.length === 0) {
      console.log('[Arbitration] No GLEIF results found');
      return claims;
    }

    // Convert GLEIF results to claims
    gleifResults.forEach((result, index) => {
      const claim: Claim = {
        claimNumber: index + 1, // Claims 1-N
        claimType: 'gleif_candidate',
        entityName: result.legalName,
        leiCode: result.leiCode,
        confidence: this.calculateGleifConfidence(result, entityName),
        source: 'gleif_api',
        metadata: {
          jurisdiction: result.jurisdiction,
          entityStatus: result.entityStatus,
          legalForm: result.legalForm,
          headquarters: result.headquarters,
          legalAddress: result.legalAddress,
          registrationStatus: result.registrationStatus,
          lastUpdateDate: result.lastUpdateDate,
          searchScore: result.weightedTotalScore || 0,
          relationships: result.relationships
        }
      };
      claims.push(claim);
    });

    console.log(`[Arbitration] Generated ${claims.length} GLEIF claims`);
    return claims;
  }

  /**
   * Combine all claims for a domain
   */
  async assembleClaims(dump: CleanedDump): Promise<Claim[]> {
    console.log(`[Arbitration] Assembling all claims for domain: ${dump.domain}`);
    
    // Generate Claim 0
    const baseClaim = await this.generateBaseClaim(dump);
    
    // Generate GLEIF claims based on Claim 0's entity name
    const gleifClaims = await this.generateGleifClaims(baseClaim.entityName, dump.domain);
    
    // Combine all claims
    const allClaims = [baseClaim, ...gleifClaims];
    
    console.log(`[Arbitration] Total claims assembled: ${allClaims.length}`);
    return allClaims;
  }

  /**
   * Store claims in database
   */
  async storeClaims(requestId: number, claims: Claim[]): Promise<void> {
    for (const claim of claims) {
      await db.query(`
        INSERT INTO arbitration_claims (
          request_id, claim_number, claim_type, entity_name, 
          lei_code, confidence_score, source, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `, [
        requestId,
        claim.claimNumber,
        claim.claimType,
        claim.entityName,
        claim.leiCode,
        claim.confidence,
        claim.source,
        JSON.stringify(claim.metadata || {})
      ]);
    }
  }

  /**
   * Extract entity name from raw dump using LLM
   */
  private async extractEntityFromDump(dump: CleanedDump): Promise<string | null> {
    try {
      // Get the raw dump data based on collection type
      let rawContent = '';
      
      if (dump.collectionType === 'playwright_dump') {
        const result = await db.query(
          'SELECT dump_data FROM playwright_dumps WHERE id = $1',
          [dump.id]
        );
        if (result.rows[0]?.dump_data?.pages?.[0]) {
          rawContent = result.rows[0].dump_data.pages[0].title || '';
          if (result.rows[0].dump_data.pages[0].metaTags?.['og:site_name']) {
            rawContent = result.rows[0].dump_data.pages[0].metaTags['og:site_name'];
          }
        }
      } else if (dump.collectionType === 'crawlee_dump') {
        const result = await db.query(
          'SELECT dump_data FROM crawlee_dumps WHERE id = $1',
          [dump.id]
        );
        if (result.rows[0]?.dump_data?.pages?.[0]) {
          rawContent = result.rows[0].dump_data.pages[0].title || '';
        }
      }

      if (!rawContent) {
        return null;
      }

      // Use DeepSeek to extract entity name
      const prompt = `Extract the primary company or organization name from this text. Return ONLY the company name, nothing else:\n\n${rawContent.substring(0, 500)}`;
      
      if (this.modelAdapter) {
        const response = await this.modelAdapter.clean(prompt, 0.3);
        if (response.success && response.cleanedContent) {
          return response.cleanedContent.trim();
        }
      }

      return null;
    } catch (error) {
      console.error('[Arbitration] Error extracting entity from dump:', error);
      return null;
    }
  }

  /**
   * Calculate confidence score for GLEIF results
   */
  private calculateGleifConfidence(gleifResult: any, searchTerm: string): number {
    let confidence = 0.5; // Base confidence
    
    // Exact match bonus
    if (gleifResult.legalName.toLowerCase() === searchTerm.toLowerCase()) {
      confidence += 0.3;
    }
    // Contains search term
    else if (gleifResult.legalName.toLowerCase().includes(searchTerm.toLowerCase())) {
      confidence += 0.2;
    }
    
    // Active entity bonus
    if (gleifResult.entityStatus === 'ACTIVE') {
      confidence += 0.1;
    }
    
    // Recently updated bonus
    if (gleifResult.lastUpdateDate) {
      const lastUpdate = new Date(gleifResult.lastUpdateDate);
      const monthsAgo = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsAgo < 12) {
        confidence += 0.05;
      }
    }
    
    // Search score bonus (if available from GLEIF weighted score)
    if (gleifResult.weightedTotalScore && gleifResult.weightedTotalScore > 0.8) {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0); // Cap at 1.0
  }
}

export const claimsGenerationService = new ClaimsGenerationService();