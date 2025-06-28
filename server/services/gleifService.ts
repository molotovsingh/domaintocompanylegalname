import { getTLDMapping } from '../../shared/jurisdictions';
import type { Domain, InsertGleifCandidate } from '../../shared/schema';

export interface GLEIFEntity {
  lei: string;
  legalName: string;
  entityStatus: string;
  jurisdiction: string;
  legalForm: string;
  entityCategory: string;
  registrationStatus: string;
  headquarters: {
    country: string;
    region: string;
    city: string;
    addressLines: string[];
    postalCode: string;
  };
  legalAddress: {
    country: string;
    region: string;
    city: string;
    addressLines: string[];
    postalCode: string;
  };
  otherNames: string[];
  registrationDate: string;
  lastUpdateDate: string;
}

export interface GLEIFSearchResult {
  searchTerm: string;
  totalMatches: number;
  entities: GLEIFEntity[];
  searchMethod: 'exact' | 'fuzzy' | 'geographic';
}

export interface GLEIFCandidate extends GLEIFEntity {
  gleifMatchScore: number;
  weightedScore: number;
  rankPosition: number;
  domainTldScore: number;
  fortune500Score: number;
  nameMatchScore: number;
  entityComplexityScore: number;
  matchMethod: string;
  selectionReason: string;
  isPrimarySelection: boolean;
}

export interface SelectionResult {
  primarySelection: GLEIFCandidate;
  alternativeCandidates: GLEIFCandidate[];
  selectionMethod: 'weighted_algorithm' | 'manual_override' | 'single_match';
  manualReviewRequired: boolean;
  totalCandidates: number;
}

export class GLEIFService {
  private readonly GLEIF_API_BASE = 'https://api.gleif.org/api/v1';
  private readonly tldMapping: Record<string, string>;
  private readonly fortune500Companies: Set<string>;

  constructor() {
    this.tldMapping = getTLDMapping();
    this.fortune500Companies = new Set([
      // Major technology companies
      'Apple Inc.', 'Microsoft Corporation', 'Alphabet Inc.', 'Amazon.com Inc.',
      'Meta Platforms Inc.', 'Tesla Inc.', 'NVIDIA Corporation', 'Oracle Corporation',
      
      // Major automotive companies  
      'General Motors Company', 'Ford Motor Company', 'Toyota Motor Corporation',
      'Volkswagen AG', 'BMW AG', 'Mercedes-Benz Group AG', 'Stellantis N.V.',
      
      // Major financial institutions
      'JPMorgan Chase & Co.', 'Bank of America Corporation', 'Wells Fargo & Company',
      'Goldman Sachs Group Inc.', 'Morgan Stanley', 'Citigroup Inc.',
      
      // Additional Fortune 500 entries can be expanded based on requirements
    ]);
  }

  /**
   * Search for GLEIF entities based on company name extracted from Level 1
   */
  async searchEntity(companyName: string, domain?: string): Promise<GLEIFSearchResult> {
    try {
      // Try exact match first
      let result = await this.performGLEIFSearch(companyName, 'exact');
      
      if (result.entities.length === 0) {
        // Try fuzzy search if exact match fails
        result = await this.performGLEIFSearch(companyName, 'fuzzy');
      }
      
      if (result.entities.length === 0 && domain) {
        // Try geographic search based on domain TLD
        const jurisdiction = this.getJurisdictionFromDomain(domain);
        if (jurisdiction) {
          result = await this.performGLEIFSearch(companyName, 'geographic', jurisdiction);
        }
      }

      return result;
    } catch (error) {
      console.error('GLEIF API search failed:', error);
      return {
        searchTerm: companyName,
        totalMatches: 0,
        entities: [],
        searchMethod: 'exact'
      };
    }
  }

  /**
   * Process multiple GLEIF candidates and select the best match using weighted algorithm
   */
  async processMultipleCandidates(
    entities: GLEIFEntity[], 
    domain: Domain, 
    searchMethod: string
  ): Promise<SelectionResult> {
    if (entities.length === 0) {
      throw new Error('No GLEIF entities provided for candidate processing');
    }

    // Convert entities to candidates with scoring
    const candidates: GLEIFCandidate[] = entities.map((entity, index) => {
      const scores = this.calculateWeightedScore(entity, domain);
      
      return {
        ...entity,
        gleifMatchScore: this.calculateGLEIFMatchScore(entity, domain.companyName || ''),
        weightedScore: scores.totalScore,
        rankPosition: index + 1,
        domainTldScore: scores.domainTldScore,
        fortune500Score: scores.fortune500Score,
        nameMatchScore: scores.nameMatchScore,
        entityComplexityScore: scores.entityComplexityScore,
        matchMethod: searchMethod,
        selectionReason: scores.selectionReason,
        isPrimarySelection: index === 0 // Initially mark first as primary
      };
    });

    // Sort candidates by weighted score (descending)
    candidates.sort((a, b) => b.weightedScore - a.weightedScore);
    
    // Update rank positions after sorting
    candidates.forEach((candidate, index) => {
      candidate.rankPosition = index + 1;
      candidate.isPrimarySelection = index === 0;
    });

    const primarySelection = candidates[0];
    const alternativeCandidates = candidates.slice(1);

    // Determine if manual review is required
    const manualReviewRequired = this.requiresManualReview(candidates);

    return {
      primarySelection,
      alternativeCandidates,
      selectionMethod: manualReviewRequired ? 'manual_override' : 'weighted_algorithm',
      manualReviewRequired,
      totalCandidates: candidates.length
    };
  }

  /**
   * Perform actual GLEIF API search
   */
  private async performGLEIFSearch(
    searchTerm: string, 
    method: 'exact' | 'fuzzy' | 'geographic',
    jurisdiction?: string
  ): Promise<GLEIFSearchResult> {
    // This is a placeholder for the actual GLEIF API integration
    // In a real implementation, this would make HTTP requests to the GLEIF API
    
    const mockEntities: GLEIFEntity[] = [
      {
        lei: 'HWUPKR0MPOU8FGXBT394',
        legalName: 'Apple Inc.',
        entityStatus: 'ACTIVE',
        jurisdiction: 'US-CA',
        legalForm: 'H1UM',
        entityCategory: 'GENERAL',
        registrationStatus: 'ISSUED',
        headquarters: {
          country: 'US',
          region: 'CA',
          city: 'Cupertino',
          addressLines: ['One Apple Park Way'],
          postalCode: '95014'
        },
        legalAddress: {
          country: 'US',
          region: 'CA', 
          city: 'Cupertino',
          addressLines: ['One Apple Park Way'],
          postalCode: '95014'
        },
        otherNames: ['Apple Computer Inc.'],
        registrationDate: '1976-04-01',
        lastUpdateDate: '2024-12-01'
      }
    ];

    return {
      searchTerm,
      totalMatches: mockEntities.length,
      entities: mockEntities,
      searchMethod: method
    };
  }

  /**
   * Calculate weighted score for GLEIF candidate selection
   */
  private calculateWeightedScore(entity: GLEIFEntity, domain: Domain): {
    totalScore: number;
    domainTldScore: number;
    fortune500Score: number;
    nameMatchScore: number;
    entityComplexityScore: number;
    selectionReason: string;
  } {
    // Domain TLD Matching (40% weight)
    const domainTldScore = this.calculateDomainTldScore(entity, domain.domain);
    
    // Fortune 500 Recognition (30% weight)
    const fortune500Score = this.calculateFortune500Score(entity);
    
    // Name Match Quality (20% weight)
    const nameMatchScore = this.calculateNameMatchScore(entity, domain.companyName || '');
    
    // Entity Complexity (10% weight)
    const entityComplexityScore = this.calculateEntityComplexityScore(entity);

    const totalScore = Math.round(
      domainTldScore * 0.4 +
      fortune500Score * 0.3 +
      nameMatchScore * 0.2 +
      entityComplexityScore * 0.1
    );

    const selectionReason = this.generateSelectionReason(
      domainTldScore, fortune500Score, nameMatchScore, entityComplexityScore
    );

    return {
      totalScore,
      domainTldScore,
      fortune500Score,
      nameMatchScore,
      entityComplexityScore,
      selectionReason
    };
  }

  private calculateDomainTldScore(entity: GLEIFEntity, domain: string): number {
    const tld = domain.split('.').pop()?.toLowerCase();
    if (!tld) return 0;

    const expectedJurisdiction = this.tldMapping[tld];
    if (!expectedJurisdiction) return 50; // Neutral score for unknown TLDs

    // Check if entity jurisdiction matches domain TLD
    if (entity.jurisdiction.startsWith(expectedJurisdiction)) {
      return 100; // Perfect match
    }

    // Partial match for similar jurisdictions (e.g., US states)
    if (expectedJurisdiction === 'US' && entity.jurisdiction.startsWith('US-')) {
      return 80;
    }

    return 20; // Low score for jurisdiction mismatch
  }

  private calculateFortune500Score(entity: GLEIFEntity): number {
    if (this.fortune500Companies.has(entity.legalName)) {
      return 100; // Fortune 500 company
    }
    
    // Check for partial matches (e.g., subsidiaries)
    for (const fortune500Name of this.fortune500Companies) {
      if (entity.legalName.includes(fortune500Name.split(' ')[0]) || 
          fortune500Name.includes(entity.legalName.split(' ')[0])) {
        return 60; // Potential subsidiary or related entity
      }
    }
    
    return 0; // Not recognized as Fortune 500
  }

  private calculateNameMatchScore(entity: GLEIFEntity, extractedName: string): number {
    if (!extractedName) return 0;

    const normalizedEntity = entity.legalName.toLowerCase().replace(/[^\w\s]/g, '');
    const normalizedExtracted = extractedName.toLowerCase().replace(/[^\w\s]/g, '');

    // Exact match
    if (normalizedEntity === normalizedExtracted) {
      return 100;
    }

    // Check if extracted name is contained in entity name
    if (normalizedEntity.includes(normalizedExtracted)) {
      return 80;
    }

    // Check if entity name is contained in extracted name  
    if (normalizedExtracted.includes(normalizedEntity)) {
      return 70;
    }

    // Word-based similarity
    const entityWords = normalizedEntity.split(/\s+/);
    const extractedWords = normalizedExtracted.split(/\s+/);
    const commonWords = entityWords.filter(word => extractedWords.includes(word));
    
    if (commonWords.length > 0) {
      const similarity = (commonWords.length * 2) / (entityWords.length + extractedWords.length);
      return Math.round(similarity * 60); // Max 60 for partial matches
    }

    return 10; // Minimal score for no obvious match
  }

  private calculateEntityComplexityScore(entity: GLEIFEntity): number {
    let score = 50; // Base score

    // Active entities get higher scores
    if (entity.entityStatus === 'ACTIVE') {
      score += 30;
    }

    // Recent updates indicate active maintenance
    const lastUpdate = new Date(entity.lastUpdateDate);
    const monthsOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsOld < 6) {
      score += 20;
    }

    // Presence of headquarters info indicates completeness
    if (entity.headquarters.country && entity.headquarters.city) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private calculateGLEIFMatchScore(entity: GLEIFEntity, extractedName: string): number {
    // This would be the confidence score from the GLEIF API response
    // For now, return a high confidence for active entities with good name matches
    const nameScore = this.calculateNameMatchScore(entity, extractedName);
    const statusBonus = entity.entityStatus === 'ACTIVE' ? 20 : 0;
    
    return Math.min(nameScore + statusBonus, 100);
  }

  private generateSelectionReason(
    domainTldScore: number,
    fortune500Score: number, 
    nameMatchScore: number,
    entityComplexityScore: number
  ): string {
    const reasons: string[] = [];

    if (domainTldScore >= 80) {
      reasons.push('jurisdiction alignment');
    }
    if (fortune500Score >= 60) {
      reasons.push('Fortune 500 recognition');
    }
    if (nameMatchScore >= 70) {
      reasons.push('strong name match');
    }
    if (entityComplexityScore >= 80) {
      reasons.push('active entity status');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'algorithmic selection';
  }

  private requiresManualReview(candidates: GLEIFCandidate[]): boolean {
    if (candidates.length === 0) return true;
    
    // Require manual review if top candidates have similar scores
    if (candidates.length > 1) {
      const topScore = candidates[0].weightedScore;
      const secondScore = candidates[1].weightedScore;
      if (Math.abs(topScore - secondScore) <= 10) {
        return true;
      }
    }

    // Require manual review if primary selection has low confidence
    if (candidates[0].weightedScore < 70) {
      return true;
    }

    // Require manual review if more than 4 candidates
    if (candidates.length > 4) {
      return true;
    }

    return false;
  }

  private getJurisdictionFromDomain(domain: string): string | null {
    const tld = domain.split('.').pop()?.toLowerCase();
    return tld ? this.tldMapping[tld] || null : null;
  }
}

export const gleifService = new GLEIFService();