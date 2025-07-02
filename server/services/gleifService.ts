import { getTLDMapping } from '../../shared/jurisdictions';
import type { Domain, InsertGleifCandidate } from '../../shared/schema';
import { gleifKnowledgeBase } from './gleifKnowledgeBase';
import { gleifValidationService } from './gleifValidationService';

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
  selectionMethod: string;
  manualReviewRequired: boolean;
  totalCandidates: number;
}

export class GLEIFService {
  private tldMapping: Record<string, string>;

  constructor() {
    this.tldMapping = getTLDMapping();
  }

  /**
   * Main entry point for GLEIF entity search
   */
  async searchEntity(companyName: string, domain: string): Promise<GLEIFSearchResult> {
    try {
      // Try exact search first
      let result = await this.performGLEIFSearch(companyName, 'exact');

      if (result.entities.length === 0) {
        // Try fuzzy search if exact fails
        result = await this.performGLEIFSearch(companyName, 'fuzzy');

        if (result.entities.length === 0) {
          // Try geographic search with TLD-based jurisdiction
          const jurisdiction = this.getJurisdictionFromDomain(domain);
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

    // ENHANCED VALIDATION: Filter and validate entities before processing
    const validatedEntities = gleifValidationService.validateAndRankCandidates(
      entities,
      domain.domain,
      domain.companyName || ''
    );

    console.log(`Validation filtered ${entities.length} entities to ${validatedEntities.length} high-quality matches`);

    if (validatedEntities.length === 0) {
      throw new Error('No valid GLEIF entities found after quality validation - all matches filtered as false positives');
    }

    // Convert validated entities to candidates with enhanced scoring
    const candidates: GLEIFCandidate[] = validatedEntities.map((entity, index) => {
      const scores = this.calculateWeightedScore(entity, domain);

      return {
        ...entity,
        gleifMatchScore: this.calculateGLEIFMatchScore(entity, domain.companyName || ''),
        weightedScore: Math.max(scores.totalScore, entity.validationScore), // Use higher of algorithm or validation score
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

    // ACCUMULATION STRATEGY: Store all discovered entities in knowledge base
    try {
      await gleifKnowledgeBase.accumulateEntities(
        entities, 
        domain, 
        searchMethod, 
        primarySelection.lei
      );
      console.log(`✓ Accumulated ${entities.length} GLEIF entities for domain: ${domain.domain}`);
    } catch (error) {
      console.error(`Failed to accumulate GLEIF entities for ${domain.domain}:`, error);
      // Don't fail the main process if accumulation fails
    }

    return {
      primarySelection,
      alternativeCandidates,
      selectionMethod: manualReviewRequired ? 'manual_override' : 'weighted_algorithm',
      manualReviewRequired,
      totalCandidates: candidates.length
    };
  }

  /**
   * Perform actual GLEIF API search using the public GLEIF API
   */
  private async performGLEIFSearch(
    searchTerm: string, 
    method: 'exact' | 'fuzzy' | 'geographic',
    jurisdiction?: string
  ): Promise<GLEIFSearchResult> {
    try {
      // GLEIF provides a free public API for legal entity searches
      const baseUrl = 'https://api.gleif.org/api/v1/lei-records';
      let searchUrl = `${baseUrl}?filter[entity.legalName]=*${encodeURIComponent(searchTerm)}*&page[size]=10`;

      // Add jurisdiction filter if provided
      if (jurisdiction) {
        searchUrl += `&filter[entity.legalAddress.country]=${jurisdiction}`;
      }

      console.log(`GLEIF API: Searching for "${searchTerm}" using ${method} method`);

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.api+json',
          'User-Agent': 'Domain-Intelligence-Platform/1.0'
        }
      });

      if (!response.ok) {
        console.error(`GLEIF API error: ${response.status} ${response.statusText}`);
        return { searchTerm, totalMatches: 0, entities: [], searchMethod: method };
      }

      const data = await response.json();
      const entities: GLEIFEntity[] = [];

      if (data.data && Array.isArray(data.data)) {
        for (const record of data.data) {
          const entity = this.parseGLEIFRecord(record);
          if (entity) {
            entities.push(entity);
          }
        }
      }

      console.log(`GLEIF API: Found ${entities.length} entities for "${searchTerm}"`);

      return {
        searchTerm,
        totalMatches: data.meta?.pagination?.total || entities.length,
        entities,
        searchMethod: method
      };

    } catch (error: any) {
      console.error(`GLEIF API search failed for "${searchTerm}":`, error.message);
      return { searchTerm, totalMatches: 0, entities: [], searchMethod: method };
    }
  }

  /**
   * Parse GLEIF API record into our entity format
   */
  private parseGLEIFRecord(record: any): GLEIFEntity | null {
    try {
      const attributes = record.attributes;
      if (!attributes?.entity) return null;

      const entity = attributes.entity;
      const registration = attributes.registration;

      return {
        lei: attributes.lei || '',
        legalName: entity.legalName?.name || '',
        entityStatus: entity.status || 'UNKNOWN',
        jurisdiction: entity.legalAddress?.country || '',
        legalForm: entity.legalForm?.id || '',
        entityCategory: entity.category || 'GENERAL',
        registrationStatus: registration?.status || 'UNKNOWN',
        headquarters: {
          country: entity.headquartersAddress?.country || '',
          region: entity.headquartersAddress?.region || '',
          city: entity.headquartersAddress?.city || '',
          addressLines: entity.headquartersAddress?.addressLines || [],
          postalCode: entity.headquartersAddress?.postalCode || ''
        },
        legalAddress: {
          country: entity.legalAddress?.country || '',
          region: entity.legalAddress?.region || '',
          city: entity.legalAddress?.city || '',
          addressLines: entity.legalAddress?.addressLines || [],
          postalCode: entity.legalAddress?.postalCode || ''
        },
        otherNames: entity.otherEntityNames?.map((n: any) => n.name) || [],
        registrationDate: registration?.initialRegistrationDate || '',
        lastUpdateDate: attributes.lastUpdateDate || ''
      };
    } catch (error) {
      console.error('Failed to parse GLEIF record:', error);
      return null;
    }
  }

  /**
   * Calculate weighted score for GLEIF candidate selection
   */
  private calculateWeightedScore(entity: GLEIFEntity, domain: Domain) {
    const domainTldScore = Math.round(this.calculateDomainTldScore(entity, domain.domain));
    const fortune500Score = Math.round(this.calculateFortune500Score(entity));
    const nameMatchScore = Math.round(this.calculateNameMatchScore(entity, domain.companyName || ''));
    const entityComplexityScore = Math.round(this.calculateEntityComplexityScore(entity, domain.domain));

    // Weighted scoring algorithm: Name Match (40%) + Fortune 500 (25%) + TLD (20%) + Complexity (15%)
    const totalScore = Math.round(
      (nameMatchScore * 0.4) + 
      (fortune500Score * 0.25) + 
      (domainTldScore * 0.2) + 
      (entityComplexityScore * 0.15)
    );

    const selectionReason = this.generateSelectionReason(
      nameMatchScore, fortune500Score, domainTldScore, entityComplexityScore
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
    const domainTLD = domain.split('.').pop()?.toLowerCase();
    const entityCountry = entity.jurisdiction.toLowerCase();

    // Enhanced geographic matching with business context priority

    // Perfect jurisdiction match
    if (this.tldMapping[`.${domainTLD}`] === entityCountry) {
      return 100;
    }

    // Special handling for .com domains - heavily favor US entities
    if (domainTLD === 'com') {
      if (entityCountry === 'us') {
        return 95; // Strong preference for US entities on .com
      }
      // Significant penalty for non-US entities on .com domains
      // unless it's a major business jurisdiction
      if (['ca', 'gb', 'de', 'fr', 'jp', 'au'].includes(entityCountry)) {
        return 30; // Some allowance for major business centers
      }
      return 15; // Heavy penalty for others
    }

    // Generic TLD handling with business context
    if (['org', 'net'].includes(domainTLD || '')) {
      // More neutral for org/net
      if (entityCountry === 'us') return 70;
      return 50;
    }

    // Country-specific TLD mismatches
    if (domainTLD && domainTLD.length === 2) {
      // This is a country TLD that doesn't match entity jurisdiction
      return 10; // Heavy penalty for wrong country TLD
    }

    return 25; // Default for other mismatches
  }

  private calculateFortune500Score(entity: GLEIFEntity): number {
    const fortune500Indicators = [
      'inc', 'corporation', 'corp', 'company', 'co', 'ltd', 'limited',
      'sa', 'se', 'ag', 'gmbh', 'spa', 'srl', 'bv', 'nv'
    ];

    const legalName = entity.legalName.toLowerCase();
    const hasF500Indicator = fortune500Indicators.some(indicator => 
      legalName.includes(indicator)
    );

    if (hasF500Indicator && entity.entityStatus === 'ACTIVE') {
      return 100;
    } else if (hasF500Indicator) {
      return 75;
    } else if (entity.entityStatus === 'ACTIVE') {
      return 50;
    }

    return 25;
  }

  private calculateNameMatchScore(entity: GLEIFEntity, companyName: string): number {
    if (!companyName) return 0;

    const entityName = entity.legalName.toLowerCase();
    const targetName = companyName.toLowerCase();

    // Exact match
    if (entityName === targetName) return 100;

    // Contains match
    if (entityName.includes(targetName) || targetName.includes(entityName)) return 85;

    // Word overlap analysis
    const entityWords = entityName.split(/\s+/);
    const targetWords = targetName.split(/\s+/);
    const overlap = entityWords.filter(word => targetWords.includes(word)).length;
    const maxWords = Math.max(entityWords.length, targetWords.length);

    if (overlap > 0) {
      return Math.round((overlap / maxWords) * 80);
    }

    return 10; // Minimal score for any match
  }

  private calculateEntityComplexityScore(entity: GLEIFEntity, domain: string): number {
    let score = 50; // Base score

    // Active status bonus (most important)
    if (entity.entityStatus === 'ACTIVE') score += 25;

    // Enhanced registration status handling
    if (entity.registrationStatus === 'ISSUED') {
      score += 15;
    } else if (entity.registrationStatus === 'LAPSED' && entity.entityStatus === 'ACTIVE') {
      // Reduced penalty for lapsed but active entities - common in business
      score += 5; // Still some bonus for active entities
    }

    // Business entity type preference for commercial domains
    const isCommercialDomain = domain.endsWith('.com') || domain.endsWith('.biz');
    if (isCommercialDomain) {
      const commercialEntityTypes = ['PJ10', '8888', 'C3VN', 'TXGZ']; // Common commercial forms
      const foundationTypes = ['5WWO', 'PRIV']; // Foundation/trust types

      if (commercialEntityTypes.includes(entity.legalForm)) {
        score += 15; // Prefer corporations for .com domains
      } else if (foundationTypes.includes(entity.legalForm)) {
        score -= 10; // Penalize foundations for commercial domains
      }
    }

    // Complete address information bonus
    if (entity.headquarters.country && entity.headquarters.city) score += 10;

    return Math.min(Math.max(score, 0), 100);
  }

  private generateSelectionReason(
    nameMatch: number, fortune500: number, tldMatch: number, complexity: number
  ): string {
    const reasons = [];

    if (nameMatch >= 85) reasons.push('Strong name match');
    if (fortune500 >= 75) reasons.push('Fortune 500 indicators');
    if (tldMatch >= 75) reasons.push('Jurisdiction alignment');
    if (complexity >= 75) reasons.push('Complete entity profile');

    return reasons.length > 0 ? reasons.join(', ') : 'Basic entity match';
  }

  private calculateGLEIFMatchScore(entity: GLEIFEntity, companyName: string): number {
    return this.calculateNameMatchScore(entity, companyName);
  }

  private requiresManualReview(candidates: GLEIFCandidate[]): boolean {
    if (candidates.length === 0) return false;
    if (candidates.length === 1) return false;

    // Manual review if top candidates have similar scores
    const topScore = candidates[0].weightedScore;
    const secondScore = candidates[1]?.weightedScore || 0;

    return (topScore - secondScore) < 15; // Less than 15 point difference
  }

  private getJurisdictionFromDomain(domain: string): string {
    const tld = '.' + domain.split('.').pop()?.toLowerCase();
    const jurisdiction = this.tldMapping[tld];

    // Global jurisdiction fallback logic for 123 jurisdictions
    if (!jurisdiction) {
      // Enhanced TLD recognition for global coverage
      const globalTLDs: Record<string, string> = {
        '.com': 'global', // Multi-jurisdiction preference
        '.org': 'global',
        '.net': 'global',
        '.biz': 'global',
        '.info': 'global'
      };

      return globalTLDs[tld] || 'US';
    }

    return jurisdiction;
  }

  /**
   * Search with focus jurisdiction for Level 2 processing
   */
  async searchWithFocusJurisdiction(
    companyName: string, 
    domain: string, 
    focusJurisdiction?: string,
    focusConfidence?: number,
    alternatives?: string[]
  ): Promise<GLEIFSearchResult> {
    try {
      // If we have a high-confidence focus jurisdiction, search there first
      if (focusJurisdiction && focusConfidence && focusConfidence > 70) {
        console.log(`Searching GLEIF with focus jurisdiction: ${focusJurisdiction} (${focusConfidence}% confidence)`);
        const result = await this.performGLEIFSearch(companyName, 'geographic', focusJurisdiction);
        if (result.entities.length > 0) {
          return result;
        }
      }
      
      // Try alternatives if provided
      if (alternatives && alternatives.length > 0) {
        for (const altJurisdiction of alternatives.slice(0, 2)) { // Limit to top 2 alternatives
          const result = await this.performGLEIFSearch(companyName, 'geographic', altJurisdiction);
          if (result.entities.length > 0) {
            console.log(`Found entities in alternative jurisdiction: ${altJurisdiction}`);
            return result;
          }
        }
      }
      
      // Fall back to standard search
      return await this.searchEntity(companyName, domain);
      
    } catch (error) {
      console.error('Focus jurisdiction search failed:', error);
      // Fall back to standard search on error
      return await this.searchEntity(companyName, domain);
    }
  }

  /**
   * Enhanced global search with multi-jurisdiction support
   */
  async searchGlobalEntity(companyName: string, domain: string, priorityJurisdictions?: string[]): Promise<GLEIFSearchResult> {
    // Try primary jurisdiction first
    let result = await this.searchEntity(companyName, domain);

    // If no results and priority jurisdictions specified, search those
    if (result.entities.length === 0 && priorityJurisdictions) {
      for (const jurisdiction of priorityJurisdictions) {
        result = await this.performGLEIFSearch(companyName, 'geographic', jurisdiction);
        if (result.entities.length > 0) {
          console.log(`Global search found entities in jurisdiction: ${jurisdiction}`);
          break;
        }
      }
    }

    return result;
  }
}

export const gleifService = new GLEIFService();