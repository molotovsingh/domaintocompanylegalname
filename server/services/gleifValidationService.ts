/**
 * GLEIF Validation Service - Enhanced Accuracy and Quality Control
 * 
 * This service implements comprehensive validation to prevent false positive matches
 * and ensure GLEIF entity intelligence accuracy, addressing issues like:
 * - Generic word matching (e.g., "Corporate" matching unrelated entities)
 * - Subdomain extraction errors
 * - Parent-subsidiary relationship validation
 */

import { GLEIFEntity } from './gleifService';

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  reason: string;
  warnings: string[];
}

interface DomainContext {
  fullDomain: string;
  rootDomain: string;
  subdomain?: string;
  extractedName: string;
  expectedCompany: string;
}

export class GLEIFValidationService {
  
  /**
   * Validate GLEIF entity match against domain context
   */
  validateEntityMatch(
    entity: GLEIFEntity, 
    domainContext: DomainContext,
    searchTerm: string
  ): ValidationResult {
    const warnings: string[] = [];
    let confidence = 100;
    
    // 1. Generic Term Detection
    const genericTerms = ['corporate', 'company', 'business', 'enterprise', 'group', 'holdings', 'ltd', 'inc', 'llc'];
    if (genericTerms.includes(searchTerm.toLowerCase())) {
      // For generic terms, require strong domain-entity correlation
      const domainValidation = this.validateDomainCorrelation(entity, domainContext);
      if (!domainValidation.isValid) {
        return {
          isValid: false,
          confidence: 10,
          reason: `Generic search term "${searchTerm}" matched unrelated entity "${entity.legalName}"`,
          warnings: ['Generic term matching requires strong domain correlation']
        };
      }
      confidence -= 30;
      warnings.push('Generic search term - requiring additional validation');
    }

    // 2. Domain Root Correlation
    const domainCorrelation = this.validateDomainCorrelation(entity, domainContext);
    if (!domainCorrelation.isValid) {
      confidence -= 40;
      warnings.push(domainCorrelation.reason);
    }

    // 3. Geographic Consistency
    const geoValidation = this.validateGeographicConsistency(entity, domainContext);
    if (!geoValidation.isValid) {
      confidence -= 20;
      warnings.push(geoValidation.reason);
    }

    // 4. Entity Type Appropriateness
    const typeValidation = this.validateEntityType(entity, domainContext);
    if (!typeValidation.isValid) {
      confidence -= 15;
      warnings.push(typeValidation.reason);
    }

    // 5. Name Pattern Matching
    const nameValidation = this.validateNamePattern(entity, domainContext, searchTerm);
    confidence += nameValidation.confidence;
    warnings.push(...nameValidation.warnings);

    return {
      isValid: confidence >= 30, // Relaxed from 50 for basic integration
      confidence: Math.max(0, Math.min(100, confidence)),
      reason: confidence >= 30 
        ? `Valid match with ${confidence}% confidence`
        : `Invalid match - confidence too low (${confidence}%)`,
      warnings
    };
  }

  /**
   * Validate domain-entity correlation
   */
  private validateDomainCorrelation(entity: GLEIFEntity, context: DomainContext): ValidationResult {
    const entityName = entity.legalName.toLowerCase();
    const rootDomain = context.rootDomain.toLowerCase();
    
    // Extract meaningful terms from domain (remove common TLDs and generic terms)
    const domainTerms = rootDomain
      .replace(/\.(com|org|net|edu|gov|co|ltd|inc)$/, '')
      .split(/[.-]/)
      .filter(term => term.length > 2 && !['www', 'corp', 'group'].includes(term));
    
    // Check if any domain terms appear in entity name
    const hasCorrelation = domainTerms.some(term => 
      entityName.includes(term) || this.calculateSimilarity(term, entityName) > 0.7
    );
    
    return {
      isValid: hasCorrelation || domainTerms.length === 0, // Accept when no domain terms to analyze
      confidence: hasCorrelation ? 80 : (domainTerms.length === 0 ? 60 : 20),
      reason: hasCorrelation 
        ? 'Strong domain-entity name correlation found'
        : domainTerms.length === 0
        ? 'No domain terms for correlation analysis - allowing match'
        : `No correlation between domain "${rootDomain}" and entity "${entity.legalName}"`,
      warnings: []
    };
  }

  /**
   * Validate geographic consistency
   */
  private validateGeographicConsistency(entity: GLEIFEntity, context: DomainContext): ValidationResult {
    // Map common TLDs to expected jurisdictions
    const tldJurisdictions: Record<string, string[]> = {
      '.com': ['US', 'GLOBAL'],
      '.co.uk': ['GB'],
      '.de': ['DE'],
      '.fr': ['FR'],
      '.jp': ['JP'],
      '.au': ['AU'],
      '.ca': ['CA'],
      '.in': ['IN'],
      '.cn': ['CN'],
      '.br': ['BR']
    };
    
    const domainTld = context.fullDomain.match(/\.[a-z]{2,}$/)?.[0];
    const expectedJurisdictions = domainTld ? tldJurisdictions[domainTld] : ['GLOBAL'];
    
    if (!expectedJurisdictions || expectedJurisdictions.includes('GLOBAL')) {
      return { isValid: true, confidence: 100, reason: 'Geographic validation passed', warnings: [] };
    }
    
    const isConsistent = expectedJurisdictions.includes(entity.jurisdiction || '') ||
                        expectedJurisdictions.includes(entity.headquarters?.country || '');
    
    return {
      isValid: isConsistent,
      confidence: isConsistent ? 90 : 30,
      reason: isConsistent 
        ? 'Geographic consistency validated'
        : `Geographic mismatch: domain TLD suggests ${expectedJurisdictions.join('/')} but entity is in ${entity.jurisdiction}`,
      warnings: isConsistent ? [] : ['Consider verifying entity jurisdiction']
    };
  }

  /**
   * Validate entity type appropriateness
   */
  private validateEntityType(entity: GLEIFEntity, context: DomainContext): ValidationResult {
    // Exclude obviously inappropriate entity types for major domains
    const inappropriateTypes = ['FUND', 'TRUST', 'NONPROFIT', 'GOVERNMENT'];
    
    if (entity.entityCategory && inappropriateTypes.includes(entity.entityCategory)) {
      return {
        isValid: false,
        confidence: 20,
        reason: `Entity type "${entity.entityCategory}" unlikely for commercial domain`,
        warnings: ['Entity type may not match domain purpose']
      };
    }
    
    return { isValid: true, confidence: 100, reason: 'Entity type appropriate', warnings: [] };
  }

  /**
   * Validate name pattern matching
   */
  private validateNamePattern(
    entity: GLEIFEntity, 
    context: DomainContext, 
    searchTerm: string
  ): ValidationResult {
    const entityName = entity.legalName.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    let confidence = 0;
    const warnings: string[] = [];
    
    // Exact match bonus
    if (entityName.includes(searchLower)) {
      confidence += 40;
    }
    
    // Similarity scoring
    const similarity = this.calculateSimilarity(searchLower, entityName);
    confidence += similarity * 30;
    
    // Penalize very generic matches
    if (searchLower.length <= 3 && !entityName.startsWith(searchLower)) {
      confidence -= 20;
      warnings.push('Very short search term - low specificity');
    }
    
    // Bonus for complete company name patterns
    if (this.hasCompleteCompanyPattern(entityName)) {
      confidence += 10;
    }
    
    return {
      isValid: confidence > 30,
      confidence: Math.max(0, Math.min(50, confidence)),
      reason: `Name pattern validation: ${confidence}% match quality`,
      warnings
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return 1 - matrix[str2.length][str1.length] / Math.max(str1.length, str2.length);
  }

  /**
   * Check if entity name has complete company pattern
   */
  private hasCompleteCompanyPattern(name: string): boolean {
    const corporateSuffixes = [
      'corporation', 'corp', 'incorporated', 'inc', 'company', 'co',
      'limited', 'ltd', 'llc', 'plc', 'gmbh', 'sa', 'ag', 'nv', 'bv'
    ];
    
    return corporateSuffixes.some(suffix => 
      name.toLowerCase().includes(suffix.toLowerCase())
    );
  }

  /**
   * Enhanced domain name extraction from subdomains
   */
  extractExpectedCompanyName(domain: string): DomainContext {
    const parts = domain.toLowerCase().split('.');
    const rootDomain = parts.slice(-2).join('.');
    
    // Handle subdomains intelligently
    let extractedName = '';
    let expectedCompany = '';
    
    if (parts.length > 2) {
      const subdomain = parts.slice(0, -2).join('.');
      
      // Special handling for corporate subdomains
      if (subdomain === 'corporate' || subdomain === 'corp') {
        // Extract from root domain instead
        extractedName = parts[parts.length - 2];
        expectedCompany = extractedName;
      } else {
        // Use subdomain if it's meaningful
        extractedName = subdomain.replace(/[-_]/g, ' ');
        expectedCompany = parts[parts.length - 2];
      }
    } else {
      extractedName = parts[0];
      expectedCompany = parts[0];
    }
    
    return {
      fullDomain: domain,
      rootDomain,
      subdomain: parts.length > 2 ? parts.slice(0, -2).join('.') : undefined,
      extractedName,
      expectedCompany
    };
  }

  /**
   * Filter and rank GLEIF candidates with enhanced validation
   */
  validateAndRankCandidates(
    entities: GLEIFEntity[],
    domain: string,
    searchTerm: string
  ): Array<GLEIFEntity & { validationScore: number; validationReasons: string[] }> {
    const domainContext = this.extractExpectedCompanyName(domain);
    
    return entities
      .map(entity => {
        const validation = this.validateEntityMatch(entity, domainContext, searchTerm);
        return {
          ...entity,
          validationScore: validation.confidence,
          validationReasons: [validation.reason, ...validation.warnings]
        };
      })
      .filter(entity => entity.validationScore >= 15) // Relaxed threshold for basic integration
      .sort((a, b) => b.validationScore - a.validationScore);
  }
}

export const gleifValidationService = new GLEIFValidationService();