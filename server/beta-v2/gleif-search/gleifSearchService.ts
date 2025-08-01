// GLEIF Search Service - Core business logic
import axios from 'axios';
import { 
  GLEIFSearchRequest, 
  GLEIFCandidate, 
  GLEIFApiResponse, 
  GLEIFApiEntity,
  GLEIFAddress,
  TLDMapping 
} from './gleifSearchTypes';

export class GLEIFSearchService {
  private readonly GLEIF_API_BASE = 'https://api.gleif.org/api/v1/lei-records';
  private readonly MAX_RESULTS = 10;
  private tldMapping: TLDMapping;

  constructor() {
    // Initialize TLD to country mapping
    this.tldMapping = this.initializeTLDMapping();
  }

  /**
   * Main search method - tries different strategies to find GLEIF entities
   */
  async searchGLEIF(suspectedName: string, domain?: string): Promise<{
    entities: GLEIFCandidate[];
    searchMethod: string;
    totalMatches: number;
  }> {
    console.log(`[Beta v2] [GLEIF] Starting search for: ${suspectedName}`);
    const startTime = Date.now();

    // Try exact search first
    let result = await this.performSearch(suspectedName, 'exact');
    
    if (result.entities.length === 0) {
      console.log(`[Beta v2] [GLEIF] No exact matches, trying fuzzy search`);
      // Try fuzzy search
      result = await this.performSearch(suspectedName, 'fuzzy');
      
      if (result.entities.length === 0 && domain) {
        console.log(`[Beta v2] [GLEIF] No fuzzy matches, trying geographic search`);
        // Try geographic search with jurisdiction from domain
        const jurisdiction = this.getJurisdictionFromDomain(domain);
        if (jurisdiction) {
          result = await this.performSearch(suspectedName, 'geographic', jurisdiction);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Beta v2] [GLEIF] Search completed in ${duration}ms, found ${result.entities.length} candidates`);

    // Calculate algorithmic scores for each candidate
    if (domain) {
      result.entities = result.entities.map(entity => 
        this.enrichWithScores(entity, suspectedName, domain)
      );
    }

    return result;
  }

  /**
   * Perform actual API search
   */
  private async performSearch(
    searchTerm: string, 
    method: 'exact' | 'fuzzy' | 'geographic',
    jurisdiction?: string
  ): Promise<{ entities: GLEIFCandidate[]; searchMethod: string; totalMatches: number }> {
    try {
      let searchUrl = `${this.GLEIF_API_BASE}?page[size]=${this.MAX_RESULTS}`;
      
      // Build search query based on method
      switch (method) {
        case 'exact':
          searchUrl += `&filter[entity.legalName]=${encodeURIComponent(searchTerm)}`;
          break;
        case 'fuzzy':
          searchUrl += `&filter[entity.legalName]=*${encodeURIComponent(searchTerm)}*`;
          break;
        case 'geographic':
          searchUrl += `&filter[entity.legalName]=*${encodeURIComponent(searchTerm)}*`;
          if (jurisdiction) {
            searchUrl += `&filter[entity.legalAddress.country]=${jurisdiction}`;
          }
          break;
      }

      console.log(`[Beta v2] [GLEIF] API request: ${method} search for "${searchTerm}"`);
      
      const response = await axios.get<GLEIFApiResponse>(searchUrl, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'User-Agent': 'Beta-V2-Domain-Intelligence/1.0'
        },
        timeout: 30000 // 30 second timeout
      });

      const entities = response.data.data.map(record => this.parseGLEIFEntity(record));
      const totalMatches = response.data.meta?.pagination?.total || entities.length;

      return {
        entities,
        searchMethod: method,
        totalMatches
      };
    } catch (error: any) {
      console.error(`[Beta v2] [GLEIF] API error:`, error.message);
      return {
        entities: [],
        searchMethod: method,
        totalMatches: 0
      };
    }
  }

  /**
   * Parse GLEIF API response into our candidate structure
   */
  private parseGLEIFEntity(record: GLEIFApiEntity): GLEIFCandidate {
    const attributes = record.attributes;
    
    return {
      leiCode: attributes.lei,
      legalName: attributes.entity.legalName.name,
      entityStatus: attributes.entity.status,
      legalForm: attributes.entity.legalForm?.other || attributes.entity.legalForm?.id,
      legalFormCode: attributes.entity.legalForm?.id,
      jurisdiction: attributes.entity.jurisdiction,
      entityCategory: attributes.entity.category,
      entitySubCategory: attributes.entity.subCategory,
      
      headquarters: this.parseAddress(attributes.entity.headquartersAddress),
      legalAddress: this.parseAddress(attributes.entity.legalAddress),
      
      registrationStatus: attributes.registration.status,
      initialRegistrationDate: attributes.registration.initialRegistrationDate,
      lastUpdateDate: attributes.registration.lastUpdateDate,
      nextRenewalDate: attributes.registration.nextRenewalDate,
      managingLou: attributes.registration.managingLou,
      
      otherNames: attributes.entity.otherNames?.map(n => n.name) || [],
      validationSources: attributes.registration.validationSources,
      bicCodes: attributes.bic || [],
      
      gleifRawData: record
    };
  }

  /**
   * Parse address structure
   */
  private parseAddress(address: any): GLEIFAddress {
    return {
      country: address?.country,
      city: address?.city,
      region: address?.region,
      postalCode: address?.postalCode,
      addressLine: address?.addressLines?.join(', ')
    };
  }

  /**
   * Calculate algorithmic scores (adapted from non-beta)
   */
  private enrichWithScores(
    entity: GLEIFCandidate, 
    suspectedName: string, 
    domain: string
  ): GLEIFCandidate {
    // Name match score
    entity.nameMatchScore = this.calculateNameMatchScore(entity.legalName, suspectedName);
    
    // Fortune 500 score (simplified)
    entity.fortune500Score = this.calculateFortune500Score(entity.legalName);
    
    // TLD jurisdiction score
    entity.tldJurisdictionScore = this.calculateTLDScore(entity, domain);
    
    // Entity complexity score
    entity.entityComplexityScore = this.calculateComplexityScore(entity);
    
    // Calculate weighted total
    entity.weightedTotalScore = Math.round(
      (entity.nameMatchScore * 0.4) +
      (entity.fortune500Score * 0.25) +
      (entity.tldJurisdictionScore * 0.2) +
      (entity.entityComplexityScore * 0.15)
    );
    
    // Generate selection reason
    entity.selectionReason = this.generateSelectionReason(entity);
    
    return entity;
  }

  /**
   * Calculate name match score
   */
  private calculateNameMatchScore(legalName: string, suspectedName: string): number {
    const legal = legalName.toLowerCase();
    const suspected = suspectedName.toLowerCase();
    
    if (legal === suspected) return 100;
    if (legal.includes(suspected) || suspected.includes(legal)) return 80;
    
    // Calculate similarity
    const similarity = this.calculateSimilarity(legal, suspected);
    return Math.round(similarity * 100);
  }

  /**
   * Simple string similarity calculation
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance
   */
  private getEditDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Simplified Fortune 500 detection
   */
  private calculateFortune500Score(legalName: string): number {
    const fortune500Keywords = [
      'apple', 'microsoft', 'amazon', 'google', 'walmart', 'exxon',
      'berkshire', 'unitedhealth', 'johnson', 'jpmorgan', 'visa'
    ];
    
    const lowerName = legalName.toLowerCase();
    for (const keyword of fortune500Keywords) {
      if (lowerName.includes(keyword)) return 100;
    }
    
    return 0;
  }

  /**
   * Calculate TLD jurisdiction alignment
   */
  private calculateTLDScore(entity: GLEIFCandidate, domain: string): number {
    const tld = this.extractTLD(domain);
    const expectedJurisdiction = this.tldMapping[tld];
    
    if (!expectedJurisdiction) return 50; // Neutral score for unknown TLDs
    
    // Check if entity jurisdiction matches expected
    if (entity.jurisdiction === expectedJurisdiction) return 100;
    if (entity.headquarters.country === expectedJurisdiction) return 90;
    if (entity.legalAddress.country === expectedJurisdiction) return 80;
    
    return 20; // Low score for mismatched jurisdiction
  }

  /**
   * Calculate entity completeness score
   */
  private calculateComplexityScore(entity: GLEIFCandidate): number {
    let score = 0;
    
    // Check completeness of data
    if (entity.entityStatus === 'ACTIVE') score += 20;
    if (entity.legalForm) score += 15;
    if (entity.headquarters.city && entity.headquarters.country) score += 20;
    if (entity.registrationStatus === 'ISSUED') score += 15;
    if (entity.otherNames && entity.otherNames.length > 0) score += 10;
    if (entity.bicCodes && entity.bicCodes.length > 0) score += 10;
    if (entity.validationSources) score += 10;
    
    return Math.min(score, 100);
  }

  /**
   * Generate human-readable selection reason
   */
  private generateSelectionReason(entity: GLEIFCandidate): string {
    const reasons = [];
    
    if (entity.nameMatchScore! >= 85) reasons.push('Strong name match');
    if (entity.fortune500Score! >= 75) reasons.push('Fortune 500 company');
    if (entity.tldJurisdictionScore! >= 75) reasons.push('Jurisdiction alignment');
    if (entity.entityComplexityScore! >= 75) reasons.push('Complete entity profile');
    
    return reasons.length > 0 ? reasons.join(', ') : 'Basic entity match';
  }

  /**
   * Extract TLD from domain
   */
  private extractTLD(domain: string): string {
    const parts = domain.split('.');
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Get jurisdiction from domain TLD
   */
  private getJurisdictionFromDomain(domain: string): string | undefined {
    const tld = this.extractTLD(domain);
    return this.tldMapping[tld];
  }

  /**
   * Initialize TLD to country mapping
   */
  private initializeTLDMapping(): TLDMapping {
    return {
      // Common commercial TLDs default to US
      'com': 'US',
      'net': 'US',
      'org': 'US',
      
      // Country-specific TLDs
      'us': 'US',
      'uk': 'GB',
      'de': 'DE',
      'fr': 'FR',
      'it': 'IT',
      'es': 'ES',
      'nl': 'NL',
      'be': 'BE',
      'ch': 'CH',
      'at': 'AT',
      'jp': 'JP',
      'cn': 'CN',
      'kr': 'KR',
      'in': 'IN',
      'br': 'BR',
      'mx': 'MX',
      'ca': 'CA',
      'au': 'AU',
      'nz': 'NZ',
      'za': 'ZA',
      'sg': 'SG',
      'hk': 'HK',
      'tw': 'TW',
      'my': 'MY',
      'id': 'ID',
      'th': 'TH',
      'vn': 'VN',
      'ph': 'PH',
      'ru': 'RU',
      'pl': 'PL',
      'se': 'SE',
      'no': 'NO',
      'dk': 'DK',
      'fi': 'FI',
      'ie': 'IE',
      'pt': 'PT',
      'gr': 'GR',
      'cz': 'CZ',
      'hu': 'HU',
      'ro': 'RO',
      'bg': 'BG',
      'hr': 'HR',
      'si': 'SI',
      'sk': 'SK',
      'lt': 'LT',
      'lv': 'LV',
      'ee': 'EE',
      'il': 'IL',
      'ae': 'AE',
      'sa': 'SA',
      'eg': 'EG',
      'ng': 'NG',
      'ke': 'KE',
      'ma': 'MA',
      'tn': 'TN',
      'tr': 'TR',
      'pk': 'PK',
      'bd': 'BD',
      'lk': 'LK'
    };
  }
}